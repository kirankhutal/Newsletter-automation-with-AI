// inngest/client.ts
// Singleton Inngest client for Banking on AI automation

import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'banking-on-ai',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
