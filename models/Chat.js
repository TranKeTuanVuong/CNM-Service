const mongoose = require("mongoose");

const Chatchema = new mongoose.Schema({
    name: { type: String, required: true },
    userID: { type: String, unique: true, required: true },
    type: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },{
    versionKey: false 
  });
  const Chats = mongoose.model("Chats", Chatchema,"Chats");

  module.exports = Chats;