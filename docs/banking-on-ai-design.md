# Banking on AI — Newsletter Automation Design

**Version:** 1.0
**Date:** 2026-05-11
**Status:** Approved

---

## 1. Overview

**Purpose:** Fully automated weekly newsletter pipeline that drafts, validates, and creates a Beehiiv draft every Sunday at 9am EST — with zero manual intervention.

**Vision:** A hands-off system where the newsletter "just happens" each week. Kiran receives a preview email, reviews in Beehiiv, and hits send himself. Future iteration adds auto-publish on approval.

**Stack:** Next.js + Inngest + Beehiiv + Gmail API + any free LLM API

---

## 2. Architecture

```
Sunday 9am EST
       │
       ▼
┌─────────────────┐
│  Vercel Cron    │
│  (fires event)  │
└────────┬────────┘
         │ POST /api/inngest
         ▼
┌─────────────────┐
│  Inngest Event  │
│  (queued)       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 1: Refresh Google OAuth token                    │
│  (client_id + refresh_token → access_token)           │
└──────────────────────────┬────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Fetch emails from Gmail API                  │
│  Search: AI OR fintech OR banking OR LLM OR ML        │
│  Last 7 days, top 8-10 threads                       │
│  Returns: email IDs + snippets                         │
└──────────────────────────┬────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: Generate newsletter via LLM API             │
│  Any OpenAI-compatible REST endpoint (OpenRouter,      │
│  Gemini, MiniMax, Groq, etc.)                        │
│  Input: skill prompt + email content + last issue     │
│  Output: { title, subtitle, html_content }            │
└──────────────────────────┬────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 4: Quality validation                           │
│  Word count ≥ 800, ≥ 5 links, all 4 pillars present  │
│  Check similarity to last issue                        │
│  If fails → retry (max 2) or alert                   │
└──────────────────────────┬────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 5: Create draft in Beehiiv                     │
│  POST /v2/publications/{id}/posts                    │
│  State: draft                                         │
└──────────────────────────┬────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 6: Send preview email via Resend                │
│  Beehiiv preview link + instructions to send manually │
└──────────────────────────┬────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 7: Archive to Google Drive (background)         │
│  Save markdown copy to Banking on AI / Archive         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Components

### 3.1 Cron Trigger
- **File:** `vercel.json`
- **Config:** `"0 9 * * 0"` with `CRON_TZ="America/Toronto"` — every Sunday at 9:00am EST
- **Action:** POST to `/api/inngest` (or Inngest dev server in local dev)

### 3.2 Inngest Event Endpoint
- **File:** `app/api/inngest/route.ts`
- **Responsibility:** Receives cron hit, fires `newsletter/draft.requested` event
- **Payload:** `{ week: "2026-W20" }`

### 3.3 Newsletter Pipeline
- **File:** `inngest/newsletter.function.ts`
- **Orchestrator:** Inngest `createFunction` with sequential `step.run()` calls
- **Retries:** 2 per step
- **Idempotency:** Keyed on `event.data.week`

### 3.4 LLM Client
- **File:** `lib/llm/client.ts`
- **Design:** Model-agnostic. Uses OpenAI-compatible `/v1/chat/completions` REST endpoint.
- **Configuration:** All model/provider details live in `.env`
- **Env vars:**
  ```
  LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
  LLM_API_KEY=sk-...
  LLM_MODEL=meta-llama/llama-3-70b-instruct
  ```
- **To switch providers:** Update `.env`. No code changes needed.

### 3.5 Email Fetcher
- **File:** `lib/gmail/fetcher.ts`
- **Design:** Direct Gmail API calls using OAuth 2.0 refresh token
- **Search query:** `AI OR "artificial intelligence" OR fintech OR banking OR LLM OR "machine learning"`
- **Date filter:** Last 7 days
- **Returns:** Top 8-10 email threads with subject, snippet, sender, date

### 3.6 Quality Validator
- **File:** `lib/validation/newsletter.ts`
- **Checks:**
  - Word count ≥ 800
  - At least 5 inline links
  - All 4 pillars present (AI Innovation, Banking Tech, Regulation & Policy, Market Trends)
  - Content similarity score vs. last issue (threshold: 0.7 — cosine similarity via embedding)
- **On failure:** Retry generation (max 2), then alert via Resend

### 3.6b Similarity Checker
- **File:** `lib/utils/similarity.ts`
- **Method:** Generate embeddings for current and last issue via the LLM API (e.g., OpenRouter's embedding endpoint or a dedicated embedding model), compute cosine similarity
- **Threshold:** 0.7 — if similarity exceeds this, regenerate with a prompt asking for more differentiation

### 3.7 Beehiiv Publisher
- **File:** `lib/beehiiv/client.ts`
- **API:** `POST /v2/publications/{publication_id}/posts`
- **State:** `draft` (not `publish`)

### 3.8 Notifier
- **File:** `lib/email/resend.ts`
- **Trigger:** Success or failure
- **Success email:** Beehiiv preview link, title, word count
- **Failure email:** Error message, failed step, retry count, link to Inngest dashboard

### 3.9 Archiver
- **File:** `lib/drive/archiver.ts`
- **Action:** Saves a markdown copy to Google Drive
- **Folder:** `Banking on AI / Archive`
- **Filename:** `Issue - {week}.md`

---

## 4. Environment Variables

```env
# LLM (model-agnostic, any OpenAI-compatible endpoint)
LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
LLM_API_KEY=sk-or-...
LLM_MODEL=meta-llama/llama-3-70b-instruct

