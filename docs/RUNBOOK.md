# Banking on AI Newsletter Automation - Runbook

## Quick Reference

### Manual Trigger
```bash
curl -X GET https://your-app.vercel.app/api/newsletter \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Check Run Status
Visit: https://app.inngest.com/runs

### Replay Failed Run
1. Go to Inngest dashboard → Runs
2. Find the failed run
3. Click "Replay" button
4. Select "From failed step" to avoid re-running successful steps

---

## Common Operations

### 1. Update the Newsletter Prompt

The skill file controls all content generation behavior.

**Location**: `skills/banking-on-ai-newsletter.latest.md`

**To update**:
1. Edit the skill file locally
2. Commit and push to GitHub
3. Vercel auto-deploys
4. Next run uses the new prompt

**To test a new version**:
1. Create `skills/banking-on-ai-newsletter.v2.md`
2. Set env var: `SKILL_VERSION=v2`
3. Trigger a test run
4. If good, rename to `latest.md`

### 2. Test Without Creating Real Drafts

**Enable dry-run mode**:
1. Go to Vercel → Settings → Environment Variables
2. Set `NEWSLETTER_DRY_RUN=true`
3. Redeploy or wait for next deployment
4. Trigger the newsletter endpoint
5. Check Inngest logs - should see "DRY RUN" messages
6. No draft created in Beehiiv

**Disable dry-run**:
1. Set `NEWSLETTER_DRY_RUN=false` in Vercel
2. Redeploy

### 3. Record Feedback After Sending

After you review and send (or reject) a draft:

```bash
curl -X POST https://your-app.vercel.app/api/newsletter/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "draftId": "draft-2026-W19",
    "week": "2026-W19",
    "action": "sent",
    "notes": "Great coverage of AI regulation this week"
  }'
```

Actions: `sent`, `rejected`, `edited`

### 4. View Analytics

```bash
# Get all drafts
curl https://your-app.vercel.app/api/newsletter/analytics

# Get specific week
curl https://your-app.vercel.app/api/newsletter/analytics?week=2026-W19
```

Or check locally:
```bash
cat lib/metadata/drafts.json
cat lib/metadata/feedback.json
```

### 5. Manually Trigger Health Check

1. Go to Inngest dashboard
2. Functions → newsletter-health-check
3. Click "Invoke"
4. Check email for results

---

## Troubleshooting

### Newsletter Generation Failed

**Check Inngest dashboard first**:
1. Go to https://app.inngest.com/runs
2. Find the failed run
3. Click to see which step failed
4. View error message and logs

**Common failures**:

#### Step 1: get-google-token
**Error**: "Google OAuth failed: 401"

**Fix**:
1. Google refresh token expired or revoked
2. Re-run `scripts/get-google-token.mjs`
3. Update `GOOGLE_REFRESH_TOKEN` in Vercel
4. Replay the run

#### Step 2a: gather-sources
**Error**: "Gmail MCP connection failed"

**Fix**:
1. Check Gmail API is enabled in Google Cloud Console
2. Verify OAuth scopes include `gmail.readonly`
3. Test token manually:
```bash
curl https://gmail.googleapis.com/gmail/v1/users/me/messages \
  -H "Authorization: Bearer $(get fresh token)"
```

#### Step 2b: generate-content
**Error**: "Anthropic API error: 401"

**Fix**:
1. API key invalid or expired
2. Check balance at console.anthropic.com
3. Update `ANTHROPIC_API_KEY` in Vercel

**Error**: "Rate limit exceeded"

**Fix**:
1. Wait 60 seconds
2. Replay the run from Inngest dashboard

#### Step 2c: validate-content
**Error**: "Quality checks failed"

**Fix**:
1. Check the error details in Inngest logs
2. Common issues:
   - Subject line too short/long → Edit skill file to emphasize length
   - Missing pillars → Skill file needs clearer pillar instructions
   - Word count too low → Increase `max_tokens` in newsletter.function.ts
3. If quality gates are too strict, adjust thresholds in `lib/utils/quality-checks.ts`

#### Step 2d: publish-to-beehiiv
**Error**: "Beehiiv API error: 401"

**Fix**:
1. API key invalid
2. Check at app.beehiiv.com/settings/api
3. Update `BEEHIIV_API_KEY` in Vercel

**Error**: "Beehiiv MCP not responding"

**Fix**:
1. Check Beehiiv MCP deployment is live
2. Visit `https://your-beehiiv-mcp.vercel.app/mcp` directly
3. Should return MCP server info
4. Update `BEEHIIV_MCP_URL` if deployment URL changed

