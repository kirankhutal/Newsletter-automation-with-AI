import 'dotenv/config';
import { runNewsletterHandler } from './inngest/newsletter.function';

runNewsletterHandler({ id: 'test-run', data: { week: '2026-05-11' } })
  .then(r => console.log('Done:', JSON.stringify(r, null, 2)))
  .catch(e => console.error('Failed:', e.message));