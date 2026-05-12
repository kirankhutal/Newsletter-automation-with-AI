// app/api/newsletter/route.ts
// Thin trigger route - fires Inngest event and returns immediately

import { inngest } from '../../../inngest/client';
import { getWeekIdentifier } from '../../../lib/utils/week';

export async function GET(req: Request) {
  // Validate cron secret
  const auth = req.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (auth !== expectedAuth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Calculate week identifier for idempotency
  const week = getWeekIdentifier();

  try {
    // Fire the Inngest event - returns immediately
    await inngest.send({
      name: 'newsletter/draft.requested',
      data: {
        week,
        triggeredAt: new Date().toISOString(),
        source: 'cron',
      },
    });

    return Response.json({
      status: 'queued',
      message: 'Banking on AI draft job dispatched to Inngest',
      week,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to dispatch Inngest event:', error);
    return Response.json(
      { 
        error: 'Failed to queue newsletter job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
