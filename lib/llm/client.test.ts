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

  it('passes abort signal to fetch and uses 60s timeout', async () => {
    // Mock AbortController to capture the signal
    const mockAbort = vi.fn();
    let capturedSignal: AbortSignal | null = null;

    class MockAbortController {
      signal = {
        aborted: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
      abort = mockAbort;
    }

    // Also capture the timeout
    let capturedTimeout: ReturnType<typeof setTimeout> | null = null;
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;

    global.setTimeout = vi.fn((callback: Function, ms: number) => {
      capturedTimeout = originalSetTimeout(callback, ms);
      return capturedTimeout;
    });

    global.clearTimeout = vi.fn((id: ReturnType<typeof setTimeout>) => {
      originalClearTimeout(id);
    });

    // Mock fetch to capture the signal option
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Test Title',
              subtitle: 'Test subtitle here',
              html_content: '<h2>Test</h2><p>Content</p>'
            })
          }
        }]
      }),
    } as Response);

    // Replace AbortController with our mock
    const originalAbortController = global.AbortController;
    global.AbortController = MockAbortController as unknown as typeof AbortController;

    await generateNewsletter({
      skillPrompt: 'Test',
      emailContent: 'Test',
      previousTitle: '',
      previousSubtitle: '',
    });

    // Verify fetch was called with signal option
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.any(Object)
      })
    );

    // Verify setTimeout was called with 60 seconds
    expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 60_000);

    // Restore
    global.AbortController = originalAbortController;
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  it('throws error when LLM returns invalid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'not valid json {'
          }
        }]
      }),
    } as Response);

    await expect(generateNewsletter({
      skillPrompt: 'Test',
      emailContent: 'Test',
      previousTitle: '',
      previousSubtitle: '',
    })).rejects.toThrow('LLM returned invalid JSON');
  });
});
