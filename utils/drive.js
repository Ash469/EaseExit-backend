// src/utils/drive.js
const fs = require('fs');
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const drive = google.drive({ version: 'v3', auth: oauth2Client });

/**
 * Uploads a file to Google Drive and makes it publicly readable.
 * @param {string} filePath   - local path to the file
 * @param {string} fileName   - desired name in Drive
 * @param {string} mimeType   - e.g. 'image/png', 'application/pdf'
 * @returns {Promise<string>} - a shareable URL
 */
async function uploadToDrive(filePath, fileName, mimeType) {
  // 1️⃣ Create the file in Drive
  const { data } = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [process.env.DRIVE_FOLDER_ID],
    },
    media: {
      mimeType,
      body: fs.createReadStream(filePath),
    },
    fields: 'id, webContentLink',
  });

  const fileId = data.id;

  // 2️⃣ Make it public
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  // 3️⃣ Return a direct‐download/view URL
  return `${fileId}`;
}

module.exports = { uploadToDrive };
