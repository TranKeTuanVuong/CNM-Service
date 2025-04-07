const cloudinary = require("cloudinary").v2;
require("dotenv").config();
const multer = require("multer");
const express = require("express");
const app = express();
const { CloudinaryStorage } = require("multer-storage-cloudinary");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "AnhChat", // Tên thư mục trên Cloudinary
    format: async (req, file) => "png", // Định dạng ảnh
    public_id: (req, file) => file.originalname, // Tên file
  },
});

const upload = multer({ storage: storage });
app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({ url: req.file.path });
});

// Khởi chạy server
app.listen(3000, () => console.log("Server is running on port 3000"));