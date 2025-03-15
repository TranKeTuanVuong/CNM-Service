const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  userID: { type: String, unique: true },

  anhDaiDien: { type: String, default: "" },

  trangThai: { type: String, default: "offline" },
  ngayTao: { type: Date, default: Date.now },
  ngaySuaDoi: { type: Date, default: Date.now },
  ngaysinh: { type: Date },
  anhBia: { type: String, default: "" },
  gioTinh: { type: String, enum: ["Nam", "Nữ", "Khác"], default: "Khác" },
  sdt: { type: String, required: true },  // Đổi 'SDT' -> 'sdt'
  matKhau: { type: String, required: true } // Đổi 'matkhau' -> 'matKhau'
});

module.exports = mongoose.model("users", userSchema);
