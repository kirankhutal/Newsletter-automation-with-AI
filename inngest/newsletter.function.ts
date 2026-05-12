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

const DRY_RUN = process.env.DRY_RUN === 'true';
const SKILL_VERSION = process.env.SKILL_VERSION || 'latest';

export const newsletterFunction = inngest.createFunction(
  {
    id: 'draft-weekly-newsletter',
    name: 'Draft Weekly Banking on AI Newsletter',
    retries: 2,
    idempotency: 'event.data.week',
  },
  { event: 'newsletter/draft.requested' },

  async ({ event, step, attempt }) => {
    const week = event.data.week as string;
    const weekDescription = getWeekDescription(new Date(), true);
    const today = new Date().toISOString();

    console.log(`[${week}] Starting newsletter generation (attempt ${attempt})`);
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
      llmCost: 0, // Free model — cost is negligible
    };

    try {
      // ─────────────────────────────────────────────────────────────
      // STEP 1: Gather sources from Gmail
      // ─────────────────────────────────────────────────────────────
      const sources = await step.run('gather-sources', async () => {
        console.log(`[${week}] Fetching emails from Gmail...`);
        const emails = await fetchRelevantEmails();
        const formatted = formatEmailsForLLM(emails);
        metadata.sourceEmailCount = emails.length;
        return { emails, formatted };
      });

      // ─────────────────────────────────────────────────────────────
      // STEP 2: Generate newsletter content
      // ─────────────────────────────────────────────────────────────
      const draft = await step.run('generate-content', async () => {
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
      });

      // ─────────────────────────────────────────────────────────────
      // STEP 3: Validate content quality
      // ─────────────────────────────────────────────────────────────
      const validation = await step.run('validate-content', async () => {
        console.log(`[${week}] Running quality checks...`);

        const qualityCheck = validateContent(
          draft.title,
          draft.html_content,
          ['AI Innovation', 'Banking Tech', 'Regulation', 'Market Trends']
        );

        metadata.wordCount = qualityCheck.details.wordCount;
        metadata.linkCount = qualityCheck.details.linkCount;
        metadata.pillarsFound = qualityCheck.details.foundPillars;
        metadata.qualityChecks = qualityCheck.checks;

        if (!qualityCheck.passed) {
          throw new Error(
            `Quality checks failed: wordCount=${qualityCheck.details.wordCount} (need 800+), ` +
            `links=${qualityCheck.details.linkCount} (need 5+), ` +
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

        console.log(`[${week}] Quality checks passed ✓`);
        return qualityCheck;
      });

      // ─────────────────────────────────────────────────────────────
      // STEP 4: Create draft in Beehiiv
      // ─────────────────────────────────────────────────────────────
      const beehiivResult = await step.run('publish-to-beehiiv', async () => {
        if (DRY_RUN) {
          console.log(`[${week}] DRY RUN: Would create Beehiiv draft`);
          console.log(`  Title: ${draft.title}`);
          console.log(`  Subtitle: ${draft.subtitle}`);
          console.log(`  Words: ${validation.details.wordCount}`);
          return { id: 'dry-run', web_url: 'https://app.beehiiv.com/dry-run' };
        }

        console.log(`[${week}] Creating Beehiiv draft...`);
        const result = await createBeehiivDraft({
          title: draft.title,
          subtitle: draft.subtitle,
          htmlContent: draft.html_content,
        });

        metadata.beehiivPostId = result.id;
        metadata.beehiivUrl = result.web_url;

        return result;
      });

      // ─────────────────────────────────────────────────────────────
      // STEP 5: Archive to Google Drive (best-effort)
      // ─────────────────────────────────────────────────────────────
      await step.run('archive-to-drive', async () => {
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

      // ─────────────────────────────────────────────────────────────
      // STEP 6: Store metadata
      // ─────────────────────────────────────────────────────────────
      await step.run('store-metadata', async () => {
        console.log(`[${week}] Storing metadata...`);
        saveDraft(metadata as DraftMetadata);
      });

      // ─────────────────────────────────────────────────────────────
      // STEP 7: Send success notification
      // ─────────────────────────────────────────────────────────────
      await step.run('send-notification', async () => {
        console.log(`[${week}] Sending notification...`);
        await sendNotification({
          success: true,
          title: draft.title,
          beehiivUrl: beehiivResult.web_url,
          weekDescription,
          inngestRunUrl: `https://app.inngest.com/runs/${event.id}`,
        });
      });

      console.log(`[${week}] ✅ Newsletter generation complete!`);
      return {
        success: true,
        week,
        title: draft.title,
        dryRun: DRY_RUN,
        beehiivUrl: beehiivResult.web_url,
      };

    } catch (error) {
      console.error(`[${week}] ❌ Newsletter generation failed:`, error);

      await step.run('send-failure-notification', async () => {
        await sendNotification({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          failedStep: 'See Inngest dashboard',
          weekDescription,
          inngestRunUrl: `https://app.inngest.com/runs/${event.id}`,
        });
      });

      throw error;
    }
  }
);
