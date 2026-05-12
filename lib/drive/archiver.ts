// lib/drive/archiver.ts
// Google Drive API — saves newsletter markdown copy to archive folder

import { getGoogleAccessToken } from '../auth/google';

export interface ArchiveOptions {
  weekDescription: string;
  title: string;
  subtitle: string;
  content: string;
  wordCount: number;
  generatedAt: string;
}

export async function archiveToDrive(options: ArchiveOptions): Promise<void> {
  const token = await getGoogleAccessToken();

  const markdownContent = `# ${options.title}

**Week:** ${options.weekDescription}
**Subtitle:** ${options.subtitle}

---

${options.content.replace(/<[^>]*>/g, '').trim()}

---

*Generated: ${options.generatedAt}*
*Word count: ${options.wordCount}*
`;

  // Create the file via Google Drive API multipart upload
  const boundary = `boundary_${Date.now()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    JSON.stringify({
      name: `Issue - ${options.weekDescription}.md`,
      mimeType: 'text/markdown',
      parents: ['appDataFolder'],
    }),
    `--${boundary}`,
    'Content-Type: text/markdown',
    '',
    markdownContent,
    `--${boundary}--`,
  ].join('\n');

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Google Drive archive failed: ${response.status} - ${errorText}`);
    // Don't throw — archive failure should not block the pipeline
  } else {
    const data = await response.json() as { name: string; id: string };
    console.log(`Archived to Drive: ${data.name} (${data.id})`);
  }
}
