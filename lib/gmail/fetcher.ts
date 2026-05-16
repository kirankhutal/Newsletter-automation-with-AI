// lib/gmail/fetcher.ts
// Direct Gmail API fetch via OAuth 2.0 refresh token — no MCP required

import { getGoogleAccessToken } from '../auth/google';

export interface EmailItem {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  body: string;
}

// ── Helper: recursively extract text body from a message payload ─────────────
function extractBody(payload: {
  body?: { data?: string };
  parts?: Array<{
    mimeType: string;
    body?: { data?: string };
    parts?: unknown[];
  }>;
}): string | null {
  if (!payload) return null;

  // Direct body data
  if (payload.body?.data) {
    try {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  // Multipart — recurse into parts
  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      const mimeType = (part as { mimeType: string }).mimeType;
      if (mimeType === 'text/plain') {
        const data = (part as { body?: { data?: string } }).body?.data;
        if (data) {
          try {
            return Buffer.from(data, 'base64').toString('utf-8');
          } catch {
            return null;
          }
        }
      }
      // Recurse into nested multipart
      const nested = extractBody(part as Parameters<typeof extractBody>[0]);
      if (nested) return nested;
    }
    // Fall back to first text part if no plain text found
    for (const part of payload.parts) {
      const nested = extractBody(part as Parameters<typeof extractBody>[0]);
      if (nested) return nested;
    }
  }

  return null;
}

async function gmailRequest<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Gmail API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchRelevantEmails(): Promise<EmailItem[]> {
  const token = await getGoogleAccessToken();

  // Calculate date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const afterDate = sevenDaysAgo.toISOString().split('T')[0];

  // Search for matching emails
  const searchQuery = encodeURIComponent(
    `(AI OR "artificial intelligence" OR fintech OR banking OR LLM OR "machine learning") after:${afterDate}`
  );

  const searchResult = await gmailRequest<{ messages: Array<{ id: string; threadId: string }> }>(
    token,
    `/users/me/messages?q=${searchQuery}&maxResults=10`
  );

  if (!searchResult.messages || searchResult.messages.length === 0) {
    console.log('[Gmail] No emails found matching query');
    return [];
  }

  console.log(`[Gmail] Found ${searchResult.messages.length} matching emails`);

  // Fetch full message details for each email (includes body)
  const emails: EmailItem[] = [];

  for (const msg of searchResult.messages.slice(0, 8)) {
    try {
      // Use format=full to get the complete message including body
      const detail = await gmailRequest<{
        id: string;
        threadId: string;
        snippet: string;
        payload: {
          headers: Array<{ name: string; value: string }>;
          internalDate: string;
          body?: { data?: string };
          parts?: Array<{
            mimeType: string;
            body?: { data?: string };
            parts?: unknown[];
          }>;
        };
      }>(token, `/users/me/messages/${msg.id}?format=full`);

      const headers = detail.payload.headers;
      const fromHeader = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const subjectHeader = headers.find(h => h.name === 'Subject')?.value || 'No Subject';

      // Extract email address from "Name <email>" or plain email format
      const fromMatch = fromHeader.match(/<?([^<>]+@[^<>]+)>?/);
      const from = fromMatch ? fromMatch[1] : fromHeader;

      const timestamp = parseInt(detail.payload.internalDate);
      const date = isNaN(timestamp) ? new Date().toISOString() : new Date(timestamp).toISOString();

      // Extract full body text
      const rawBody = extractBody(detail.payload) || detail.snippet;

      // Clean body: strip excessive whitespace and truncate to 2000 chars per email
      const body = rawBody.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);

      console.log(`[Gmail] Fetched email: "${subjectHeader}" — body length: ${body.length} chars`);

      emails.push({
        id: detail.id,
        threadId: detail.threadId,
        snippet: detail.snippet,
        from,
        subject: subjectHeader,
        date,
        body,
      });
    } catch (err) {
      console.warn(`[Gmail] Failed to fetch email ${msg.id}:`, err);
    }
  }

  return emails;
}

export function formatEmailsForLLM(emails: EmailItem[]): string {
  if (emails.length === 0) {
    return '[No emails found in the past 7 days — use your own knowledge of this week\'s AI in finance news to draft the newsletter. Do not refuse and do not ask for more input.]';
  }

  return emails.map((email, i) => {
    const date = new Date(email.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `[Email ${i + 1}]
From: ${email.from}
Subject: ${email.subject}
Date: ${date}
Body: ${email.body}`;
  }).join('\n\n');
}
