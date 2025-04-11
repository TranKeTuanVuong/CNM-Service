const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  contactID: { type: String, required: true },
  userID: { type: String, required: true },
  alias: { type: String, required: true },
  status: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const Contacts = mongoose.model('Contacts', contactSchema, "Contacts");

module.exports = Contacts;
