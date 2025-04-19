
  const mongoose = require("mongoose");
  
  const MessageSchema = new mongoose.Schema({
    messageID: { type: String, unique: true, required: true },
    chatID: { type: String, required: true },
    senderID: { type: String, required: true },
    content: { type: String }, // Nội dung của tin nhắn, ví dụ tên file
    type: { 
      type: String, 
      enum: ["text", "image", "video", "emoji", "doc", "audio", "unsend", "file"],  // Thêm 'file' vào enum
      default: "text" 
    },
    timestamp: { type: Date, default: Date.now },
    media_url: { type: [String], default: [] },  // Lưu trữ URL của file đã upload
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  }, {
    versionKey: false 
  });
  
    
    const messages = mongoose.model("messages",MessageSchema,"messages");
  
    module.exports = messages;