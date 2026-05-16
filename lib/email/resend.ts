// lib/email/resend.ts
// Resend API wrapper for sending notification emails

export interface NotificationOptions {
  success: boolean;
  title?: string;
  subtitle?: string;
  htmlContent?: string;
  beehiivUrl?: string;
  error?: string;
  failedStep?: string;
  inngestRunUrl?: string;
  weekDescription: string;
  wordCount?: number;
  linkCount?: number;
  pillarsFound?: string[];
  qualityWarnings?: string[];
}

export async function sendNotification(options: NotificationOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Banking on AI <automation@yourdomain.com>';
  const toEmail = process.env.NOTIFICATION_EMAIL || 'your@email.com';

  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — skipping notification');
    return;
  }

  const { success, title, subtitle, htmlContent, beehiivUrl, error, failedStep, inngestRunUrl, weekDescription, wordCount, linkCount, pillarsFound, qualityWarnings } = options;

  const subject = success
    ? `📬 Banking on AI — ${title || weekDescription}`
    : `❌ Banking on AI automation failed — ${weekDescription}`;

  const warningsHtml = qualityWarnings && qualityWarnings.length > 0
    ? `<div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px; margin-bottom: 20px;">
        <strong style="color: #856404;">⚠️ Quality warnings:</strong> ${qualityWarnings.join(', ')}
       </div>`
    : `<div style="background: #d4edda; border: 1px solid #28a745; border-radius: 4px; padding: 12px; margin-bottom: 20px;">
        <strong style="color: #155724;">✅ All quality checks passed</strong>
       </div>`;

  const qualitySummaryHtml = (wordCount !== undefined || pillarsFound)
    ? `<div style="background: #f8f9fa; border-radius: 4px; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #666;">
        ${wordCount !== undefined ? `📝 <strong>Words:</strong> ${wordCount} &nbsp;|&nbsp;` : ''}
        ${linkCount !== undefined ? `🔗 <strong>Links:</strong> ${linkCount} &nbsp;|&nbsp;` : ''}
        ${pillarsFound ? `🏛️ <strong>Pillars:</strong> ${pillarsFound.join(', ')}` : ''}
       </div>`
    : '';

  const successHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">📬 Newsletter Draft Ready</h2>
      <p style="color: #666;"><strong>Week:</strong> ${weekDescription}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p><strong>Title:</strong> ${title || 'N/A'}</p>
      <p><strong>Subtitle:</strong> ${subtitle || 'N/A'}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      ${warningsHtml}
      ${qualitySummaryHtml}
      <div style="font-size: 15px; line-height: 1.6;">
        ${htmlContent || ''}
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p><a href="${beehiivUrl}" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">📤 Copy to Beehiiv</a></p>
      ${inngestRunUrl ? `<p style="color: #999; font-size: 12px;"><a href="${inngestRunUrl}">View execution details</a></p>` : ''}
    </div>
  `;

  const failureHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #d00;">❌ Newsletter Generation Failed</h2>
      <p><strong>Week:</strong> ${weekDescription}</p>
      <p><strong>Failed at:</strong> ${failedStep}</p>
      <p><strong>Error:</strong> ${error}</p>
      ${inngestRunUrl ? `<p><a href="${inngestRunUrl}">View error details in Inngest</a></p>` : ''}
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmail,
      subject,
      html: success ? successHtml : failureHtml,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Resend notification failed: ${response.status} - ${errorText}`);
    // Don't throw — notification failure should not block the pipeline
  }
}
