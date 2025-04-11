const mongoose = require("mongoose");
  
const ChatMemberschema = new mongoose.Schema({
      userID: { type: String, unique: true, required: true },
      menberID: { type: String, unique: true, required: true },
      role: { type: String, required: true },
      chatID: { type: String, unique: true, required: true }
    },{
      versionKey: false 
    });
const Chats = mongoose.model("ChatMembers", ChatMemberschema,"ChatMembers");
  
module.exports = Chats;