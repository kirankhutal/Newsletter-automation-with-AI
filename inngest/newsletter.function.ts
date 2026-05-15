// inngest/newsletter.function.ts
// Refactored newsletter pipeline — model-agnostic LLM, no MCP, direct APIs

import { inngest } from './client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getWeekIdentifier, getWeekDescription } from '../lib/utils/week';
import { validateContent } from '../lib/utils/quality-checks';
import { checkSimilarity } from '../lib/validation/similarity';
import { generateNewsletter } from '../lib/llm/client';
import { fetchRelevantEmails, formatEmailsForLLM } from '../lib/gmail/fetcher';
import { createBeehiivDraft } from '../lib/beehiiv/client';
import { sendNotification } from '../lib/email/resend';
import { archiveToDrive } from '../lib/drive/archiver';
import { saveDraft, getLatestDraft, type DraftMetadata } from '../lib/metadata/store';

// Internal handler logic (separated so it can be unit tested)
async function newsletterHandlerLogic(
  week: string,
  eventId: string,
  stepRunner?: {
    run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
  }
) {
  const DRY_RUN = process.env.DRY_RUN === 'true';
  const SKILL_VERSION = process.env.SKILL_VERSION || 'latest';

  const weekDescription = getWeekDescription(new Date(), true);
  const today = new Date().toISOString();

  console.log(`[${week}] Starting newsletter generation`);
  console.log(`DRY_RUN mode: ${DRY_RUN}`);

  // Load skill prompt
  const skillPath = join(process.cwd(), `skills/banking-on-ai-newsletter.${SKILL_VERSION}.md`);
  const skill = readFileSync(skillPath, 'utf-8');

  let metadata: Partial<DraftMetadata> = {
    id: `draft-${week}`,
    week,
    weekDescription,
    generatedAt: today,
    skillVersion: SKILL_VERSION,
    dryRun: DRY_RUN,
    sentAt: null,
    llmCost: 0,
  };

  // Helper to run a step with optional Inngest step wrapping
  const runStep = async (name: string, fn: () => Promise<unknown>) => {
    if (stepRunner) {
      return stepRunner.run(name, fn);
    }
    return fn();
  };

  try {
    // STEP 1: Gather sources from Gmail
    const sources = await runStep('gather-sources', async () => {
      console.log(`[${week}] Fetching emails from Gmail...`);
      const emails = await fetchRelevantEmails();
      const formatted = formatEmailsForLLM(emails);
      metadata.sourceEmailCount = emails.length;
      return { emails, formatted };
    }) as { formatted: string };

    // STEP 2: Generate newsletter content
    const draft = await runStep('generate-content', async () => {
      console.log(`[${week}] Generating newsletter via LLM...`);
      const lastDraft = getLatestDraft();
      const result = await generateNewsletter({
        skillPrompt: skill,
        emailContent: sources.formatted,
        previousTitle: lastDraft?.title || '',
        previousSubtitle: lastDraft?.subtitle || '',
      });
      metadata.title = result.title;
      metadata.subtitle = result.subtitle;
      return result;
    }) as { title: string; subtitle: string; html_content: string };

    // STEP 3: Validate content quality
    const validation = await runStep('validate-content', async () => {
      console.log(`[${week}] Running quality checks...`);
      const qualityCheck = validateContent(
        draft.title,
        draft.html_content,
        ['AI Innovation', 'Banking Tech', 'Canadian', 'Market Trends']
      );
      metadata.wordCount = qualityCheck.details.wordCount;
      metadata.linkCount = qualityCheck.details.linkCount;
      metadata.pillarsFound = qualityCheck.details.foundPillars;
      metadata.qualityChecks = qualityCheck.checks;

      if (!qualityCheck.passed) {
        throw new Error(
          `Quality checks failed: wordCount=${qualityCheck.details.wordCount} (need 900+), ` +
          `links=${qualityCheck.details.linkCount} (need 3+), ` +
          `pillars=${qualityCheck.details.foundPillars.join(', ')}`
        );
      }

      // Check similarity to last week
      const lastDraft = getLatestDraft();
      if (lastDraft && lastDraft.title && !DRY_RUN) {
        const similarity = await checkSimilarity(
          draft.html_content,
          lastDraft.title + ' ' + lastDraft.subtitle
        );
        if (similarity.tooSimilar) {
          throw new Error(
            `Content too similar to last week (${(similarity.score * 100).toFixed(0)}% overlap). Regenerate with more differentiation.`
          );
        }
        console.log(`[${week}] Similarity score: ${(similarity.score * 100).toFixed(0)}% (${similarity.method})`);
      }

      console.log(`[${week}] Quality checks passed`);
      return qualityCheck;
    }) as { details: { wordCount: number; linkCount: number; foundPillars: string[] } };

    // STEP 4: Create draft in Beehiiv
    const beehiivResult = await runStep('publish-to-beehiiv', async () => {
      if (DRY_RUN) {
        console.log(`[${week}] DRY RUN: Would create Beehiiv draft`);
        console.log(`  Title: ${draft.title}`);
        console.log(`  Subtitle: ${draft.subtitle}`);
        console.log(`  Words: ${validation.details.wordCount}`);
        return { id: 'dry-run', web_url: 'https://app.beehiiv.com/dry-run', publish_url: '' };
      }
      console.log(`[${week}] Creating Beehiiv draft...`);
      let result;
      try {
        result = await createBeehiivDraft({
          title: draft.title,
          subtitle: draft.subtitle,
          htmlContent: draft.html_content,
        });
        metadata.beehiivPostId = result.id;
        metadata.beehiivUrl = result.web_url;
      } catch (beehiivError) {
        // Beehiiv API requires Enterprise plan — log and continue without it
        console.warn(`[${week}] Beehiiv draft creation failed (enterprise plan required): ${beehiivError instanceof Error ? beehiivError.message : beehiivError}`);
        result = { id: 'unavailable', web_url: 'https://app.beehiiv.com/posts/new', publish_url: '' };
      }
      return result;
    }) as { id: string; web_url: string; publish_url: string };

    // STEP 5: Archive to Google Drive (best-effort)
    await runStep('archive-to-drive', async () => {
      if (DRY_RUN) {
        console.log(`[${week}] DRY RUN: Would archive to Google Drive`);
        return;
      }
      console.log(`[${week}] Archiving to Google Drive...`);
      await archiveToDrive({
        weekDescription,
        title: draft.title,
        subtitle: draft.subtitle,
        content: draft.html_content,
        wordCount: validation.details.wordCount,
        generatedAt: today,
      });
    });

    // STEP 6: Store metadata
    await runStep('store-metadata', async () => {
      console.log(`[${week}] Storing metadata...`);
      saveDraft(metadata as DraftMetadata);
    });

    // STEP 7: Send success notification with full content
    await runStep('send-notification', async () => {
      console.log(`[${week}] Sending notification...`);
      await sendNotification({
        success: true,
        title: draft.title,
        subtitle: draft.subtitle,
        htmlContent: draft.html_content,
        beehiivUrl: beehiivResult.web_url,
        weekDescription,
        inngestRunUrl: `https://app.inngest.com/runs/${eventId}`,
      });
    });

    console.log(`[${week}] Newsletter generation complete!`);
    return {
      success: true,
      week,
      title: draft.title,
      dryRun: DRY_RUN,
      beehiivUrl: beehiivResult.web_url,
    };

  } catch (error) {
    console.error(`[${week}] Newsletter generation failed:`, error);

    await runStep('send-failure-notification', async () => {
      await sendNotification({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        failedStep: 'See Inngest dashboard',
        weekDescription,
        inngestRunUrl: `https://app.inngest.com/runs/${eventId}`,
      });
    });

    throw error;
  }
}

// Exported for integration testing — bypasses Inngest step runtime
export async function runNewsletterHandler(event: {
  data: { week: string };
  id: string;
}) {
  return newsletterHandlerLogic(event.data.week, event.id);
}

// Exported for external use (e.g., cron trigger via Inngest)
export { newsletterHandlerLogic };

// Inngest function definition (uses the internal logic)
export const newsletterFunction = inngest.createFunction(
  {
    id: 'draft-weekly-newsletter',
    name: 'Draft Weekly Banking on AI Newsletter',
    retries: 2,
    idempotency: 'event.data.week',
    triggers: { event: 'newsletter/draft.requested' },
  },
  async ({ event, step, attempt }) => {
    console.log(`[${event.data.week}] Starting newsletter generation (attempt ${attempt})`);
    return newsletterHandlerLogic(event.data.week, event.id, {
      run: (name, fn) => step.run(name, fn),
    });
  }
);
