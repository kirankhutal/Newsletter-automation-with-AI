// lib/llm/client.ts
// Model-agnostic LLM client — works with any OpenAI-compatible REST endpoint

export interface GenerateOptions {
  skillPrompt: string;
  emailContent: string;
  previousTitle: string;
  previousSubtitle: string;
}

export interface GeneratedDraft {
  title: string;
  subtitle: string;
  html_content: string;
}

export async function generateNewsletter(options: GenerateOptions): Promise<GeneratedDraft> {
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!apiUrl || !apiKey || !model) {
    throw new Error(
      'Missing LLM configuration. Set LLM_API_URL, LLM_API_KEY, and LLM_MODEL in .env'
    );
  }

  const previousContext = options.previousTitle
    ? `\n\nLast week's title: "${options.previousTitle}"\nAvoid repeating these topics.`
    : '';

  const systemPrompt = `${options.skillPrompt}${previousContext}

CRITICAL: You MUST return a valid JSON object. Do not write any explanatory text before or after the JSON. Do not say "no sources" or ask for more input. If email sources are empty, generate content from your own knowledge of this week's AI in finance news.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Here are the email sources to draw from:\n\n${options.emailContent}\n\nIMPORTANT: If the above sources are empty or say "no emails found", use YOUR KNOWLEDGE of this week's AI in finance news to generate the newsletter. Do not refuse. Do not ask for more input. Always return JSON.\n\nCRITICAL REQUIREMENT: The html_content must be AT LEAST 800 words. Write thoroughly across all 4 pillars. Do not stop until you have reached 800+ words.` },
        ],
        temperature: 0.7,
        max_tokens: 8192,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const rawContent = data.choices[0]?.message?.content;

    if (!rawContent) {
      throw new Error('LLM returned empty response');
    }

    // Parse JSON from the response — strip any markdown code fences
    const jsonString = rawContent.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

    let parsed: GeneratedDraft;

    // ── Defensive JSON parsing ──────────────────────────────────────────────
    // Models can truncate mid-output; try to recover from partial JSON
    try {
      parsed = JSON.parse(jsonString) as GeneratedDraft;
    } catch {
      // Try to find and parse just the html_content portion
      const contentMatch = rawContent.match(/"html_content"\s*:\s*"([\s\S]*?)"(?:\s*,?\s*\}\s*$)?/);
      if (contentMatch) {
        const partialHtml = contentMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');

        const titleMatch = rawContent.match(/"title"\s*:\s*"([^"]+)"/);
        const subtitleMatch = rawContent.match(/"subtitle"\s*:\s*"([^"]+)"/);

        if (titleMatch && subtitleMatch && partialHtml.length > 200) {
          parsed = {
            title: titleMatch[1],
            subtitle: subtitleMatch[1],
            html_content: partialHtml,
          };
          console.warn('[LLM] Recovered truncated JSON — html_content extracted from partial output');
        } else {
          throw new Error(`LLM returned invalid JSON: ${jsonString.slice(0, 300)}`);
        }
      } else {
        throw new Error(`LLM returned invalid JSON: ${jsonString.slice(0, 300)}`);
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    if (!parsed.title || !parsed.subtitle || !parsed.html_content) {
      throw new Error('LLM response missing required fields: title, subtitle, html_content');
    }

    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
