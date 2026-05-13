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
    return [];
  }

  // Fetch full message details for each email
  const emails: EmailItem[] = [];

  for (const msg of searchResult.messages.slice(0, 8)) {
    try {
      const detail = await gmailRequest<{
        id: string;
        threadId: string;
        snippet: string;
        payload: {
          headers: Array<{ name: string; value: string }>;
          internalDate: string;
        };
      }>(token, `/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);

      const headers = detail.payload.headers;
      const fromHeader = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const subjectHeader = headers.find(h => h.name === 'Subject')?.value || 'No Subject';

      // Extract email address from "Name <email>" or plain email format
      const fromMatch = fromHeader.match(/<?([^<>]+@[^<>]+)>?/);
      const from = fromMatch ? fromMatch[1] : fromHeader;

      const timestamp = parseInt(detail.payload.internalDate);
      const date = isNaN(timestamp) ? new Date().toISOString() : new Date(timestamp).toISOString();

      emails.push({
        id: detail.id,
        threadId: detail.threadId,
        snippet: detail.snippet,
        from,
        subject: subjectHeader,
        date,
      });
    } catch (err) {
      console.warn(`Failed to fetch email ${msg.id}:`, err);
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
Preview: ${email.snippet}`;
  }).join('\n\n');
}
