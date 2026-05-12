# 🔑 Get Your Credentials - Step by Step

Follow these instructions to gather each credential. Come back here and we'll add them to .env.local together.

---

## 1️⃣ Anthropic API Key (5 minutes)

**Steps:**
1. Visit: https://console.anthropic.com
2. Sign in (or create account if you don't have one)
3. Click on your profile → "API Keys"
4. Click "Create Key"
5. Name it: "Banking on AI Newsletter"
6. Copy the key (starts with `sk-ant-`)

**Once you have it, tell me and I'll add it to .env.local**

---

## 2️⃣ Beehiiv API Key + Publication ID (10 minutes)

**Steps:**
1. Visit: https://app.beehiiv.com
2. Sign in to your account
3. Go to: Settings → Integrations → API
4. Click "Generate API Key"
5. Copy the API key

**For Publication ID:**
1. Go back to your dashboard
2. Look at the URL: `app.beehiiv.com/publications/pub_xxxxxxxxxx`
3. Copy the `pub_xxxxxxxxxx` part

**Once you have both, tell me and I'll add them**

---

## 3️⃣ Inngest Keys (10 minutes)

**Steps:**
1. Visit: https://app.inngest.com
2. Sign up with GitHub (free account)
3. Click "Create App"
4. Name: "banking-on-ai"
5. Click "Create"
6. Go to: Your App → Manage → Keys
7. Copy "Event Key" (starts with `inngest_`)
8. Copy "Signing Key" (starts with `signkey-`)

**Once you have both keys, tell me**

---

## 4️⃣ Resend API Key (5 minutes)

**Steps:**
1. Visit: https://resend.com
2. Sign up (free account)
3. Verify your email
4. Go to: API Keys
5. Click "Create API Key"
6. Name: "Banking on AI Automation"
7. Copy the key (starts with `re_`)

**Once you have it, tell me**

---

## 5️⃣ Google Cloud OAuth (30-45 minutes) ⚠️ Most Complex

This is the most involved. Let's do this one together when you're ready.

**High-level steps:**
1. Create Google Cloud project
2. Enable Gmail API and Google Drive API
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials
5. Download credentials JSON
6. Run script to get refresh token

**We'll do this step-by-step together when you're ready**

---

## 🎯 Recommended Order

**Do these now (quick - 30 minutes total):**
1. ✅ CRON_SECRET (already done!)
2. Anthropic API Key
3. Beehiiv API Key + Pub ID
4. Inngest Keys
5. Resend API Key

**Save for later (45 minutes):**
6. Google OAuth (we'll do this together)

**After deployment:**
7. Beehiiv MCP URL (we'll get this after deploying)

---

## 📋 What to Do

1. Open this file in your browser or editor
2. Go through steps 1-4 above
3. As you get each credential, come back and tell me
4. I'll add them to your .env.local file
5. We'll tackle Google OAuth together when you're ready

**Ready to start? Which credential do you want to get first?**
