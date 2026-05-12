# Banking on AI Newsletter Automation - Architecture Documentation

## System Overview

The Banking on AI newsletter automation is a serverless, event-driven system that generates weekly AI/fintech newsletters with minimal human intervention. The architecture prioritizes reliability, cost-efficiency, and maintainability.

## Architecture Diagram

```
┌─────────────────┐
│  cron-job.org   │  Every Monday 8am UTC
│   (Free tier)   │
└────────┬────────┘
         │ HTTP GET with Bearer token
         ▼
┌─────────────────────────────────────────────────────────┐
│              Vercel (Hobby Plan - Free)                 │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  /api/newsletter (Trigger Route)                 │  │
│  │  - Validates CRON_SECRET                         │  │
│  │  - Calculates week identifier                    │  │
│  │  - Fires Inngest event                           │  │
│  │  - Returns 200 OK in <100ms                      │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                   │
│                     │ Inngest event                     │
│                     ▼                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │  /api/inngest (Serve Handler)                    │  │
│  │  - Exposes functions to Inngest                  │  │
│  │  - Handles function invocations                  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                     │
                     │ Function execution
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Inngest (Free tier)                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  draft-weekly-newsletter Function                │  │
│  │                                                   │  │
│  │  Step 1: get-google-token (5s timeout)          │  │
│  │  Step 2a: gather-sources (4min timeout)         │  │
│  │  Step 2b: generate-content (10min timeout)      │  │
│  │  Step 2c: validate-content (30s timeout)        │  │
│  │  Step 2d: publish-to-beehiiv (2min timeout)     │  │
│  │  Step 3: archive-to-drive (2min timeout)        │  │
│  │  Step 4: store-metadata (5s timeout)            │  │
│  │  Step 5: send-notification (10s timeout)        │  │
│  │                                                   │  │
│  │  Idempotency: event.data.week                    │  │
│  │  Retries: 2 per step                             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  newsletter-health-check Function                │  │
│  │  - Runs daily at midnight UTC                    │  │
│  │  - Tests all external services                   │  │
│  │  - Sends alert if any service fails              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │              │              │              │
         │              │              │              │
         ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│   Anthropic  │ │  Google  │ │ Beehiiv  │ │   Resend     │
│   Claude API │ │  OAuth   │ │   MCP    │ │   (Email)    │
│              │ │  Gmail   │ │  Server  │ │              │
│              │ │  Drive   │ │          │ │              │
└──────────────┘ └──────────┘ └──────────┘ └──────────────┘
```

## Component Details

### 1. Trigger Route (`/api/newsletter`)

**Purpose**: Lightweight HTTP endpoint that accepts cron triggers and dispatches work to Inngest.

**Key Features**:
- Returns in <100ms (well within Vercel Hobby 10s limit)
- Validates Bearer token against `CRON_SECRET`
- Calculates week identifier for idempotency
- No business logic - just event dispatch

**Why separate from business logic?**
- Vercel Hobby has 10s function timeout
- Newsletter generation takes 2-4 minutes
- Inngest handles long-running work externally

### 2. Inngest Functions

#### Newsletter Function (`draft-weekly-newsletter`)

**Purpose**: Multi-step pipeline that generates newsletter content.

**Architecture Pattern**: Step-based execution with independent retry logic

**Step Breakdown**:

| Step | Duration | Retries | Purpose | Failure Impact |
|------|----------|---------|---------|----------------|
| 1. get-google-token | ~2s | 3 | Refresh OAuth token | Only this step retries |
| 2a. gather-sources | ~30s | 2 | Search Gmail for emails | Only 2a retries, 2b reuses results |
| 2b. generate-content | 2-4min | 2 | Claude drafts newsletter | Only 2b retries, uses cached sources |
| 2c. validate-content | ~5s | 2 | Quality gates | Only 2c retries |
| 2d. publish-to-beehiiv | ~10s | 2 | Create Beehiiv draft | Only 2d retries |
| 3. archive-to-drive | ~15s | 2 | Save to Google Drive | Only 3 retries |
| 4. store-metadata | ~1s | 2 | Log to JSON file | Only 4 retries |
| 5. send-notification | ~2s | 3 | Email via Resend | Only 5 retries |

