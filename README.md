# Banking on AI Newsletter Automation

Fully automated weekly newsletter system that generates AI/fintech content using Claude API, Gmail/Drive/Beehiiv MCPs, and Inngest for background processing.

## 🎯 What It Does

Every Monday at 8am UTC:
1. Searches your Gmail for AI/fintech news from the past 7 days
2. Uses Claude to draft a newsletter covering 4 pillars (AI Innovation, Banking Tech, Regulation, Market Trends)
3. Validates content quality (word count, links, pillars, HTML)
4. Creates a draft in Beehiiv ready for 1-click send
5. Archives to Google Drive
6. Sends you a notification email

**Your only job**: Review the draft and hit Send.

## 💰 Cost

**~$0.50/month** (4 weekly runs × ~$0.12 per run)

All services use free tiers except Anthropic API:
- Vercel: Hobby plan (free)
- Inngest: 500k runs/month (free)
- Google APIs: Free at this volume
- Beehiiv: Free plan includes API
- Resend: 3k emails/month (free)
- cron-job.org: Free

## ✨ Features

- **Idempotency**: No duplicate drafts if cron retries
- **Multi-step pipeline**: Separate gather/draft/publish for better reliability
- **Quality gates**: Automated validation before publishing
- **Health checks**: Daily monitoring of all services
- **Dry-run mode**: Test without creating real drafts
- **Structured metadata**: Track costs, quality, topics over time
- **Enhanced notifications**: Actionable error alerts with replay links

## 📁 Project Structure

```
banking-on-ai-automation/
├── app/
│   └── api/
│       ├── inngest/route.ts          # Inngest serve handler
│       └── newsletter/
│           ├── route.ts               # Trigger endpoint
│           └── feedback/route.ts      # Feedback tracking
├── inngest/
│   ├── client.ts                      # Inngest singleton
│   ├── newsletter.function.ts         # Main pipeline (8 steps)
│   └── health-check.function.ts       # Daily monitoring
├── lib/
│   ├── utils/
│   │   ├── week.ts                    # Week number calculation
│   │   ├── quality-checks.ts          # Content validation
│   │   └── cost-tracking.ts           # API cost calculation
│   └── metadata/
│       ├── store.ts                   # Metadata storage
│       ├── drafts.json                # Draft history (gitignored)
│       └── feedback.json              # Feedback log (gitignored)
├── skills/
│   └── banking-on-ai-newsletter.latest.md  # System prompt
├── scripts/
│   └── get-google-token.mjs           # One-time OAuth setup
└── docs/
    ├── RUNBOOK.md                     # Operations guide
    └── ARCHITECTURE.md                # System design

beehiiv-mcp/                           # Separate project
└── app/
    └── mcp/route.ts                   # Beehiiv MCP server (3 tools)
```

## 🚀 Quick Start

### Prerequisites

1. **Anthropic API key** - Get from console.anthropic.com
2. **Beehiiv account** - Free plan includes API access
3. **Google Cloud project** - For Gmail/Drive OAuth
4. **Inngest account** - Free tier at app.inngest.com
5. **Resend account** - Free tier at resend.com

### Setup (15 hours across 2 weekends)

See [TODO.md](TODO.md) for detailed phase-by-phase plan.

**Weekend 1** (7 hours):
- Phase 0: Get all API keys and credentials (1-2 hrs)
- Phase 1: Deploy Beehiiv MCP server (2-3 hrs)
- Phase 2: Build Inngest functions (3-4 hrs)
- Phase 3: Create trigger route (45 mins)
- Phase 4: Configure cron (20 mins)

**Weekend 2** (8 hours):
- Phase 5: End-to-end testing (3-4 hrs)
- Phase 6: Health checks & monitoring (1 hr)
- Phase 7: Go-live checklist (1 hr)

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
# Required (13 variables)
ANTHROPIC_API_KEY=
BEEHIIV_API_KEY=
BEEHIIV_PUB_ID=
BEEHIIV_MCP_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
CRON_SECRET=
RESEND_API_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Optional
NEWSLETTER_DRY_RUN=false
SKILL_VERSION=latest
```

### Deploy

**Beehiiv MCP** (separate project):
```bash
cd beehiiv-mcp
vercel --prod
# Copy deployment URL as BEEHIIV_MCP_URL
```

**Main app**:
```bash
cd banking-on-ai-automation
vercel --prod
# Go to Inngest dashboard → Sync → enter your-app.vercel.app/api/inngest
```

### Test

**Dry-run mode** (no real draft created):
```bash
# Set NEWSLETTER_DRY_RUN=true in Vercel
curl -X GET https://your-app.vercel.app/api/newsletter \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
# Check Inngest dashboard for execution logs
```

**Full test** (creates real draft):
```bash
# Set NEWSLETTER_DRY_RUN=false in Vercel
curl -X GET https://your-app.vercel.app/api/newsletter \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
# Check Beehiiv for draft
```

## 📖 Documentation

- **[RUNBOOK.md](docs/RUNBOOK.md)** - Operations guide (manual trigger, troubleshooting, monitoring)
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System design (data flow, security, cost analysis)
- **[TODO.md](TODO.md)** - Implementation plan (phase-by-phase checklist)

## 🔧 Common Operations

### Manual Trigger
```bash
curl -X GET https://your-app.vercel.app/api/newsletter \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Record Feedback
```bash
curl -X POST https://your-app.vercel.app/api/newsletter/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "draftId": "draft-2026-W19",
    "week": "2026-W19",
    "action": "sent",
    "notes": "Great issue this week"
  }'
```

