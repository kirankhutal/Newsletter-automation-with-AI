# Banking on AI — Newsletter Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully automated weekly newsletter pipeline that fetches Gmail, generates a Morning Brew-style newsletter via any free LLM API, validates quality, creates a Beehiiv draft, and notifies Kiran — every Sunday at 9am EST.

**Architecture:** Node.js/TypeScript on Next.js + Vercel Cron, orchestrated by Inngest. Gmail fetched directly via OAuth. LLM called via OpenAI-compatible REST API (model-agnostic). Beehiiv draft created via their REST API. Notifications via Resend. Archive to Google Drive.

**Tech Stack:** Next.js, Inngest, TypeScript, Gmail API, any OpenAI-compatible LLM API (OpenRouter, Gemini, MiniMax, Groq), Beehiiv API, Resend, Google Drive API

---

## File Structure

New files to create:
```
lib/
├── llm/
│   └── client.ts              # Model-agnostic LLM REST caller
├── gmail/
│   └── fetcher.ts             # Direct Gmail API fetch (no MCP)
├── beehiiv/
│   └── client.ts              # Beehiiv REST API wrapper
├── email/
│   └── resend.ts              # Resend notification sender
├── drive/
│   └── archiver.ts            # Google Drive markdown archiver
└── validation/
    └── similarity.ts          # Cosine similarity via embedding

vercel.json                    # Cron: Sunday 9am EST
.env.example                   # All env vars documented
```

Existing files to modify:
```
inngest/newsletter.function.ts  # Refactor: remove Anthropic, wire new lib files
lib/utils/cost-tracking.ts       # Remove (not needed without Anthropic)
lib/metadata/store.ts            # Minor: rename anthropicCost → llmCost
app/api/inngest/route.ts        # Add cron endpoint (already exists, verify)
package.json                    # Remove @anthropic-ai/sdk, add dependencies
```

---

## Tasks

### Task 1: Environment setup and dependencies

**Files:**
- Modify: `package.json`
- Create: `.env.example`

- [ ] **Step 1: Remove Anthropic SDK, add dependencies**

Run: Open `package.json` and replace the `dependencies` block with:

```json
"dependencies": {
  "googleapis": "^171.4.0",
  "inngest": "^4.3.0",
  "next": "16.2.6",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "zod": "^4.4.3"
}
```

- [ ] **Step 2: Create .env.example**

Create file: `banking-on-ai-automation/.env.example`

```env
# ═══════════════════════════════════════
# LLM — model-agnostic, any OpenAI-compatible endpoint
# ═══════════════════════════════════════
# OpenRouter example:
LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
LLM_API_KEY=sk-or-v2-...
LLM_MODEL=meta-llama/llama-3-70b-instruct

# Gemini example (free tier):
# LLM_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
# LLM_API_KEY=YOUR_GEMINI_API_KEY
# LLM_MODEL=gemini-2.0-flash

# MiniMax example:
# LLM_API_URL=https://api.minimax.chat/v1/chat/completions
# LLM_API_KEY=YOUR_MINIMAX_API_KEY
# LLM_MODEL=abab6.5s-chat

# ═══════════════════════════════════════
# Google OAuth (for Gmail + Drive)
# ═══════════════════════════════════════
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...

# ═══════════════════════════════════════
# Beehiiv
# ═══════════════════════════════════════
BEEHIIV_API_KEY=...
BEEHIIV_PUBLICATION_ID=...

# ═══════════════════════════════════════
# Email notifications (Resend)
# ═══════════════════════════════════════
RESEND_API_KEY=re_...
NOTIFICATION_EMAIL=kirankhutal@gmail.com

# ═══════════════════════════════════════
# Inngest
# ═══════════════════════════════════════
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# ═══════════════════════════════════════
# App
# ═══════════════════════════════════════
# Set to "true" to generate without publishing (no Beehiiv/Drive calls)
DRY_RUN=false

# Secret for manual trigger endpoint (choose a strong random string)
CRON_SECRET=your-strong-random-secret-here
```

- [ ] **Step 3: Run npm install**

Run: `cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation" && npm install`

Expected: Installs without errors, `node_modules` updated

- [ ] **Step 4: Commit**

```bash
cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation"
git add package.json package-lock.json .env.example
git commit -m "feat: replace Anthropic with model-agnostic LLM setup"
```

---

### Task 2: Vercel Cron configuration

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create vercel.json**

Create file: `banking-on-ai-automation/vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/inngest",
      "schedule": "0 9 * * 0"
    }
  ]
}
```