**Why split into multiple steps?**
- **Cost efficiency**: If step 2b fails, we don't re-run the Gmail search (step 2a)
- **Faster retries**: Only the failed step retries, not the entire pipeline
- **Better observability**: See exactly where failures occur
- **Granular timeouts**: Each step has appropriate timeout for its work

**Idempotency**:
- Key: `event.data.week` (e.g., "2026-W19")
- If same week triggered twice, Inngest deduplicates automatically
- Prevents duplicate drafts from cron retries or manual triggers

#### Health Check Function (`newsletter-health-check`)

**Purpose**: Daily monitoring of all external dependencies.

**Schedule**: Cron trigger at midnight UTC (24 hours before newsletter run)

**Tests**:
1. Beehiiv MCP - HTTP request to tools/list endpoint
2. Google OAuth - Token refresh attempt
3. Anthropic API - Minimal API call
4. Inngest - Implicit (if function runs, Inngest works)

**Alert Logic**:
- Only sends email if ≥1 service fails
- Email includes actionable troubleshooting steps
- Gives 8 hours to fix before Monday newsletter run

### 3. Beehiiv MCP Server

**Purpose**: Standalone microservice that exposes Beehiiv API as MCP tools.

**Deployment**: Separate Vercel project (different repo/deployment)

**Why separate?**
- **Reusability**: Can be used by other projects
- **Independent scaling**: MCP server has different traffic patterns
- **Simpler testing**: Can test MCP tools in isolation
- **Security**: API keys isolated to MCP server only

**Tools Provided**:
1. `create_draft` - Creates newsletter draft
2. `list_recent_posts` - Returns last 5 posts
3. `get_post_details` - Fetches specific post content

### 4. Utility Libraries

#### Week Calculation (`lib/utils/week.ts`)
- ISO week number calculation
- Ensures consistent week identifiers across runs
- Used for idempotency and metadata storage

#### Quality Checks (`lib/utils/quality-checks.ts`)
- Content validation before publishing
- Prevents bad drafts from reaching Beehiiv
- Configurable thresholds

**Gates**:
- Subject line: 20-60 characters
- Word count: ≥800 words
- Link count: ≥5 links
- All 4 pillars present
- Not too similar to last week
- Valid HTML structure

#### Cost Tracking (`lib/utils/cost-tracking.ts`)
- Calculates Anthropic API costs from token usage
- Alerts if single run exceeds $0.50
- Tracks costs in metadata for analytics

#### Metadata Storage (`lib/metadata/store.ts`)
- Stores structured data about each draft
- Enables analytics and continuous improvement
- JSON file storage (simple, no DB needed)

**Stored Data**:
- Draft content metadata (title, word count, etc.)
- Quality check results
- API costs
- Timestamps
- Beehiiv post IDs

## Data Flow

### Successful Run

```
1. cron-job.org triggers /api/newsletter
2. Trigger route validates secret, fires Inngest event
3. Inngest receives event, checks idempotency
4. Step 1: Refresh Google OAuth token
5. Step 2a: Claude searches Gmail via MCP
6. Step 2b: Claude drafts newsletter using email sources
7. Step 2c: Quality checks validate content
8. Step 2d: Claude creates draft in Beehiiv via MCP
9. Step 3: Claude archives to Google Drive via MCP
10. Step 4: Metadata stored to JSON file
11. Step 5: Success email sent via Resend
12. User receives notification, reviews draft in Beehiiv
13. User hits "Send" in Beehiiv UI
14. User records feedback via /api/newsletter/feedback
```

### Failed Run (with recovery)

