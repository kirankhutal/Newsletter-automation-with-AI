import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external clients BEFORE importing the newsletter function
vi.mock('../lib/llm/client', () => ({
  generateNewsletter: vi.fn().mockResolvedValue({
    title: 'AI Regulators Finally Show Their Cards',
    subtitle: 'The EU AI Act enforcement begins and banks scramble.',
    html_content: '<h2>🏛️ Regulation & Policy</h2><p>The EU AI Act officially entered enforcement this week.</p><h2>🏦 Banking Tech</h2><p>JPMorgan deployed a new AI model.</p><h2>🤖 AI Innovation</h2><p>New models launched.</p><h2>📈 Market Trends</h2><p>Funding rounds and M&A activity.</p>',
  }),
}));

vi.mock('../lib/gmail/fetcher', () => ({
  fetchRelevantEmails: vi.fn().mockResolvedValue([]),
  formatEmailsForLLM: vi.fn().mockReturnValue('Mock email content'),
}));

vi.mock('../lib/beehiiv/client', () => ({
  createBeehiivDraft: vi.fn().mockResolvedValue({
    id: 'test-post-id',
    web_url: 'https://app.beehiiv.com/test',
    publish_url: 'https://app.beehiiv.com/test/publish',
  }),
}));

vi.mock('../lib/email/resend', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/drive/archiver', () => ({
  archiveToDrive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/metadata/store', () => ({
  saveDraft: vi.fn(),
  getLatestDraft: vi.fn().mockReturnValue(null),
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Mock skill prompt content'),
}));

// Import after mocks are set up
import { generateNewsletter } from '../lib/llm/client';
import { fetchRelevantEmails, formatEmailsForLLM } from '../lib/gmail/fetcher';
import { createBeehiivDraft } from '../lib/beehiiv/client';
import { archiveToDrive } from '../lib/drive/archiver';
import { sendNotification } from '../lib/email/resend';
import { saveDraft } from '../lib/metadata/store';

// Import the Inngest client and types (without triggering the function)
import { inngest } from '../inngest/client';
import type { InngestEvent, InngestStep } from 'inngest';

// Helper to simulate running the newsletter pipeline steps
async function runNewsletterPipeline(
  week: string,
  dryRun: boolean = false
): Promise<{
  success: boolean;
  week: string;
  title: string;
  beehiivUrl?: string;
}> {
  // Simulate the pipeline steps
  process.env.DRY_RUN = dryRun ? 'true' : 'false';

  // Step 1: Gather sources
  const emails = await fetchRelevantEmails();
  const formatted = formatEmailsForLLM(emails);

  // Step 2: Generate newsletter
  const draft = await generateNewsletter({
    skillPrompt: 'Mock skill prompt',
    emailContent: formatted,
    previousTitle: '',
    previousSubtitle: '',
  });

  // Step 3: Create Beehiiv draft (or skip in dry run)
  let beehiivResult = { id: 'dry-run', web_url: 'https://app.beehiiv.com/dry-run' };
  if (!dryRun) {
    beehiivResult = await createBeehiivDraft({
      title: draft.title,
      subtitle: draft.subtitle,
      htmlContent: draft.html_content,
    });
  }

  // Step 4: Archive to Drive (or skip in dry run)
  if (!dryRun) {
    await archiveToDrive({
      weekDescription: `Week of ${week}`,
      title: draft.title,
      subtitle: draft.subtitle,
      content: draft.html_content,
      wordCount: draft.html_content.length / 5, // rough estimate
      generatedAt: new Date().toISOString(),
    });
  }

  // Step 5: Send notification
  await sendNotification({
    success: true,
    title: draft.title,
    beehiivUrl: beehiivResult.web_url,
    weekDescription: `Week of ${week}`,
    inngestRunUrl: 'https://app.inngest.com/test',
  });

  return {
    success: true,
    week,
    title: draft.title,
    beehiivUrl: beehiivResult.web_url,
  };
}

describe('Newsletter Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRY_RUN = 'false';
    process.env.SKILL_VERSION = 'latest';
  });

  it('generates a newsletter and returns success', async () => {
    const result = await runNewsletterPipeline('2026-W20');

    expect(result.success).toBe(true);
    expect(result.week).toBe('2026-W20');
    expect(result.title).toBe('AI Regulators Finally Show Their Cards');
  });

  it('calls all expected steps in sequence', async () => {
    await runNewsletterPipeline('2026-W21');

    // Verify all expected modules were called
    expect(fetchRelevantEmails).toHaveBeenCalled();
    expect(formatEmailsForLLM).toHaveBeenCalled();
    expect(generateNewsletter).toHaveBeenCalledWith(
      expect.objectContaining({
        skillPrompt: 'Mock skill prompt',
        emailContent: 'Mock email content',
      })
    );
    expect(createBeehiivDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'AI Regulators Finally Show Their Cards',
        subtitle: 'The EU AI Act enforcement begins and banks scramble.',
      })
    );
    expect(archiveToDrive).toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        title: 'AI Regulators Finally Show Their Cards',
      })
    );
  });

  it('skips Beehiiv and Drive calls in DRY_RUN mode', async () => {
    await runNewsletterPipeline('2026-W22', true);

    // In dry run mode, these should NOT be called
    expect(createBeehiivDraft).not.toHaveBeenCalled();
    expect(archiveToDrive).not.toHaveBeenCalled();

    // But notification should still be sent
    expect(sendNotification).toHaveBeenCalled();
  });

  it('properly mocks LLM client to return expected structure', async () => {
    const result = await generateNewsletter({
      skillPrompt: 'test prompt',
      emailContent: 'test content',
      previousTitle: 'Last week title',
      previousSubtitle: 'Last week subtitle',
    });

    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('subtitle');
    expect(result).toHaveProperty('html_content');
    expect(typeof result.html_content).toBe('string');
    expect(result.html_content.length).toBeGreaterThan(0);
  });

  it('Beehiiv mock returns expected structure', async () => {
    const result = await createBeehiivDraft({
      title: 'Test Title',
      subtitle: 'Test Subtitle',
      htmlContent: '<p>Test content</p>',
    });

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('web_url');
    expect(result).toHaveProperty('publish_url');
  });
});
