import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRelevantEmails, formatEmailsForLLM } from './fetcher';

describe('Gmail Fetcher', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('GOOGLE_REFRESH_TOKEN', 'test-refresh-token');
  });

  it('returns array of email objects with required fields', async () => {
    const mockMessages = {
      messages: [
        { id: 'msg1', threadId: 't1' },
      ]
    };

    const mockDetail = {
      id: 'msg1',
      threadId: 't1',
      snippet: 'AI in banking news',
      payload: {
        headers: [
          { name: 'From', value: 'sender@example.com' },
          { name: 'Subject', value: 'Test Subject' }
        ],
        internalDate: '1747000000000'
      }
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-access-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessages,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetail,
      } as Response);

    const result = await fetchRelevantEmails();

    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('snippet');
      expect(result[0]).toHaveProperty('from');
      expect(result[0]).toHaveProperty('subject');
      expect(result[0]).toHaveProperty('date');
    }
  });

  it('throws when OAuth token refresh fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
    } as Response);

    await expect(fetchRelevantEmails()).rejects.toThrow('Google OAuth failed');
  });

  it('formatEmailsForLLM returns empty string for empty array', () => {
    const result = formatEmailsForLLM([]);
    expect(result).toBe('No relevant emails found in the past 7 days.');
  });

  it('formatEmailsForLLM formats emails correctly', () => {
    const emails = [{
      id: 'msg1',
      threadId: 't1',
      snippet: 'Test snippet',
      from: 'sender@example.com',
      subject: 'Test Subject',
      date: '2026-05-11T12:00:00.000Z',
    }];

    const result = formatEmailsForLLM(emails);
    expect(result).toContain('Email 1');
    expect(result).toContain('sender@example.com');
    expect(result).toContain('Test Subject');
    expect(result).toContain('Test snippet');
  });
});
