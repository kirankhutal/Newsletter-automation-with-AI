import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateNewsletter } from './client';

describe('LLM Client', () => {
  beforeEach(() => {
    vi.stubEnv('LLM_API_URL', 'https://api.example.com/v1/chat/completions');
    vi.stubEnv('LLM_API_KEY', 'test-key');
    vi.stubEnv('LLM_MODEL', 'test-model');
  });

  it('returns parsed JSON with title, subtitle, and html_content', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            title: 'Test Title',
            subtitle: 'Test subtitle here',
            html_content: '<h2>Test</h2><p>Content</p>'
          })
        }
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await generateNewsletter({
      skillPrompt: 'You are an editor.',
      emailContent: 'Some email content',
      previousTitle: '',
      previousSubtitle: '',
    });

    expect(result).toHaveProperty('title', 'Test Title');
    expect(result).toHaveProperty('subtitle', 'Test subtitle here');
    expect(result).toHaveProperty('html_content');
    expect(typeof result.html_content).toBe('string');
  });

  it('throws error when API returns non-OK status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    } as Response);

    await expect(generateNewsletter({
      skillPrompt: 'Test',
      emailContent: 'Test',
      previousTitle: '',
      previousSubtitle: '',
    })).rejects.toThrow('LLM API error: 500');
  });
});