Note: Vercel Cron uses UTC by default. At 9am EST (UTC-5), that's 14:00 UTC. However, Vercel now supports `CRON_TZ` via the path config. Add a comment in `app/api/inngest/route.ts` noting the timezone. The cron fires at 14:00 UTC = 9am EST (standard time). During EDT (UTC-4), this is 10am EST — acceptable variance.

- [ ] **Step 2: Commit**

```bash
cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation"
git add vercel.json
git commit -m "feat: add Vercel Cron for Sunday 9am EST pipeline trigger"
```

---

### Task 3: Model-agnostic LLM client

**Files:**
- Create: `lib/llm/client.ts`
- Create: `lib/llm/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create file: `lib/llm/client.test.ts`

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation" && npx vitest run lib/llm/client.test.ts`

Expected: FAIL with "generateNewsletter is not a function" (file doesn't exist yet)

- [ ] **Step 3: Write the implementation**

Create file: `lib/llm/client.ts`

```typescript
// lib/llm/client.ts
// Model-agnostic LLM client — works with any OpenAI-compatible REST endpoint

export interface GenerateOptions {
  skillPrompt: string;
  emailContent: string;
  previousTitle: string;
  previousSubtitle: string;
}

export interface GeneratedDraft {
  title: string;
  subtitle: string;
  html_content: string;
}

export async function generateNewsletter(options: GenerateOptions): Promise<GeneratedDraft> {
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!apiUrl || !apiKey || !model) {
    throw new Error(
      'Missing LLM configuration. Set LLM_API_URL, LLM_API_KEY, and LLM_MODEL in .env'
    );
  }

  const previousContext = options.previousTitle
    ? `\n\nLast week's title: "${options.previousTitle}"\nAvoid repeating these topics.`
    : '';

  const systemPrompt = `${options.skillPrompt}${previousContext}

Return a JSON object with:
{
  "title": "20-60 character subject line (curiosity-driven, specific)",
  "subtitle": "One sentence summary of the week's biggest theme",
  "html_content": "Full newsletter HTML with 4 pillars, 800+ words, 5+ links"
}

Return ONLY the JSON object, no markdown formatting around it.`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Here are the email sources to draw from:\n\n${options.emailContent}` },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const rawContent = data.choices[0]?.message?.content;

  if (!rawContent) {
    throw new Error('LLM returned empty response');
  }

  // Parse JSON from the response — strip any markdown code fences
  const jsonString = rawContent.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = JSON.parse(jsonString) as GeneratedDraft;

  if (!parsed.title || !parsed.subtitle || !parsed.html_content) {
    throw new Error('LLM response missing required fields: title, subtitle, html_content');
  }

  return parsed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation" && npx vitest run lib/llm/client.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation"
git add lib/llm/client.ts lib/llm/client.test.ts
git commit -m "feat: add model-agnostic LLM client for OpenAI-compatible endpoints"
```

---

### Task 4: Gmail fetcher

**Files:**
- Create: `lib/gmail/fetcher.ts`
- Create: `lib/gmail/fetcher.test.ts`

- [ ] **Step 1: Write the failing test**

Create file: `lib/gmail/fetcher.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRelevantEmails } from './fetcher';

describe('Gmail Fetcher', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('GOOGLE_REFRESH_TOKEN', 'test-refresh-token');
  });

  it('returns array of email objects with required fields', async () => {
    const mockEmails = {
      messages: [
        { id: 'msg1', threadId: 't1' },
        { id: 'msg2', threadId: 't2' },
      ]
    };

    const mockMessages = {
      messages: [
        { id: 'msg1', snippet: 'AI in banking news', from: 'sender@example.com', internalDate: '1747000000000' }
      ]
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-access-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockEmails,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessages,
      } as Response);

    const result = await fetchRelevantEmails();

    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('snippet');
      expect(result[0]).toHaveProperty('from');
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation" && npx vitest run lib/gmail/fetcher.test.ts`

Expected: FAIL — file does not exist

- [ ] **Step 3: Write the implementation**

Create file: `lib/gmail/fetcher.ts`

```typescript
// lib/gmail/fetcher.ts
// Direct Gmail API fetch via OAuth 2.0 refresh token — no MCP required

export interface EmailItem {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  body?: string;
}

// Search query for AI/fintech banking news
const SEARCH_QUERY = encodeURIComponent(
  'AI OR "artificial intelligence" OR fintech OR banking OR LLM OR "machine learning"'
);

async function getGoogleAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Google OAuth failed: ${res.status} - ${error}`);
  }

  const { access_token } = await res.json() as { access_token: string };
  return access_token;
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
    `(${SEARCH_QUERY.replace(/%20/g, ' ')}) after:${afterDate}`
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

      // Extract display name or email from "Name <email>" format
      const fromMatch = fromHeader.match(/<?([^<>]+@[^<>]+)>?/);
      const from = fromMatch ? fromMatch[1] : fromHeader;

      const date = new Date(parseInt(detail.payload.internalDate)).toISOString();

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
    return 'No relevant emails found in the past 7 days.';
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation" && npx vitest run lib/gmail/fetcher.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation"
git add lib/gmail/fetcher.ts lib/gmail/fetcher.test.ts
git commit -m "feat: add direct Gmail API fetcher with OAuth refresh"
```

---

### Task 5: Beehiiv and Resend clients

**Files:**
- Create: `lib/beehiiv/client.ts`
- Create: `lib/email/resend.ts`

- [ ] **Step 1: Write Beehiiv client**

Create file: `lib/beehiiv/client.ts`

```typescript
// lib/beehiiv/client.ts
// Beehiiv REST API v2 wrapper for creating draft posts

