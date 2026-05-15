// inngest/health-check.function.ts
// Daily health monitoring for all external services

import { inngest } from './client';
import { getGoogleAccessToken } from '../lib/auth/google';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy';
  message: string;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════
// Helper: Test Google OAuth token refresh
// ═══════════════════════════════════════════════════════════════════
async function testGoogleAuth(): Promise<HealthCheckResult> {
  try {
    await getGoogleAccessToken();

    return {
      service: 'Google OAuth',
      status: 'healthy',
      message: 'Token refresh successful',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'Google OAuth',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Helper: Test LLM API connectivity
// ═══════════════════════════════════════════════════════════════════
async function testLLMAPI(): Promise<HealthCheckResult> {
  try {
    const apiUrl = process.env.LLM_API_URL;
    const apiKey = process.env.LLM_API_KEY;
    const model = process.env.LLM_MODEL;

    if (!apiUrl || !apiKey || !model) {
      throw new Error('LLM env vars not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return {
      service: 'LLM API',
      status: 'healthy',
      message: `${model} is reachable`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'LLM API',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Helper: Test Beehiiv API
// ═══════════════════════════════════════════════════════════════════
async function testBeehiiv(): Promise<HealthCheckResult> {
  try {
    const apiKey = process.env.BEEHIIV_API_KEY;
    const publicationId = process.env.BEEHIIV_PUBLICATION_ID;

    if (!apiKey || !publicationId) {
      throw new Error('Beehiiv env vars not configured');
    }

    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${publicationId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }

    return {
      service: 'Beehiiv API',
      status: 'healthy',
      message: 'API key valid and publication accessible',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'Beehiiv API',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Helper: Send health check alert email
// ═══════════════════════════════════════════════════════════════════
async function sendHealthAlert(results: HealthCheckResult[]): Promise<void> {
  const unhealthy = results.filter(r => r.status === 'unhealthy');

  if (unhealthy.length === 0) {
    return;
  }

  const htmlContent = `
    <h2>Banking on AI — Health Check Failed</h2>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    <p><strong>Failed services:</strong> ${unhealthy.length} / ${results.length}</p>

    <h3>Service Status</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <thead>
        <tr>
          <th>Service</th>
          <th>Status</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(r => `
          <tr style="background: ${r.status === 'healthy' ? '#e8f5e9' : '#ffebee'}">
            <td>${r.service}</td>
            <td>${r.status === 'healthy' ? 'OK' : 'FAIL'}</td>
            <td>${r.message}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const resendApiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFICATION_EMAIL || 'your@email.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'automation@yourdomain.com';

  if (!resendApiKey) {
    console.error('Cannot send health alert — RESEND_API_KEY not set');
    return;
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmail,
      subject: `Banking on AI — ${unhealthy.length} service(s) unhealthy`,
      html: htmlContent,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════
// Main Health Check Function
// ═══════════════════════════════════════════════════════════════════
export const healthCheckFunction = inngest.createFunction(
  {
    id: 'newsletter-health-check',
    name: 'Daily Health Check for Newsletter Services',
    retries: 1,
  },
  { cron: '0 0 * * *' },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (ctx) => {
    console.log('Starting daily health check...');

    const results = await ctx.step.run('run-health-checks', async () => {
      const [google, llm, beehiiv] = await Promise.all([
        testGoogleAuth(),
        testLLMAPI(),
        testBeehiiv(),
      ]);

      const inngestCheck: HealthCheckResult = {
        service: 'Inngest',
        status: 'healthy',
        message: 'Function executed successfully',
        timestamp: new Date().toISOString(),
      };

      return [google, llm, beehiiv, inngestCheck];
    });

    await ctx.step.run('send-alert-if-needed', async () => {
      await sendHealthAlert(results);
    });

    const healthyCount = results.filter(r => r.status === 'healthy').length;

    console.log(`Health check complete: ${healthyCount}/${results.length} services healthy`);

    return {
      timestamp: new Date().toISOString(),
      results,
      allHealthy: healthyCount === results.length,
    };
  }
);