const mongoose = require("mongoose");

const Chatchema = new mongoose.Schema({
    chatID: { type: String, required: true },
    type: { type: String, required: true },
    avatar: { type: String, required: true },
    name: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },{
    versionKey: false 
  });
  const Chats = mongoose.model("Chats", Chatchema,"Chats");

  module.exports = Chats;