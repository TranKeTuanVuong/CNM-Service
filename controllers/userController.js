const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const express = require("express");

const router = express.Router();

// Đăng ký tài khoản
const registerUser = async (req, res) => {
    const { sdt, name, ngaySinh, matKhau } = req.body;

    if (!sdt || !name || !ngaySinh || !matKhau) {
        return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin" });
    }

    // Kiểm tra xem người dùng đã tồn tại chưa
    const userExists = await User.findOne({ sdt });
    if (userExists) {
        return res.status(400).json({ message: "Số điện thoại đã được đăng ký" });
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(matKhau, salt);

    // Tạo người dùng mới
    const user = await User.create({
        sdt,
        name,
        ngaySinh,
        matKhau: hashedPassword, // Lưu mật khẩu đã mã hóa
    });

    if (user) {
        res.status(201).json({
            message: "Đăng ký thành công",
            userId: user._id, // Trả về ID thay vì hashedPassword
        });
    } else {
        res.status(400).json({ message: "Đăng ký thất bại" });
    }
};

// Đăng nhập
const loginUser = async (req, res) => {
  const { sdt, matKhau } = req.body;
  console.log("📌 Đăng nhập với số:", sdt); // Log số điện thoại

  try {
      const user = await User.findOne({ sdt });
      if (!user) {
          console.log("❌ Không tìm thấy tài khoản!");
          return res.status(400).json({ message: "Sai số điện thoại hoặc mật khẩu!" });
      }

      console.log("🔐 Kiểm tra mật khẩu...");
      const isMatch = await bcrypt.compare(matKhau, user.matKhau);
      console.log("✅ Kết quả kiểm tra mật khẩu:", isMatch);

      if (!isMatch) {
          console.log("❌ Mật khẩu không đúng!");
          return res.status(400).json({ message: "Sai số điện thoại hoặc mật khẩu!" });
      }

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
      console.log("🎉 Đăng nhập thành công!");

      res.status(200).json({
          message: "Đăng nhập thành công!",
          token,
          user: {
              _id: user._id,
              name: user.name,
              sdt: user.sdt,
              trangThai: user.trangThai,
          },
      });
  } catch (error) {
      console.log("🔥 Lỗi server:", error);
      res.status(500).json({ message: error.message });
  }
};


module.exports = { registerUser, loginUser };
