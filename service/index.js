// services/cloudinaryUpload.js
const cloudinary = require("../config/configcloudinary");
const { Readable } = require("stream");

function bufferToStream(buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// Danh sách định dạng được chấp nhận
const FILE_TYPE_MATCH = {
  image: ["image/png", "image/jpeg", "image/jpg", "image/gif"],
  video: ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"],
};

function randomString(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function uploadToCloudinary(file) {
  let fileType = null;

  if (FILE_TYPE_MATCH.image.includes(file.mimetype)) {
    fileType = "image";
  } else if (FILE_TYPE_MATCH.video.includes(file.mimetype)) {
    fileType = "video";
  } else {
    throw new Error(`${file.originalname} is not a supported file format`);
  }

  const publicId = `${fileType}_${randomString()}_${Date.now()}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: fileType === "image" ? "AnhChat" : "VideoChat",
        public_id: publicId,
        resource_type: "auto",
        // Bạn có thể thêm các option khác của Cloudinary ở đây nếu cần
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(`Upload failed for file ${file.originalname}: ${error.message}`);
        }
        return resolve(result.secure_url);
      }
    );

    bufferToStream(file.buffer).pipe(uploadStream);
  });
}

module.exports = uploadToCloudinary;
