const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./configcloudinary");
const { v4: uuidv4 } = require("uuid");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "AnhChat",
    format: async (req, file) => "jpg", // hoặc lấy từ file mimetype
    public_id: (req, file) => uuidv4(),
  },
});

const upload = multer({ storage });
module.exports = upload;
