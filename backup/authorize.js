/**
 * One-time authorization script to get refresh token for Google Drive API.
 * Starts a temporary local server to automatically receive the callback code.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

// Check both singular and plural filenames
let credentialsFile = path.join(__dirname, 'oauth-credentials.json');
if (!fs.existsSync(credentialsFile)) {
  credentialsFile = path.join(__dirname, 'oauth-credential.json');
}

const TOKEN_FILE = path.join(__dirname, 'tokens.json');
const PORT = 8085; // Local callback port
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

if (!fs.existsSync(credentialsFile)) {
  console.error('\nERROR: OAuth credentials JSON file not found.');
  console.error(`Please save your credentials to: ${path.join(__dirname, 'oauth-credentials.json')}\n`);
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credentialsFile));
const isWeb = !!credentials.web;
const clientInfo = credentials.installed || credentials.web;

if (!clientInfo) {
  console.error('ERROR: Invalid client credentials format.');
  process.exit(1);
}

if (isWeb) {
  console.warn('\n⚠️  WARNING: You are using a "Web Application" client ID.');
  console.warn(`Make sure you have added "${REDIRECT_URI}" to "Authorized redirect URIs" in your Google Cloud Console for this credential.`);
  console.warn('Recommended: Create a "Desktop app" credential instead, which does not require redirect URL configuration.\n');
}

const oauth2Client = new google.auth.OAuth2(
  clientInfo.client_id,
  clientInfo.client_secret,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

// Start temporary local server to capture authorization code
const server = http.createServer(async (req, res) => {
  const reqUrl = url.parse(req.url, true);
  if (reqUrl.pathname === '/callback') {
    const code = reqUrl.query.code;
    if (code) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #0f172a; color: #f1f5f9;">
            <div style="display: inline-block; padding: 30px; border: 1px solid #334155; border-radius: 12px; background: #1e293b;">
              <h2 style="color: #22c55e;">✅ Authorization Successful!</h2>
              <p>You can close this tab and return to the terminal.</p>
            </div>
          </body>
        </html>
      `);

      try {
        const { tokens } = await oauth2Client.getToken(code);
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
        console.log(`\nSUCCESS: Authorization complete! Tokens saved to ${TOKEN_FILE}\n`);
        server.close(() => {
          process.exit(0);
        });
      } catch (err) {
        console.error('Error exchanging code for tokens:', err.message);
        process.exit(1);
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Authorization code missing.');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log('------------------------------------------------------------');
  console.log('Hospital Backup System — Google Drive OAuth Authorization');
  console.log('------------------------------------------------------------');
  console.log('1. Open this URL in your browser:');
  console.log('\n' + authUrl + '\n');
  console.log('2. Sign in with your Google Account and approve permissions.');
  console.log('3. The script will automatically capture the code once authorized.');
  console.log('------------------------------------------------------------\n');
  console.log('Waiting for login redirect on http://localhost:8085...');
});
