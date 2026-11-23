const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { google } = require("googleapis");

// 1️⃣ Create the OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// 2️⃣ Load your refresh token into it
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// 3️⃣ Now you can build the Drive service
const drive = google.drive({ version: "v3", auth: oauth2Client });

const router = express.Router();

// router.use(protect);

// Endpoint to download a file from Google Drive
router.get("/:id", async (req, res, next) => {
  try {
    const fileId = req.params.id;

    // ensure it's public
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // 1️⃣ Get the file’s metadata (including mimeType)
    const meta = await drive.files.get({
      fileId,
      fields: "mimeType",
    });
    const mimeType = meta.data.mimeType || "application/octet-stream";

    // 2️⃣ Set the correct header
    res.setHeader("Content-Type", mimeType);

    // 3️⃣ Now stream the file bytes
    const driveRes = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    driveRes.data.pipe(res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
