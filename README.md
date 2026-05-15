# Newsletter Automation with AI

A fully automated weekly newsletter pipeline that generates, validates, and delivers AI-powered content. Works with any OpenAI-compatible LLM API — model-agnostic by design.

---

## What It Does

Every Sunday at 9am EST, the pipeline:
1. **Fetches** relevant emails from Gmail (past 7 days, AI/fintech keywords)
2. **Generates** an 800+ word newsletter covering 4 pillars: AI Innovation, Banking Tech, Regulation, Market Trends
3. **Validates** content quality (word count, links, pillar coverage)
4. **Delivers** the full newsletter directly to your email with a Beehiiv copy button
5. **Notifies** you on success or failure

Your only job: open the email, review, and hit send.

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/kirankhutal/Newsletter-automation-with-AI.git
cd Newsletter-automation-with-AI
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
# LLM — any OpenAI-compatible endpoint
LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
LLM_API_KEY=your-api-key
LLM_MODEL=qwen/qwen3.6-35b-a3b

# Google OAuth (for Gmail)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...

# Beehiiv
BEEHIIV_API_KEY=...
BEEHIIV_PUBLICATION_ID=...

# Email notifications (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=automation@yourdomain.com
NOTIFICATION_EMAIL=your@email.com

# Inngest
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
INNGEST_APP_ID=your-app-id

# App
DRY_RUN=true
CRON_SECRET=your-random-secret
```

### 3. Deploy

```bash
vercel --prod
```

Then connect the GitHub repo to Inngest via the Inngest dashboard (Settings → Vercel sync).

### 4. Test

Trigger manually from the Inngest dashboard or via:
```bash
curl -X GET https://your-app.vercel.app/api/inngest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Architecture

```
Sunday 9am EST
       │
       ▼
┌─────────────┐     POST /api/inngest     ┌─────────────┐
│  Vercel     │ ────────────────────────▶│  Inngest    │
│  Cron       │                          │  Function   │
└─────────────┘                          └──────┬──────┘
                                                │
                   ┌───────────────────────────┼───────────────────────────┐
                   │                                                   │
                   ▼                                                   ▼
          ┌──────────────┐                                   ┌──────────────┐
          │ Gmail API    │                                   │ OpenRouter   │
          │ (sources)    │                                   │ (LLM)        │
          └──────────────┘                                   └──────┬───────┘
                                                                   │
                   ┌───────────────────────────────────────────────┘
                   │
                   ▼
          ┌──────────────┐
          │ Validation   │ ─── fail ──▶ send failure email
          │ (quality)    │
                   │
                   ▼
          ┌──────────────┐
          │ Beehiiv     │ ─── Enterprise plan required
          │ (draft)     │     falls back gracefully
          └──────────────┘
                   │
                   ▼
          ┌──────────────┐
          │ Email       │ ◀── full newsletter HTML
          │ (Resend)    │     delivered to inbox
          └──────────────┘
```

---

## Project Structure

```
├── app/
│   └── api/
│       ├── inngest/route.ts        # Inngest serve handler
│       └── newsletter/
│           └── feedback/route.ts   # Feedback tracking API
├── inngest/
│   ├── client.ts                    # Inngest singleton
│   └── newsletter.function.ts      # 7-step pipeline
├── lib/
│   ├── auth/google.ts              # Google OAuth helper
│   ├── beehiiv/client.ts           # Beehiiv API client
│   ├── drive/archiver.ts           # Google Drive archiver
│   ├── email/resend.ts             # Email notification
│   ├── gmail/fetcher.ts           # Gmail API fetcher
│   ├── llm/client.ts              # Model-agnostic LLM client
│   ├── metadata/store.ts          # Metadata storage
│   └── validation/similarity.ts    # Content similarity check
├── skills/
│   └── banking-on-ai-newsletter.latest.md  # Newsletter system prompt
├── docs/
│   ├── banking-on-ai-design.md    # System design
│   └── RUNBOOK.md                  # Operations guide
├── vercel.json                    # Cron schedule (Sundays 9am EST)
└── .env.example                   # Environment variable template
```

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `LLM_API_URL` | OpenAI-compatible endpoint URL | ✅ |
| `LLM_API_KEY` | API key for the LLM service | ✅ |
| `LLM_MODEL` | Model ID (e.g. `qwen/qwen3.6-35b-a3b`) | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ✅ |
| `GOOGLE_REFRESH_TOKEN` | Google OAuth refresh token | ✅ |
| `BEEHIIV_API_KEY` | Beehiiv API key | ✅ |
| `BEEHIIV_PUBLICATION_ID` | Beehiiv publication ID | ✅ |
| `RESEND_API_KEY` | Resend API key | ✅ |
| `RESEND_FROM_EMAIL` | From address for emails | ✅ |
| `NOTIFICATION_EMAIL` | Email to receive drafts | ✅ |
| `INNGEST_EVENT_KEY` | Inngest event key | ✅ |
| `INNGEST_SIGNING_KEY` | Inngest signing key | ✅ |
| `INNGEST_APP_ID` | Inngest app ID | ✅ |
| `DRY_RUN` | `true` = skip Beehiiv/Drive (safe testing) | ✅ |
| `CRON_SECRET` | Secret for manual trigger auth | ✅ |
| `SKILL_VERSION` | Skill file version (default: `latest`) | optional |

---

## Customizing the Newsletter

### Edit the System Prompt

The newsletter style, pillars, and guidelines are defined in:
```
skills/banking-on-ai-newsletter.latest.md
```

Edit this file and push to deploy — no code changes needed.

### Change the LLM Model

Update `.env` and Vercel environment variables:
```
LLM_MODEL=your-model-id
```

Any OpenAI-compatible endpoint works (OpenRouter, Gemini, Groq, etc.).

### Adjust Quality Thresholds

Edit `lib/utils/quality-checks.ts`:
- Minimum word count (default: 800)
- Minimum links (default: 5)
- Pillar requirements

---

## Known Limitations

- **Beehiiv API** requires an Enterprise plan for programmatic post creation. The pipeline handles this gracefully — you'll receive the full content via email instead.
- **Google Drive** requires the `drive.appdata` OAuth scope. If the archive step fails, the pipeline continues without it.
- **Metadata storage** requires a writable filesystem (works locally; on Vercel serverless it falls back gracefully).

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel dashboard
3. Add all environment variables
4. Deploy

The `vercel.json` configures automatic cron triggering every Sunday at 9am EST.

### Inngest Setup

1. Create an app at **app.inngest.com**
2. Sync with Vercel (Settings → Vercel → enter deployment URL)
3. Add `INNGEST_APP_ID` to Vercel environment variables
4. The function will appear in your Inngest dashboard

### Manual Trigger

```bash
curl -X GET https://your-app.vercel.app/api/inngest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Tech Stack

- **Next.js 16** — App Router, TypeScript, Turbopack
- **Inngest** — Serverless durable execution
- **Vercel** — Hosting + Cron
- **Resend** — Email notifications
- **Any OpenAI-compatible LLM** — Model-agnostic
- **Google Gmail API** — Source content
- **Google Drive API** — Archive (optional)

---

## License

MIT