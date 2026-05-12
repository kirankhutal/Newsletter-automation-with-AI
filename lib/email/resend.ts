// lib/email/resend.ts
// Resend API wrapper for sending notification emails

export interface NotificationOptions {
  success: boolean;
  title?: string;
  beehiivUrl?: string;
  error?: string;
  failedStep?: string;
  inngestRunUrl?: string;
  weekDescription: string;
}

export async function sendNotification(options: NotificationOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFICATION_EMAIL || 'kirankhutal@gmail.com';

  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — skipping notification');
    return;
  }

  const { success, title, beehiivUrl, error, failedStep, inngestRunUrl, weekDescription } = options;

  const subject = success
    ? `✅ Banking on AI draft ready — ${weekDescription}`
    : `❌ Banking on AI automation failed — ${weekDescription}`;

  const htmlContent = success
    ? `
      <h2>✅ Newsletter Draft Ready</h2>
      <p><strong>Week:</strong> ${weekDescription}</p>
      <p><strong>Title:</strong> ${title}</p>

      <h3>Next Step</h3>
      <p>Review the draft in Beehiiv and hit Send when ready.</p>
      <p><a href="${beehiivUrl}">📬 Open draft in Beehiiv</a></p>

      <p style="color: #666; font-size: 12px;">
        <a href="${inngestRunUrl}">View execution details</a>
      </p>
    `
    : `
      <h2>❌ Newsletter Generation Failed</h2>
      <p><strong>Week:</strong> ${weekDescription}</p>
      <p><strong>Failed at:</strong> ${failedStep}</p>
      <p><strong>Error:</strong> ${error}</p>

      <h3>Quick Actions</h3>
      <ul>
        <li><a href="${inngestRunUrl}">View error details in Inngest</a></li>
        <li><a href="${inngestRunUrl}/replay">Replay from failed step</a></li>
      </ul>
    `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Banking on AI <automation@yourdomain.com>',
      to: toEmail,
      subject,
      html: htmlContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Resend notification failed: ${response.status} - ${errorText}`);
    // Don't throw — notification failure should not block the pipeline
  }
}
