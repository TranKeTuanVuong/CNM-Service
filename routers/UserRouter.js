const express = require("express");
const Users = require("../models/User");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
// API lấy danh sách user
router.get("/users", async (req, res) => {
  try {
    const users = await Users.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API lấy chi tiết user theo userID
// router.get("/users/:userID", async (req, res) => {
//   try {
//     const user = await Users.findOne({ userID: req.params.userID });
//     if (!user) return res.status(404).json({ message: "User không tồn tại" });
//     res.json(user);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });
router.post ("/login", async (req, res) => {
  const { sdt, matKhau } = req.body;
  console.log("📌 Đăng nhập với số:", sdt); // Log số điện thoại

  try {
      const user = await Users.findOne({ sdt});
      if (!user) {
          console.log("❌ Không tìm thấy tài khoản!");
          return res.status(400).json({ message: "Sai số điện thoại hoặc mật khẩu!" });
      }

      console.log("🔐 Kiểm tra mật khẩu...");
      console.log("Mật khẩu:", matKhau);
      console.log("Mật khẩu trong db:", user.matKhau);
      const isMatch = await bcrypt.compare(matKhau, user.matKhau);
      console.log("✅ Kết quả kiểm tra mật khẩu:", isMatch);
      console.log(user.anhDaiDien);
      if (!isMatch) {
          console.log("❌ Mật khẩu không đúng!");
          return res.status(400).json({ message: "Sai số điện thoại hoặc mật khẩu!" });
      }

    //  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
     // console.log("🎉 Đăng nhập thành công!");

      res.status(200).json({
          message: "Đăng nhập thành công!",
          user
      });
  } catch (error) {
      console.log("🔥 Lỗi server:", error);
      res.status(500).json({ message: error.message });
  }
});

router.post("/registerUser",async (req, res) => {
  const { sdt, name, ngaySinh, matKhau } = req.body;

  if (!sdt || !name || !ngaySinh || !matKhau) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin" });
  }

  // Kiểm tra xem người dùng đã tồn tại chưa
  const userExists = await Users.findOne({ sdt });
  if (userExists) {
      return res.status(400).json({ message: "Số điện thoại đã được đăng ký" });
  }

  // Mã hóa mật khẩu
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(matKhau, salt);

  // Tạo người dùng mới
  const user = await Users.create({
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
});

// API doi mat khau
router.post("/users/doimatkhau", async (req, res) => {
  try {
    const { sdt, matKhau } = req.body;
    const salt = await bcrypt.genSalt(10);
    const mk = await bcrypt.hash(matKhau, salt);
    const updatedUser = await Users.findOneAndUpdate(
      { sdt:sdt },
      { $set: { matKhau:mk}},
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ message: "User không tồn tại" });
    }else{
      res.json(updatedUser);
    }
  } catch (error) {
    console.error("Lỗi:", error.message);
    res.status(500).json({ error: error.message });
  }
});


// API lấy user theo email
router.post("/users/email", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Email:", email); // Log email nhận được
    
    const userExists = await Users.exists({ email: email }); // Kiểm tra sự tồn tại

    res.json({ exists: !!userExists }); // Trả về true nếu tồn tại, false nếu không
  } catch (error) {
    console.error("Lỗi:", error.message);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
