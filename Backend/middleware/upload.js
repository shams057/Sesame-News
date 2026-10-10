const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  // autoriser jpeg, png, pdf, etc.
  const allowed = /jpeg|jpg|png|gif|pdf|mp4|doc|docx/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype) || file.mimetype.startsWith('image/');

  if (ext || mime) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

module.exports = upload;