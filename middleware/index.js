const multer = require("multer");

// Cấu hình multer để giới hạn dung lượng file
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1000 * 1024 * 1024 }, // Giới hạn dung lượng file là 50MB
});

module.exports = upload;
