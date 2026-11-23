// utils/clearUploads.js
const fs = require('fs');
const path = require('path');

function clearUploads() {
  const dir = path.join(__dirname, '../uploads');
  fs.readdir(dir, (err, files) => {
    if (err) {
      console.error('Could not list the uploads directory.', err);
      return;
    }
    files.forEach(file => {
      const filePath = path.join(dir, file);
      fs.unlink(filePath, err => {
        if (err) console.error('Error deleting', filePath, err);
      });
    });
  });
}

module.exports = clearUploads;
