/**
 * Google Drive Upload/Management Script for Hospital DB Backups
 * Uses OAuth 2.0 User authorization (fully headless with refresh tokens).
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load config
const envPath = path.join(__dirname, '.env');
const config = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...val] = line.trim().split('=');
    if (key && !key.startsWith('#')) config[key] = val.join('=');
  });
}

const FOLDER_ID = config.DRIVE_FOLDER_ID;
const CREDENTIALS_FILE = path.join(__dirname, 'oauth-credentials.json');
const TOKEN_FILE = path.join(__dirname, 'tokens.json');

if (!FOLDER_ID) {
  console.error('ERROR: DRIVE_FOLDER_ID not set in backup/.env');
  process.exit(1);
}
if (!fs.existsSync(CREDENTIALS_FILE)) {
  console.error('ERROR: oauth-credentials.json not found in backup/. Please run authorize.js first.');
  process.exit(1);
}
if (!fs.existsSync(TOKEN_FILE)) {
  console.error('ERROR: tokens.json not found in backup/. Please run authorize.js first.');
  process.exit(1);
}

async function getAuth() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris ? redirect_uris[0] : 'urn:ietf:wg:oauth:2.0:oob'
  );

  const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE));
  oauth2Client.setCredentials(tokens);

  // Auto-update tokens if refreshed
  oauth2Client.on('tokens', (newTokens) => {
    const currentTokens = JSON.parse(fs.readFileSync(TOKEN_FILE));
    const mergedTokens = { ...currentTokens, ...newTokens };
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(mergedTokens, null, 2));
  });

  return oauth2Client;
}

async function getDrive() {
  const auth = await getAuth();
  return google.drive({ version: 'v3', auth });
}

// ─── UPLOAD ────────────────────────────────────────────
async function uploadFile(filePath) {
  const drive = await getDrive();
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);

  console.log(`Uploading: ${fileName} (${sizeMB} MB)`);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [FOLDER_ID],
    },
    media: {
      mimeType: 'application/gzip',
      body: fs.createReadStream(filePath),
    },
    fields: 'id, name, size',
  });

  console.log(`SUCCESS: Uploaded as ${res.data.name} (Drive ID: ${res.data.id})`);
  return res.data;
}

// ─── LIST ──────────────────────────────────────────────
async function listFiles() {
  const drive = await getDrive();
  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and trashed = false`,
    fields: 'files(id, name, size, createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  });

  const files = res.data.files || [];
  if (files.length === 0) {
    console.log('No backups found on Google Drive.');
    return files;
  }

  console.log(`\n  # | Created              | Size       | Name`);
  console.log(`----+----------------------+------------+------------------------------`);
  files.forEach((f, i) => {
    const date = new Date(f.createdTime).toLocaleString('en-IN');
    const sizeMB = ((parseInt(f.size) || 0) / (1024 * 1024)).toFixed(2);
    console.log(`  ${String(i + 1).padStart(2)} | ${date.padEnd(20)} | ${(sizeMB + ' MB').padEnd(10)} | ${f.name}`);
  });
  console.log('');
  return files;
}

// ─── PRUNE ─────────────────────────────────────────────
async function pruneFiles(keepCount) {
  const drive = await getDrive();
  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and trashed = false`,
    fields: 'files(id, name, createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  });

  const files = res.data.files || [];
  if (files.length <= keepCount) {
    console.log(`Prune: ${files.length} backups on Drive, keeping ${keepCount}. Nothing to delete.`);
    return;
  }

  const toDelete = files.slice(keepCount);
  console.log(`Prune: Deleting ${toDelete.length} old backup(s)...`);

  for (const f of toDelete) {
    await drive.files.delete({ fileId: f.id });
    console.log(`  Deleted: ${f.name}`);
  }
  console.log('Prune complete.');
}

// ─── DOWNLOAD ──────────────────────────────────────────
async function downloadFile(fileId, destPath) {
  const drive = await getDrive();

  // If fileId is a number (index), resolve it
  let resolvedId = fileId;
  if (/^\d+$/.test(fileId)) {
    const files = await listFiles();
    const idx = parseInt(fileId) - 1;
    if (idx < 0 || idx >= files.length) {
      console.error(`Invalid index: ${fileId}. Choose 1-${files.length}`);
      process.exit(1);
    }
    resolvedId = files[idx].id;
    if (!destPath) {
      destPath = path.join(__dirname, files[idx].name);
    }
  }

  console.log(`Downloading file ${resolvedId} to ${destPath}...`);
  const res = await drive.files.get(
    { fileId: resolvedId, alt: 'media' },
    { responseType: 'stream' }
  );

  const dest = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    res.data.pipe(dest);
    dest.on('finish', resolve);
    dest.on('error', reject);
  });

  console.log(`SUCCESS: Downloaded to ${destPath}`);
}

// ─── MAIN ──────────────────────────────────────────────
async function main() {
  const [,, command, arg1, arg2] = process.argv;

  switch (command) {
    case 'upload':
      if (!arg1) { console.error('Usage: node upload-to-drive.js upload <filePath>'); process.exit(1); }
      await uploadFile(arg1);
      break;

    case 'list':
      await listFiles();
      break;

    case 'prune':
      await pruneFiles(parseInt(arg1) || 7);
      break;

    case 'download':
      if (!arg1) { console.error('Usage: node upload-to-drive.js download <fileId|index> [destPath]'); process.exit(1); }
      await downloadFile(arg1, arg2);
      break;

    default:
      console.log('Hospital DB Backup — Google Drive Manager');
      console.log('');
      console.log('Commands:');
      console.log('  upload <filePath>              Upload a backup file to Drive');
      console.log('  list                           List all backups on Drive');
      console.log('  prune <keepCount>              Delete old backups, keep newest N');
      console.log('  download <id|index> [destPath] Download a backup from Drive');
      break;
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
