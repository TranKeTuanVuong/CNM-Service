// services/cloudinaryUpload.js
const cloudinary = require("../config/configcloudinary");
const { Readable } = require("stream");

function bufferToStream(buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

const FILE_TYPE_MATCH = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
];

function randomString(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function uploadToCloudinary(file) {
  if (!FILE_TYPE_MATCH.includes(file.mimetype)) {
    throw new Error(`${file.originalname} is not a valid image format`);
  }

  const publicId = `${randomString()}_${Date.now()}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "AnhChat",
        public_id: file.originalname.split(".")[0] + "_" + Date.now(),
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(error);
        }
        return resolve(result.secure_url);
      }
    );

    bufferToStream(file.buffer).pipe(uploadStream);
  });
}

module.exports = uploadToCloudinary;