### Update Newsletter Prompt
1. Edit `skills/banking-on-ai-newsletter.latest.md`
2. Commit and push
3. Vercel auto-deploys
4. Next run uses new prompt

### View Metadata
```bash
cat lib/metadata/drafts.json
cat lib/metadata/feedback.json
```

## 🏗️ Architecture Highlights

### Multi-Step Pipeline

Instead of one long Claude call, the pipeline is split into independent steps:

1. **get-google-token** (2s) - Refresh OAuth token
2. **gather-sources** (30s) - Search Gmail for emails
3. **generate-content** (2-4min) - Claude drafts newsletter
4. **validate-content** (5s) - Quality gates
5. **publish-to-beehiiv** (10s) - Create draft
6. **archive-to-drive** (15s) - Save to Google Drive
7. **store-metadata** (1s) - Log structured data
8. **send-notification** (2s) - Email via Resend

**Benefits**:
- If step 3 fails, steps 1-2 don't re-run (saves cost)
- Each step has independent retry logic
- Better observability (see exactly where it failed)

### Quality Gates

Content must pass all checks before publishing:
- ✅ Subject line: 20-60 characters
- ✅ Word count: ≥800 words
- ✅ Link count: ≥5 links
- ✅ All 4 pillars present
- ✅ Not too similar to last week
- ✅ Valid HTML structure

### Idempotency

Week-based deduplication prevents duplicate drafts:
- Each run tagged with week identifier (e.g., "2026-W19")
- If same week triggered twice, Inngest ignores the duplicate
- Safe to retry manually or from cron

## 🐛 Troubleshooting

### Newsletter generation failed

1. Check Inngest dashboard: https://app.inngest.com/runs
2. Find the failed run
3. See which step failed and error message
4. Click "Replay" to retry from failed step

### No notification email

1. Check Resend dashboard for delivery status
2. Verify `RESEND_API_KEY` is valid
3. Check spam folder
4. Review Inngest logs for step 5 (send-notification)

### Quality checks failing

1. Check Inngest logs for validation details
2. Common issues:
   - Subject line too short/long → Edit skill file
   - Missing pillars → Improve skill file instructions
   - Word count too low → Increase `max_tokens` in newsletter.function.ts
3. Adjust thresholds in `lib/utils/quality-checks.ts` if needed

See [RUNBOOK.md](docs/RUNBOOK.md) for complete troubleshooting guide.

## 📊 Monitoring

### Daily Health Checks

Runs at midnight UTC (24 hours before newsletter):
- Tests Beehiiv MCP connectivity
- Tests Google OAuth token refresh
- Tests Anthropic API key
- Sends alert email if any service fails

### Inngest Dashboard

View at https://app.inngest.com:
- Run history (every Monday's execution)
- Step-by-step traces
- Retry history
- Replay failed runs

### Metadata Tracking

Every draft logged to `lib/metadata/drafts.json`:
- Title, subtitle, word count
- Quality check results
- API costs
- Source email count
- Timestamps

## 🔐 Security

- All secrets stored in Vercel environment variables
- Never committed to git (`.env.local` gitignored)
- Cron endpoint protected by Bearer token
- Google OAuth uses refresh token (never expires unless revoked)
- Inngest verifies requests with HMAC signature

## 📈 Scaling

**Current**: 4 runs/month (weekly newsletter)

**If daily** (30 runs/month):
- Anthropic: ~$3.60/month
- Still within all free tiers
- Total: ~$3.60/month

**If 10k subscribers**:
- Need Beehiiv paid plan: $49/month
- Total: ~$50/month

## 🤝 Contributing

This is a personal automation project, but feel free to fork and adapt for your own newsletter.

## 📝 License

MIT

## 🙏 Acknowledgments

Built with:
- [Anthropic Claude](https://www.anthropic.com/) - AI content generation
- [Inngest](https://www.inngest.com/) - Background job processing
- [Vercel](https://vercel.com/) - Hosting
- [Beehiiv](https://www.beehiiv.com/) - Newsletter platform
- [Model Context Protocol](https://modelcontextprotocol.io/) - Tool integration

---

**Questions?** See [RUNBOOK.md](docs/RUNBOOK.md) or [ARCHITECTURE.md](docs/ARCHITECTURE.md)
