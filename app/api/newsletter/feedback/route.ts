// app/api/newsletter/feedback/route.ts
// Feedback endpoint for tracking which drafts were sent/rejected

import { saveFeedback, loadFeedback, type FeedbackEntry } from '../../../../lib/metadata/store';
import { z } from 'zod';

const FeedbackSchema = z.object({
  draftId: z.string(),
  week: z.string(),
  action: z.enum(['sent', 'rejected', 'edited']),
  notes: z.string().optional().default(''),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = FeedbackSchema.parse(body);

    const feedback: FeedbackEntry = {
      draftId: validated.draftId,
      week: validated.week,
      action: validated.action,
      notes: validated.notes,
      timestamp: new Date().toISOString(),
    };

    saveFeedback(feedback);

    return Response.json({
      success: true,
      message: 'Feedback recorded',
      feedback,
    });
  } catch (error) {
    console.error('Failed to save feedback:', error);
    
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: 'Invalid feedback data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return Response.json(
      { 
        error: 'Failed to save feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve feedback history
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const week = searchParams.get('week');

    let feedback = loadFeedback();

    if (week) {
      feedback = feedback.filter(f => f.week === week);
    }

    return Response.json({
      success: true,
      count: feedback.length,
      feedback,
    });
  } catch (error) {
    console.error('Failed to load feedback:', error);
    return Response.json(
      { 
        error: 'Failed to load feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
