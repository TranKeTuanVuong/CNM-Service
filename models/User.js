const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userID: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    sdt: { type: String, unique: true, required: true },
    anhDaiDien: { type: String },
    matKhau: { type: String, required: true },
    trangThai: { type: String, enum: ["online", "offline"], default: "offline" },
    ngayTao: { type: Date, default: Date.now },
    ngaySuaDoi: { type: Date, default: Date.now },
    ngaysinh: { type: Date },
    anhBia: { type: String },
    gioiTinh: { type: String, enum: ["Nam", "Nữ", "Khác"] },
  });
  
  const Users = mongoose.model("Users", UserSchema,"Users");


  module.exports = Users;