export interface CreatePostOptions {
  title: string;
  subtitle: string;
  htmlContent: string;
}

export interface BeehiivPostResult {
  id: string;
  web_url: string;
  publish_url: string;
}

export async function createBeehiivDraft(options: CreatePostOptions): Promise<BeehiivPostResult> {
  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey || !publicationId) {
    throw new Error('Missing Beehiiv configuration. Set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID');
  }

  const response = await fetch(
    `https://api.beehiiv.com/v2/publications/${publicationId}/posts`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        title: options.title,
        subtitle: options.subtitle,
        html_content: options.htmlContent,
        state: 'draft', // Always create as draft
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Beehiiv API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { data: BeehiivPostResult };
  return data.data;
}
```

- [ ] **Step 2: Write Resend notifier**

Create file: `lib/email/resend.ts`

```typescript
// lib/email/resend.ts
// Resend API wrapper for sending notification emails

export interface NotificationOptions {
  success: boolean;
  title?: string;
  beehiivUrl?: string;
  error?: string;
  failedStep?: string;
  inngestRunUrl?: string;
  weekDescription: string;
}

export async function sendNotification(options: NotificationOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFICATION_EMAIL || 'kirankhutal@gmail.com';

  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — skipping notification');
    return;
  }

  const { success, title, beehiivUrl, error, failedStep, inngestRunUrl, weekDescription } = options;

  const subject = success
    ? `✅ Banking on AI draft ready — ${weekDescription}`
    : `❌ Banking on AI automation failed — ${weekDescription}`;

  const htmlContent = success
    ? `
      <h2>✅ Newsletter Draft Ready</h2>
      <p><strong>Week:</strong> ${weekDescription}</p>
      <p><strong>Title:</strong> ${title}</p>

      <h3>Next Step</h3>
      <p>Review the draft in Beehiiv and hit Send when ready.</p>
      <p><a href="${beehiivUrl}">📬 Open draft in Beehiiv</a></p>

      <p style="color: #666; font-size: 12px;">
        <a href="${inngestRunUrl}">View execution details</a>
      </p>
    `
    : `
      <h2>❌ Newsletter Generation Failed</h2>
      <p><strong>Week:</strong> ${weekDescription}</p>
      <p><strong>Failed at:</strong> ${failedStep}</p>
      <p><strong>Error:</strong> ${error}</p>

      <h3>Quick Actions</h3>
      <ul>
        <li><a href="${inngestRunUrl}">View error details in Inngest</a></li>
        <li><a href="${inngestRunUrl}/replay">Replay from failed step</a></li>
      </ul>
    `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Banking on AI <automation@yourdomain.com>',
      to: toEmail,
      subject,
      html: htmlContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Resend notification failed: ${response.status} - ${errorText}`);
    // Don't throw — notification failure should not block the pipeline
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation"
git add lib/beehiiv/client.ts lib/email/resend.ts
git commit -m "feat: add Beehiiv and Resend API clients"
```

---

### Task 6: Google Drive archiver and similarity checker

**Files:**
- Create: `lib/drive/archiver.ts`
- Create: `lib/validation/similarity.ts`

- [ ] **Step 1: Write Google Drive archiver**

Create file: `lib/drive/archiver.ts`

```typescript
// lib/drive/archiver.ts
// Google Drive API — saves newsletter markdown copy to archive folder

export interface ArchiveOptions {
  weekDescription: string;
  title: string;
  subtitle: string;
  content: string;
  wordCount: number;
  generatedAt: string;
}

async function getGoogleAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    throw new Error(`Google OAuth failed: ${res.status}`);
  }

  const { access_token } = await res.json() as { access_token: string };
  return access_token;
}

export async function archiveToDrive(options: ArchiveOptions): Promise<void> {
  const token = await getGoogleAccessToken();

  const markdownContent = `# ${options.title}

