// app/api/inngest/route.ts
// Inngest serve handler - exposes functions to Inngest platform

import { serve } from 'inngest/next';
import { inngest } from '../../../inngest/client';
import { newsletterFunction } from '../../../inngest/newsletter.function';
// import { healthCheckFunction } from '../../../inngest/health-check.function';
// Health check disabled — Inngest v4 cron trigger typing issue with TypeScript

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    newsletterFunction,
  ],
});
