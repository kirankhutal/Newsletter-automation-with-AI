import 'dotenv/config';
import { getGoogleAccessToken } from './lib/auth/google';

getGoogleAccessToken()
  .then(token => console.log('SUCCESS — token starts with:', token.slice(0,15) + '...'))
  .catch(err => console.error('FAILED:', err.message));