# Google OAuth (for Gmail + Drive)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...

# Beehiiv
BEEHIIV_API_KEY=...
BEEHIIV_PUBLICATION_ID=...

# Email notifications
RESEND_API_KEY=re_...
NOTIFICATION_EMAIL=kirankhutal@gmail.com

# App
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
DRY_RUN=false
```

---

## 5. Directory Structure

```
banking-on-ai-automation/
├── vercel.json                  # Cron config: Sunday 9am EST
├── .env.example                 # All env vars documented
├── next.config.ts
├── tsconfig.json
├── package.json
├── skills/
│   └── banking-on-ai-newsletter.latest.md   # Editor voice + structure
├── app/
│   └── api/
│       ├── inngest/
│       │   └── route.ts         # Cron → Inngest event bridge
│       └── newsletter/
│           └── route.ts         # Manual trigger endpoint
├── inngest/
│   ├── client.ts
│   └── newsletter.function.ts   # Main pipeline
├── lib/
│   ├── llm/
│   │   └── client.ts            # Model-agnostic LLM caller
│   ├── gmail/
│   │   └── fetcher.ts          # Direct Gmail API fetch
│   ├── beehiiv/
│   │   └── client.ts           # Beehiiv API wrapper
│   ├── email/
│   │   └── resend.ts           # Resend notification sender
│   ├── drive/
│   │   └── archiver.ts         # Google Drive markdown save
│   ├── validation/
│   │   └── newsletter.ts        # Quality checks
│   ├── metadata/
│   │   └── store.ts            # Draft metadata persistence
│   └── utils/
│       ├── week.ts             # Week ID helpers
│       ├── cost-tracking.ts    # Cost estimation
│       └── similarity.ts       # Content deduplication
└── docs/
    └── banking-on-ai-design.md  # This file
```

---

## 6. V1 Scope

**In scope:**
- Sunday 9am cron fires pipeline
- Gmail fetch (last 7 days, AI/fintech keywords)
- LLM generates newsletter (4 pillars, Morning Brew voice)
- Quality validation (word count, links, pillar coverage)
- Draft created in Beehiiv
- Notification email with Beehiiv preview link
- Archive to Google Drive

**Out of scope (future):**
- Approval automation ("Reply YES to send")
- Auto-publish after approval
- Dashboard or admin UI
- Multi-model fallback routing

---

## 7. Skill Prompt (Newsletter Editor)

The newsletter follows the "Banking on AI" editor voice defined in `skills/banking-on-ai-newsletter.latest.md`. Key principles:

- **Voice:** Morning Brew meets The Economist — conversational authority
- **Four pillars:** AI Innovation, Banking Tech, Regulation & Policy, Market Trends
- **Format:** 2-3 paragraphs per pillar, 800+ words total, 5+ inline links
- **Subject line:** 20-60 characters, curiosity-driven, specific
- **No hype:** Avoid "revolutionary," "game-changing" without evidence
- **Lead with insight:** Explain *why* it matters, not just what happened

---

## 8. Error Handling

| Scenario | Behavior |
|---|---|
| Gmail fetch fails | Retry step, alert if 2/2 fail |
| LLM generation fails | Retry step, alert if 2/2 fail |
| Quality check fails | Retry generation (max 2), then alert |
| Beehiiv publish fails | Retry step, alert if 2/2 fail |
| Email notification fails | Log only — do not block pipeline |
| Drive archive fails | Log only — do not block pipeline |

---

## 9. Future Enhancements

1. **Approval automation** — Parse "Reply YES" from Resend inbox, trigger publish
2. **Model fallback** — If primary LLM is down, switch to backup provider
3. **Content deduplication** — Semantic similarity check against all past issues (not just last week)
4. **Analytics** — Track open rate, click rate, subscriber growth per issue
5. **GitHub release** — Package as open-source repo with README and deployment guide

---

*Design approved by Kiran on 2026-05-11*