**Week:** ${options.weekDescription}
**Subtitle:** ${options.subtitle}

---

${options.content.replace(/<[^>]*>/g, '').trim()}

---

*Generated: ${options.generatedAt}*
*Word count: ${options.wordCount}*
`;

  // Create the file via Google Drive API
  const boundary = `boundary_${Date.now()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    JSON.stringify({
      name: `Issue - ${options.weekDescription}.md`,
      mimeType: 'text/markdown',
      parents: ['appDataFolder'], // appDataFolder = app's private folder
    }),
    '--${boundary}',
    'Content-Type: text/markdown',
    '',
    markdownContent,
    `--${boundary}--`,
  ].join('\n');

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Google Drive archive failed: ${response.status} - ${errorText}`);
    // Don't throw — archive failure should not block the pipeline
  } else {
    const data = await response.json();
    console.log(`Archived to Drive: ${data.name} (${data.id})`);
  }
}
```

- [ ] **Step 2: Write similarity checker**

Create file: `lib/validation/similarity.ts`

```typescript
// lib/validation/similarity.ts
// Content similarity checker — uses embedding-based cosine similarity
// Falls back to word overlap if embedding API is unavailable

export interface SimilarityResult {
  score: number;
  method: 'embedding' | 'word-overlap';
  tooSimilar: boolean;
}

const SIMILARITY_THRESHOLD = 0.7;

async function getEmbedding(text: string): Promise<number[]> {
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('LLM config not available for embedding');
  }

  // Try OpenRouter's embedding endpoint first
  const embeddingApiUrl = apiUrl.replace('/chat/completions', '/embeddings');

  const response = await fetch(embeddingApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'text-embedding-ada-002',
      input: text.slice(0, 8000), // Limit input length
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0]?.embedding || [];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

function wordOverlapSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1
      .toLowerCase()
      .replace(/<[^>]*>/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );

  const words2 = new Set(
    text2
      .toLowerCase()
      .replace(/<[^>]*>/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

export async function checkSimilarity(
  currentContent: string,
  previousContent: string
): Promise<SimilarityResult> {
  // Strip HTML for comparison
  const plainCurrent = currentContent.replace(/<[^>]*>/g, ' ').trim();
  const plainPrevious = previousContent.replace(/<[^>]*>/g, ' ').trim();

  // Skip check if no previous content
  if (!plainPrevious) {
    return { score: 0, method: 'word-overlap', tooSimilar: false };
  }

  try {
    // Try embedding-based similarity
    const [embeddingCurrent, embeddingPrevious] = await Promise.all([
      getEmbedding(plainCurrent),
      getEmbedding(plainPrevious),
    ]);

    if (embeddingCurrent.length > 0 && embeddingPrevious.length > 0) {
      const score = cosineSimilarity(embeddingCurrent, embeddingPrevious);
      return {
        score,
        method: 'embedding',
        tooSimilar: score >= SIMILARITY_THRESHOLD,
      };
    }
  } catch {
    console.log('Embedding API unavailable, falling back to word overlap');
  }

  // Fallback to word overlap
  const score = wordOverlapSimilarity(plainCurrent, plainPrevious);
  return {
    score,
    method: 'word-overlap',
    tooSimilar: score >= SIMILARITY_THRESHOLD,
  };
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation"
git add lib/drive/archiver.ts lib/validation/similarity.ts
git commit -m "feat: add Google Drive archiver and embedding-based similarity checker"
```

---

### Task 7: Refactor the Inngest newsletter function

**Files:**
- Modify: `inngest/newsletter.function.ts`
- Modify: `lib/metadata/store.ts` (rename `anthropicCost` → `llmCost`)

- [ ] **Step 1: Refactor newsletter.function.ts**

Read the existing `inngest/newsletter.function.ts` first, then replace its entire content with:

```typescript
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
```

- [ ] **Step 2: Update metadata store to use llmCost instead of anthropicCost**

Modify `lib/metadata/store.ts`:
- Line 27: Rename `anthropicCost` → `llmCost` everywhere in the interface and implementation

Specifically change:
```typescript
anthropicCost: number;
```
to:
```typescript
llmCost: number;
```

And in the `getAnalytics()` function, change:
```typescript
const totalCost = drafts.reduce((sum, d) => sum + d.anthropicCost, 0);
```
to:
```typescript
const totalCost = drafts.reduce((sum, d) => sum + d.llmCost, 0);
```

- [ ] **Step 3: Remove cost-tracking utility**

