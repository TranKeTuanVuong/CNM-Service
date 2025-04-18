const mongoose = require("mongoose");
  
const ChatMemberschema = new mongoose.Schema({
  chatID: { type: String, required: true },
  members: [
    {
      userID: { type: String, required: true },
      role: { type: String, required: true }
    }
  ]
}, {
  versionKey: false
});
const ChatMembers = mongoose.model("ChatMembers", ChatMemberschema,"ChatMembers");
  
module.exports = ChatMembers;