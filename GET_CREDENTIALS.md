# Credentials Setup Guide

Follow this guide to gather all required credentials for the newsletter automation pipeline.

---

## 1. LLM API (OpenAI-compatible)

**Recommended: OpenRouter** (openrouter.ai) — supports many free models.

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Go to **Keys** → Create API key
3. Optionally add credits for higher rate limits

**Environment variables:**
```env
LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
LLM_API_KEY=sk-or-v2-...
LLM_MODEL=qwen/qwen3.6-35b-a3b
```

**Supported model formats:**
- OpenRouter models: `qwen/qwen3.6-35b-a3b`, `deepseek/deepseek-v4-flash`
- Gemini (free): `gemini-2.0-flash` with `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
- Any OpenAI-compatible endpoint

---

## 2. Google OAuth (Gmail + Drive)

### Step A: Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Note your project ID

### Step B: Enable APIs

1. Go to **APIs & Services → Library**
2. Enable **Gmail API**
3. Enable **Google Drive API**

### Step C: Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External**
3. Fill in app name and support email
4. Skip scopes for now (add later)
5. Add test users (your Google email)

### Step D: Create Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: "Newsletter Automation"
5. Add authorized redirect URI: `https://developers.google.com/oauthplayground`
6. Save Client ID and Client Secret

### Step E: Get Refresh Token

1. Go to [OAuth Playground](https://developers.google.com/oauthplayground)
2. Click ⚙️ → check **"Use your own OAuth credentials"**
3. Enter your Client ID and Client Secret
4. In the left panel, enter these scopes (one at a time):
   ```
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/drive.appdata
   ```
5. Click **Authorize APIs** → complete the flow
6. Click **Exchange authorization code for tokens**
7. Copy the **refresh token**

**Environment variables:**
```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

---

## 3. Beehiiv

1. Sign up at [beehiiv.com](https://app.beehiiv.com)
2. Go to **Settings → Integrations → API**
3. Generate API key

**For Publication ID:**
Look at your dashboard URL: `app.beehiiv.com/publications/pub_xxxxxxxx`

**Note:** Beehiiv's API for creating posts requires an Enterprise plan. The pipeline handles this gracefully — you'll receive content via email instead.

**Environment variables:**
```env
BEEHIIV_API_KEY=...
BEEHIIV_PUBLICATION_ID=pub_xxxxxxxx  # include the pub_ prefix
```

---

## 4. Resend (Email Notifications)

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain or email
3. Go to **API Keys** → Create key

**Environment variables:**
```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=automation@yourdomain.com
NOTIFICATION_EMAIL=your@email.com
```

---

## 5. Inngest

1. Sign up at [app.inngest.com](https://app.inngest.com) with GitHub
2. Click **Create App** → name it `banking-on-ai`
3. Go to **Settings → Environment**
4. Copy:
   - **Event Key** → `INNGEST_EVENT_KEY`
   - **Signing Key** → `INNGEST_SIGNING_KEY`
5. From the app URL, extract the app ID (e.g., `banking-on-ai`) → `INNGEST_APP_ID`

**Environment variables:**
```env
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
INNGEST_APP_ID=banking-on-ai
```

---

## 6. App Config

```env
# Set to false when ready to send to Beehiiv (requires Enterprise plan)
DRY_RUN=true

# Any strong random string for manual trigger auth
CRON_SECRET=generate-a-strong-random-string
```

---

## Quick Credential Checklist

| Credential | Where to get it | Status |
|---|---|---|
| `LLM_API_URL` | openrouter.ai | |
| `LLM_API_KEY` | openrouter.ai/keys | |
| `LLM_MODEL` | openrouter.ai/models | |
| `GOOGLE_CLIENT_ID` | console.cloud.google.com | |
| `GOOGLE_CLIENT_SECRET` | console.cloud.google.com | |
| `GOOGLE_REFRESH_TOKEN` | oauthplayground.com | |
| `BEEHIIV_API_KEY` | app.beehiiv.com | |
| `BEEHIIV_PUBLICATION_ID` | app.beehiiv.com | |
| `RESEND_API_KEY` | resend.com | |
| `RESEND_FROM_EMAIL` | your domain | |
| `NOTIFICATION_EMAIL` | your email | |
| `INNGEST_EVENT_KEY` | app.inngest.com | |
| `INNGEST_SIGNING_KEY` | app.inngest.com | |
| `INNGEST_APP_ID` | app.inngest.com | |
| `DRY_RUN` | set to `true` for testing | |
| `CRON_SECRET` | generate at [lastpass.com/password-generator](https://lastpass.com) | |