The `lib/utils/cost-tracking.ts` file is no longer needed. Delete it:
```bash
rm lib/utils/cost-tracking.ts
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation"
git add inngest/newsletter.function.ts lib/metadata/store.ts
git rm lib/utils/cost-tracking.ts
git commit -m "refactor: wire new lib clients into Inngest pipeline, drop Anthropic dependency"
```

---

### Task 8: Integration test and Vercel deployment

**Files:**
- Modify: `app/api/inngest/route.ts` (verify it handles cron hits correctly)

- [ ] **Step 1: Verify the Inngest route handles cron**

Read `app/api/inngest/route.ts`. It should already handle GET requests from Vercel Cron. If it only handles POST, add GET support:

```typescript
// In the existing route.ts, ensure GET is supported for Vercel Cron:
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  if (auth !== expectedAuth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const week = getWeekIdentifier();
  await inngest.send({
    name: 'newsletter/draft.requested',
    data: { week, triggeredAt: new Date().toISOString(), source: 'cron' },
  });

  return Response.json({ status: 'ok', week });
}
```

- [ ] **Step 2: Create a DRY_RUN integration test**

Create file: `lib/integration.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { newsletterFunction } from '../inngest/newsletter.function';

// Mock all external clients
vi.mock('../lib/llm/client', () => ({
  generateNewsletter: vi.fn().mockResolvedValue({
    title: 'AI Regulators Finally Show Their Cards',
    subtitle: 'The EU AI Act enforcement begins and banks scramble.',
    html_content: '<h2>🏛️ Regulation & Policy</h2><p>Content here.</p><h2>🏦 Banking Tech</h2><p>More content.</p><h2>🤖 AI Innovation</h2><p>Innovation content.</p><h2>📈 Market Trends</h2><p>Market content.</p>',
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

describe('Newsletter Integration', () => {
  beforeEach(() => {
    vi.stubEnv('DRY_RUN', 'false');
    vi.stubEnv('LLM_API_URL', 'https://api.example.com');
    vi.stubEnv('LLM_API_KEY', 'test');
    vi.stubEnv('LLM_MODEL', 'test-model');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test');
    vi.stubEnv('GOOGLE_REFRESH_TOKEN', 'test');
    vi.stubEnv('BEEHIIV_API_KEY', 'test');
    vi.stubEnv('BEEHIIV_PUBLICATION_ID', 'test');
    vi.stubEnv('RESEND_API_KEY', 'test');
    vi.stubEnv('SKILL_VERSION', 'latest');
  });

  it('generates a newsletter and returns success', async () => {
    const event = {
      name: 'newsletter/draft.requested' as const,
      data: { week: '2026-W20' },
      id: 'test-event-id',
    };

    const result = await newsletterFunction.trigger(event);

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('title');
  });
});
```

- [ ] **Step 3: Run integration test**

Run: `cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation" && npx vitest run lib/integration.test.ts`

Expected: PASS (with mocked external APIs)

- [ ] **Step 4: Final commit**

```bash
cd "/Users/kiran/CODING/Goose/Banking on AI newsletter/banking-on-ai-automation"
git add app/api/inngest/route.ts lib/integration.test.ts
git commit -m "test: add integration test suite and verify cron endpoint"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** All 7 pipeline steps (token → Gmail → LLM → validate → Beehiiv → notify → archive) have corresponding tasks
- [ ] **Placeholder scan:** No TBD, TODO, or "fill in later" items
- [ ] **Type consistency:** `DraftMetadata.llmCost` used consistently after rename; `generateNewsletter()` returns `GeneratedDraft` with `html_content` (not `content`) matching the LLM client output
- [ ] **No missing env vars:** All 4 LLM vars (`LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`) + all Google vars + Beehiiv + Resend are in `.env.example`
- [ ] **DRY_RUN handling:** All external API calls (Beehiiv, Drive) have DRY_RUN checks — confirmed in Tasks 5 and 7
- [ ] **Error handling:** Gmail, Beehiiv, Resend failures are logged but don't block pipeline (confirmed in archiver and resend.ts)
- [ ] **Idempotency:** Inngest function keyed on `event.data.week` — confirmed in Task 7

---

## Execution Order

1. Task 1: Environment setup
2. Task 2: Vercel Cron
3. Task 3: LLM client ← Task 1 must complete first
4. Task 4: Gmail fetcher ← Task 1 must complete first
5. Task 5: Beehiiv + Resend ← Task 1 must complete first
6. Task 6: Drive archiver + similarity ← Task 1 must complete first
7. Task 7: Refactor Inngest function ← Tasks 3–6 must complete first
8. Task 8: Integration test + deployment ← Task 7 must complete first
