const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userID: { type: String, unique: true, required: true },
    SDT: { type: String, unique: true, required: true },
    anhDaiDien: { type: String },
    matkhau: { type: String, required: true },
    trangThai: { type: String, enum: ["online", "offline"], default: "offline" },
    ngayTao: { type: Date, default: Date.now },
    ngaySuaDoi: { type: Date, default: Date.now },
    ngaysinh: { type: Date },
    anhBia: { type: String },
    gioiTinh: { type: String, enum: ["Nam", "Nữ", "Khác"] },
  });
  
  const Users = mongoose.model("Users", UserSchema,"Users");


  module.exports = Users;