import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runNewsletterHandler } from '../inngest/newsletter.function';

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

vi.mock('../lib/utils/quality-checks', () => ({
  validateContent: vi.fn().mockReturnValue({
    passed: true,
    checks: { wordCount: true, linkCount: true, pillars: true },
    details: { wordCount: 1200, linkCount: 8, foundPillars: ['AI Innovation', 'Banking Tech', 'Regulation', 'Market Trends'] },
  }),
}));

vi.mock('../lib/validation/similarity', () => ({
  checkSimilarity: vi.fn().mockResolvedValue({ score: 0.1, tooSimilar: false, method: 'mock' }),
}));

// Import after mocks are set up
import { generateNewsletter } from '../lib/llm/client';
import { fetchRelevantEmails, formatEmailsForLLM } from '../lib/gmail/fetcher';
import { createBeehiivDraft } from '../lib/beehiiv/client';
import { archiveToDrive } from '../lib/drive/archiver';
import { sendNotification } from '../lib/email/resend';
import { saveDraft } from '../lib/metadata/store';

describe('Newsletter Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRY_RUN = 'false';
    process.env.SKILL_VERSION = 'latest';
  });

  it('generates a newsletter and returns success', async () => {
    const event = {
      data: { week: '2026-W20' },
      id: 'test-event-id',
    };

    const result = await runNewsletterHandler(event);

    expect(result.success).toBe(true);
    expect(result.week).toBe('2026-W20');
    expect(result.title).toBe('AI Regulators Finally Show Their Cards');
  });

  it('calls all expected steps in sequence', async () => {
    const event = {
      data: { week: '2026-W21' },
      id: 'test-event-id-2',
    };

    await runNewsletterHandler(event);

    // Verify all expected modules were called
    expect(fetchRelevantEmails).toHaveBeenCalled();
    expect(formatEmailsForLLM).toHaveBeenCalled();
    expect(generateNewsletter).toHaveBeenCalledWith(
      expect.objectContaining({
        skillPrompt: 'Mock skill prompt content',
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
    expect(saveDraft).toHaveBeenCalled();
  });

  it('skips Beehiiv and Drive calls in DRY_RUN mode', async () => {
    process.env.DRY_RUN = 'true';

    const event = {
      data: { week: '2026-W22' },
      id: 'test-event-id-3',
    };

    await runNewsletterHandler(event);

    // In dry run mode, these should NOT be called
    expect(createBeehiivDraft).not.toHaveBeenCalled();
    expect(archiveToDrive).not.toHaveBeenCalled();

    // But notification should still be sent
    expect(sendNotification).toHaveBeenCalled();
    expect(saveDraft).toHaveBeenCalled();
  });
});
