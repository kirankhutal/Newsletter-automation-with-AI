// scripts/get-google-token.mjs
// One-time script to get Google OAuth refresh token
// Run locally, never commit the output

import { google } from 'googleapis';
import readline from 'readline';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const scopes = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent', // Force consent screen to get refresh token
});

console.log('\n🔐 Google OAuth Setup\n');
console.log('1. Visit this URL and authorize the application:\n');
console.log(url);
console.log('\n2. Copy the authorization code from the browser\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('3. Paste the authorization code here: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('\n✅ Success! Your refresh token:\n');
    console.log('─────────────────────────────────────────────────');
    console.log(tokens.refresh_token);
    console.log('─────────────────────────────────────────────────\n');
    console.log('Add this to your .env.local and Vercel as:');
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('\n⚠️  Keep this token secret - it never expires unless revoked\n');
  } catch (error) {
    console.error('\n❌ Error getting token:', error.message);
  } finally {
    rl.close();
  }
});
