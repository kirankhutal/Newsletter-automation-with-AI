# 🔑 Credentials Checklist

Track your progress gathering all required credentials.

## Status Legend
- [ ] Not started
- [⏳] In progress
- [✅] Complete

---

## Required Credentials (11 total)

### 1. Anthropic API Key
- [ ] Status: 
- [ ] Value saved: `ANTHROPIC_API_KEY=`
- **Where to get**: https://console.anthropic.com → API Keys
- **Notes**: You mentioned using Minder AI - check if you already have one

### 2. Beehiiv API Key
- [ ] Status:
- [ ] Value saved: `BEEHIIV_API_KEY=`
- **Where to get**: https://app.beehiiv.com/settings/api
- **Notes**: Generate new API key

### 3. Beehiiv Publication ID
- [ ] Status:
- [ ] Value saved: `BEEHIIV_PUB_ID=`
- **Where to get**: Look at dashboard URL: app.beehiiv.com/publications/pub_xxxxxxxx
- **Notes**: Copy the pub_xxxxxxxx part

### 4. Google Client ID
- [ ] Status:
- [ ] Value saved: `GOOGLE_CLIENT_ID=`
- **Where to get**: Google Cloud Console → APIs & Services → Credentials
- **Notes**: Most complex - requires creating OAuth client

### 5. Google Client Secret
- [ ] Status:
- [ ] Value saved: `GOOGLE_CLIENT_SECRET=`
- **Where to get**: Same as Client ID (comes together)
- **Notes**: Download JSON file from Google Cloud

### 6. Google Refresh Token
- [ ] Status:
- [ ] Value saved: `GOOGLE_REFRESH_TOKEN=`
- **Where to get**: Run scripts/get-google-token.mjs after getting Client ID/Secret
- **Notes**: We'll do this together after #4 and #5

### 7. Inngest Event Key
- [ ] Status:
- [ ] Value saved: `INNGEST_EVENT_KEY=`
- **Where to get**: https://app.inngest.com → Your App → Manage → Keys
- **Notes**: Starts with inngest_...

### 8. Inngest Signing Key
- [ ] Status:
- [ ] Value saved: `INNGEST_SIGNING_KEY=`
- **Where to get**: Same place as Event Key
- **Notes**: Starts with signkey-...

### 9. Resend API Key
- [ ] Status:
- [ ] Value saved: `RESEND_API_KEY=`
- **Where to get**: https://resend.com → API Keys
- **Notes**: Starts with re_...

### 10. CRON Secret
- [ ] Status:
- [ ] Value saved: `CRON_SECRET=`
- **Where to get**: Generate random string (we'll do this together)
- **Notes**: 32+ random characters

### 11. Beehiiv MCP URL
- [ ] Status:
- [ ] Value saved: `BEEHIIV_MCP_URL=`
- **Where to get**: After deploying beehiiv-mcp to Vercel
- **Notes**: Will be something like https://beehiiv-mcp-xxx.vercel.app

---

## Progress Tracker

- Total credentials: 11
- Completed: 0
- Remaining: 11

**Current Phase**: Getting started

---

## Next Steps

1. Start with Anthropic API key (easiest)
2. Then Beehiiv (quick)
3. Then Inngest (quick)
4. Then Resend (quick)
5. Then Google OAuth (most complex - save for when you have time)
6. Generate CRON_SECRET (1 minute)
7. Deploy Beehiiv MCP to get URL

**Estimated time**: 1-2 hours total