### Health Check Alerts

**Email**: "⚠️ Health Check Failed - X service(s) down"

**Action**:
1. Check which service failed in email
2. Follow troubleshooting steps above for that service
3. Run health check again manually to verify fix

### Duplicate Drafts Created

**Symptom**: Two drafts for the same week in Beehiiv

**Cause**: Idempotency not working (week identifier mismatch)

**Fix**:
1. Check `lib/utils/week.ts` - ensure consistent week calculation
2. Delete duplicate draft manually in Beehiiv
3. Verify next run only creates one draft

### No Notification Email Received

**Check**:
1. Resend dashboard for delivery status
2. Spam folder
3. Verify `RESEND_API_KEY` is valid
4. Check Inngest logs for step 5 (send-notification)

**Fix**:
1. Update email address in `inngest/newsletter.function.ts` and `inngest/health-check.function.ts`
2. Verify Resend domain is verified (if using custom domain)

---

## Monitoring

### What to Check Weekly

**Before Monday 8am UTC**:
- [ ] Health check passed (check email from previous day)
- [ ] No Vercel deployment errors
- [ ] Inngest dashboard shows both functions registered

**After Monday 8am UTC**:
- [ ] Newsletter run completed successfully (check Inngest)
- [ ] Notification email received
- [ ] Draft appears in Beehiiv
- [ ] Archive file in Google Drive

### Monthly Review

1. Check `lib/metadata/drafts.json` for trends:
   - Average cost per draft
   - Quality check pass rate
   - Word count consistency
2. Review feedback entries
3. Adjust skill file based on patterns

---

## Cost Monitoring

### Check Current Month Spend

**Anthropic**:
1. Visit console.anthropic.com
2. Usage → Current month
3. Should be ~$0.50/month (4 runs × ~$0.12)

**Alert if**:
- Single run costs > $0.50
- Monthly total > $2.00

**Investigate**:
1. Check Inngest logs for token usage
2. Look for retry loops (failed runs retrying multiple times)
3. Review `lib/metadata/drafts.json` for `anthropicCost` field

---

## Updating Dependencies

### Update Anthropic SDK
```bash
cd banking-on-ai-automation
npm update @anthropic-ai/sdk
npm run build  # Test locally
git commit -am "Update Anthropic SDK"
git push  # Vercel auto-deploys
```

### Update Inngest
```bash
npm update inngest
# Test locally first
npm run dev
# Trigger test run
# If successful, deploy
git push
```

---

## Emergency Procedures

### Disable Automation Immediately

**Option 1: Pause cron**
1. Go to cron-job.org
2. Find "Banking on AI Newsletter" job
3. Click "Disable"

**Option 2: Break the trigger route**
1. Go to Vercel → Environment Variables
2. Change `CRON_SECRET` to something random
3. Cron will get 401 Unauthorized

### Manual Newsletter Creation

If automation fails and you need to send manually:

1. Search Gmail manually for AI/fintech news
2. Draft newsletter in your editor
3. Create draft directly in Beehiiv UI
4. Send as normal

### Rollback Deployment

1. Go to Vercel → Deployments
2. Find last working deployment
3. Click "..." → Promote to Production

---

## Support Contacts

- **Inngest**: support@inngest.com or dashboard chat
- **Vercel**: vercel.com/support
- **Anthropic**: support@anthropic.com
- **Beehiiv**: support@beehiiv.com

---

## Useful Links

- Inngest Dashboard: https://app.inngest.com
- Vercel Dashboard: https://vercel.com/dashboard
- Beehiiv Dashboard: https://app.beehiiv.com
- Anthropic Console: https://console.anthropic.com
- Google Cloud Console: https://console.cloud.google.com
- Resend Dashboard: https://resend.com/emails
- cron-job.org: https://console.cron-job.org
