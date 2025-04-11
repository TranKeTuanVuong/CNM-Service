
  const mongoose = require("mongoose");
  
  const MessageSchema = new mongoose.Schema({
      messageID: { type: String, unique: true, required: true },
      chatID: { type: String, unique: true, required: true },
      senderID: { type: String, unique: true, required: true },
      content: { type: String, required: true },
      type: { type: String, enum: ["text", "image", "video"], required: true },
      timestamp: { type: Date, default: Date.now },
      status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent'},
    },{
      versionKey: false 
    });
    
    const messages = mongoose.model("messages",MessageSchema,"messages");
  
    module.exports = messages;