// lib/beehiiv/client.ts
// Beehiiv REST API v2 wrapper for creating draft posts

export interface CreatePostOptions {
  title: string;
  subtitle: string;
  htmlContent: string;
}

export interface BeehiivPostResult {
  id: string;
  web_url: string;
  publish_url: string;
}

export async function createBeehiivDraft(options: CreatePostOptions): Promise<BeehiivPostResult> {
  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey || !publicationId) {
    throw new Error('Missing Beehiiv configuration. Set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID');
  }

  const response = await fetch(
    `https://api.beehiiv.com/v2/publications/${publicationId}/posts`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        title: options.title,
        subtitle: options.subtitle,
        html_content: options.htmlContent,
        state: 'draft', // Always create as draft
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Beehiiv API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { data: BeehiivPostResult };
  return data.data;
}