```
1. cron-job.org triggers /api/newsletter
2. Trigger route validates secret, fires Inngest event
3. Inngest receives event, checks idempotency
4. Step 1: ✅ Google token refreshed
5. Step 2a: ✅ Gmail sources gathered
6. Step 2b: ❌ Claude API rate limit exceeded
7. Inngest waits 60s, retries step 2b only
8. Step 2b: ✅ Claude drafts newsletter (reuses sources from 2a)
9. Step 2c: ✅ Quality checks pass
10. Step 2d: ✅ Draft created in Beehiiv
11. Step 3: ✅ Archived to Drive
12. Step 4: ✅ Metadata stored
13. Step 5: ✅ Success email sent
```

## Security

### Secrets Management

**Environment Variables** (stored in Vercel):
- `ANTHROPIC_API_KEY` - Claude API access
- `BEEHIIV_API_KEY` - Beehiiv API access
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `GOOGLE_REFRESH_TOKEN` - Long-lived OAuth token
- `CRON_SECRET` - Protects trigger endpoint
- `RESEND_API_KEY` - Email sending
- `INNGEST_EVENT_KEY` - Event dispatch
- `INNGEST_SIGNING_KEY` - Function verification

**Never committed to git**:
- `.env.local` (gitignored)
- `lib/metadata/drafts.json` (gitignored)
- `lib/metadata/feedback.json` (gitignored)

### Authentication Flow

**Cron → Trigger Route**:
```
Authorization: Bearer <CRON_SECRET>
```

**Trigger Route → Inngest**:
```
Inngest-Event-Key: <INNGEST_EVENT_KEY>
```

**Inngest → Serve Handler**:
```
X-Inngest-Signature: <HMAC signature>
Verified using INNGEST_SIGNING_KEY
```

**Claude → Google MCPs**:
```
Authorization: Bearer <access_token>
(Refreshed from GOOGLE_REFRESH_TOKEN)
```

**Claude → Beehiiv MCP**:
```
No auth needed - MCP server handles it internally
MCP server uses BEEHIIV_API_KEY
```

## Cost Analysis

### Monthly Costs (4 newsletter runs)

| Service | Cost | Notes |
|---------|------|-------|
| Anthropic API | ~$0.50 | 4 runs × ~$0.12 per run |
| Vercel | $0 | Hobby plan, <100 GB-hours |
| Inngest | $0 | <500k runs/month |
| Google APIs | $0 | <10k API calls/month |
| Beehiiv | $0 | Free plan includes API |
| Resend | $0 | <3k emails/month |
| cron-job.org | $0 | Free tier |
| **Total** | **~$0.50** | |

### Cost Breakdown per Run

**Anthropic API** (~$0.12 per run):
- Step 2a (gather-sources): ~15k input + 2k output = $0.03
- Step 2b (generate-content): ~25k input + 5k output = $0.08
- Step 2d (publish-to-beehiiv): ~3k input + 500 output = $0.01

**Why so cheap?**
- Only 4 runs per month (weekly newsletter)
- Efficient prompting (skill file is concise)
- Multi-step pipeline avoids re-running expensive steps on retry

### Scaling Considerations

**If newsletter goes daily** (30 runs/month):
- Anthropic: ~$3.60/month
- Still within all free tiers for other services
- Total: ~$3.60/month

**If newsletter goes to 10k subscribers**:
- No cost increase (Beehiiv free plan supports up to 2,500)
- Would need Beehiiv paid plan: $49/month
- Total: ~$50/month

## Reliability & Resilience

### Failure Modes & Mitigations

| Failure | Probability | Impact | Mitigation |
|---------|-------------|--------|------------|
| Anthropic rate limit | Low | Single run fails | Automatic retry after 60s |
| Google token expired | Very Low | Run fails | Health check catches 24h early |
| Beehiiv API down | Very Low | Draft not created | Manual retry via Inngest |
| Gmail search returns 0 results | Low | Poor content quality | Quality gates catch, fail run |
| Quality checks fail | Medium | Draft rejected | Tune skill file, retry |
| Vercel deployment fails | Very Low | No new runs | Rollback to previous deployment |
| Inngest outage | Very Low | Run delayed | Automatic retry when back |

### Monitoring & Alerting

**Proactive** (before failure):
- Daily health checks at midnight UTC
- Email alert if any service unhealthy
- 8 hours to fix before Monday run

