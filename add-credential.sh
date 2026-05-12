#!/bin/bash
# Simple script to add credentials to .env.local

ENV_FILE="/Users/kiran/CODING/Goose/banking-on-ai-automation/.env.local"

echo "🔑 Add Credential to .env.local"
echo "================================"
echo ""
echo "Which credential do you want to add?"
echo ""
echo "1) ANTHROPIC_API_KEY"
echo "2) BEEHIIV_API_KEY"
echo "3) BEEHIIV_PUB_ID"
echo "4) INNGEST_EVENT_KEY"
echo "5) INNGEST_SIGNING_KEY"
echo "6) RESEND_API_KEY"
echo "7) GOOGLE_CLIENT_ID"
echo "8) GOOGLE_CLIENT_SECRET"
echo "9) GOOGLE_REFRESH_TOKEN"
echo ""
read -p "Enter number (1-9): " choice

case $choice in
  1) KEY="ANTHROPIC_API_KEY" ;;
  2) KEY="BEEHIIV_API_KEY" ;;
  3) KEY="BEEHIIV_PUB_ID" ;;
  4) KEY="INNGEST_EVENT_KEY" ;;
  5) KEY="INNGEST_SIGNING_KEY" ;;
  6) KEY="RESEND_API_KEY" ;;
  7) KEY="GOOGLE_CLIENT_ID" ;;
  8) KEY="GOOGLE_CLIENT_SECRET" ;;
  9) KEY="GOOGLE_REFRESH_TOKEN" ;;
  *) echo "Invalid choice"; exit 1 ;;
esac

echo ""
read -p "Paste the value for $KEY: " VALUE

# Update the .env.local file
sed -i '' "s|^${KEY}=.*|${KEY}=${VALUE}|" "$ENV_FILE"

echo ""
echo "✅ Added $KEY to .env.local"
echo ""
echo "Current status:"
grep -E "^(ANTHROPIC|BEEHIIV|INNGEST|RESEND|GOOGLE|CRON)_" "$ENV_FILE" | while read line; do
  if [[ $line == *"="* ]] && [[ ! $line =~ =$ ]]; then
    echo "  ✅ ${line%%=*}"
  else
    echo "  ⏳ ${line%%=*}"
  fi
done
