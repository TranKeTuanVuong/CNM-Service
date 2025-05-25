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
  image: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"],
  video: ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"],
  audio: [
    "audio/mpeg",   // .mp3
    "audio/wav",
    "audio/webm",
    "audio/ogg"
  ],
  document: [
    "application/pdf",
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-powerpoint", // .ppt
    "application/vnd.openxmlformats-officedocument.presentationml.presentation" // .pptx
  ],
  archive: [
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/x-tar"
  ],
  text: [
    "text/plain",
    "text/csv",
    "application/json"
  ]
};


function randomString(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function uploadToCloudinary(file) {
  let fileType = null;

  if (FILE_TYPE_MATCH.audio.includes(file.mimetype)) {
    fileType = "audio";
  } else if (FILE_TYPE_MATCH.image.includes(file.mimetype)) {
    fileType = "image";
  } else if (FILE_TYPE_MATCH.video.includes(file.mimetype)) {
    fileType = "video";
  } else if (FILE_TYPE_MATCH.document.includes(file.mimetype)) {
    fileType = "document";
  } else if (FILE_TYPE_MATCH.archive.includes(file.mimetype)) {
    fileType = "archive";
  } else if (FILE_TYPE_MATCH.text.includes(file.mimetype)) {
    fileType = "text";
  } else {
    throw new Error(`${file.originalname} is not a supported file format`);
  }
   const ext = file.originalname.split('.').pop();
  const publicId = `${fileType}_${randomString()}_${Date.now()}.${ext}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: getUploadFolder(fileType),
        public_id: publicId,
        resource_type: getResourceType(fileType),
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
function getResourceType(fileType) {
  if (["image", "video", "audio"].includes(fileType)) {
    return fileType; // image, video, audio
  }
  return "raw"; // tất cả định dạng khác
}

// Folder mapping helper
function getUploadFolder(fileType) {
  switch (fileType) {
    case "image":
      return "AnhChat";
    case "video":
      return "VideoChat";
    case "audio":
      return "AudioChat";
    case "document":
      return "TaiLieuChat";
    case "archive":
      return "FileNenChat";
    case "text":
      return "TextChat";
    default:
      return "Khac";
  }
}



module.exports = uploadToCloudinary;