**Reactive** (after failure):
- Inngest dashboard shows step-by-step execution
- Failure email with error details and replay link
- Metadata logs track success/failure rates

### Recovery Procedures

**Automatic**:
- Step-level retries (2-3 attempts per step)
- Exponential backoff on retries
- Idempotency prevents duplicate work

**Manual**:
- Replay from failed step (Inngest dashboard)
- Manual trigger via curl
- Dry-run mode for testing fixes

## Performance

### Latency

**Trigger route**: <100ms
- Secret validation: ~1ms
- Week calculation: ~1ms
- Inngest event dispatch: ~50ms
- Response: ~1ms

**Newsletter generation**: 2-4 minutes
- Step 1 (token): ~2s
- Step 2a (sources): ~30s
- Step 2b (draft): 2-3min (Claude API)
- Step 2c (validate): ~5s
- Step 2d (publish): ~10s
- Step 3 (archive): ~15s
- Step 4 (metadata): ~1s
- Step 5 (email): ~2s

**Health check**: ~10s
- Beehiiv MCP test: ~2s
- Google OAuth test: ~3s
- Anthropic API test: ~5s

### Throughput

**Current**: 4 runs/month (weekly)
**Max capacity**: ~500k runs/month (Inngest free tier limit)
**Bottleneck**: Anthropic API rate limits (50 requests/minute)

## Future Enhancements

### Potential Improvements

1. **Database instead of JSON files**
   - Current: `lib/metadata/drafts.json`
   - Future: PostgreSQL or MongoDB
   - Benefit: Better querying, analytics

2. **A/B testing subject lines**
   - Generate 3 subject line options
   - Track which get best open rates
   - Auto-optimize over time

3. **Automated sending**
   - Skip manual review step
   - Auto-send if quality score >90%
   - Requires high confidence in quality gates

4. **Multi-newsletter support**
   - Reuse same infrastructure
   - Different skill files per newsletter
   - Shared MCP servers

5. **Advanced analytics dashboard**
   - Web UI for viewing metadata
   - Charts: cost trends, quality scores, topics covered
   - Built with Next.js pages

6. **Webhook integration**
   - Beehiiv webhook on email sent
   - Auto-record feedback
   - Track open/click rates

## Technology Choices

### Why Next.js?
- Vercel-native (best deployment experience)
- API routes for serverless functions
- TypeScript support out of the box
- Large ecosystem

### Why Inngest?
- Free tier sufficient for use case
- Step-based execution (better than single long function)
- Built-in retries and observability
- No infrastructure management

### Why Separate MCP Server?
- Reusability across projects
- Independent deployment/scaling
- Simpler testing
- Security isolation

### Why JSON Files for Metadata?
- Simple (no DB setup/maintenance)
- Version controlled (can track in git if desired)
- Fast reads/writes for low volume
- Easy to migrate to DB later

### Why cron-job.org?
- Free
- Reliable
- No vendor lock-in
- Vercel Cron requires Pro plan ($20/month)

## Deployment

### Vercel Configuration

**Main App** (`banking-on-ai-automation`):
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

**Beehiiv MCP** (`beehiiv-mcp`):
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
```

### Environment Variables

**Required in both Vercel projects**:
- Set in Vercel dashboard → Settings → Environment Variables
- Available to all deployments (Production, Preview, Development)
- Never committed to git

### CI/CD Pipeline

```
1. Push to GitHub main branch
2. Vercel detects push
3. Vercel runs build
4. Vercel deploys to production
5. Inngest auto-syncs functions (if /api/inngest changed)
6. Health check runs at next midnight UTC
```

**No manual steps required** after initial setup.

---

## Conclusion

This architecture prioritizes:
- **Reliability**: Multi-step execution with granular retries
- **Cost-efficiency**: ~$0.50/month using free tiers
- **Maintainability**: Clear separation of concerns, good observability
- **Simplicity**: No complex infrastructure, minimal moving parts

The system is designed to run autonomously with minimal intervention, while providing enough monitoring and control points for when human oversight is needed.
