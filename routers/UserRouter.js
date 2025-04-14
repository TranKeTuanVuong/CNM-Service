const express = require("express");
const Users = require("../models/User");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Controller = require("../controller/index");
const upload = require("../middleware/index");
const uploadToCloudinary = require("../service/index");

// API lấy danh sách user
router.get("/users", async (req, res) => {
  try {
    const users = await Users.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/usersID", async (req, res) => {
  try {
    const { userID } = req.body;
    const user = await Users.find({ userID: userID });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.post("/login", async (req, res) => {
  const { sdt, matKhau } = req.body;
  console.log("📌 Đăng nhập với số:", sdt); // Log số điện thoại

  try {
    // Tìm người dùng trong cơ sở dữ liệu
    const user = await Users.findOne({ sdt });

    // Nếu người dùng không tồn tại
    if (!user) {
      console.log("❌ Không tìm thấy tài khoản!");
      return res.status(400).json({ message: "Sai số điện thoại hoặc mật khẩu!" });
    }

    // Kiểm tra mật khẩu
    console.log("🔐 Kiểm tra mật khẩu...");
    console.log("Mật khẩu:", matKhau);
    console.log("Mật khẩu trong db:", user.matKhau);

    // So sánh mật khẩu người dùng nhập vào với mật khẩu đã mã hóa trong cơ sở dữ liệu
    const isMatch = await bcrypt.compare(matKhau, user.matKhau); // So sánh mật khẩu đã mã hóa

    console.log("✅ Kết quả kiểm tra mật khẩu:", isMatch);

    if (!isMatch) {
      console.log("❌ Mật khẩu không đúng!");
      return res.status(400).json({ message: "Sai số điện thoại hoặc mật khẩu!" });
    }

    // Nếu mật khẩu đúng, trả về thông tin người dùng
    res.status(200).json({
      message: "Đăng nhập thành công!",
      user
    });

  } catch (error) {
    console.log("🔥 Lỗi server:", error);
    res.status(500).json({ message: error.message });
  }
});


const generateUserID = async () => {
  // Tìm người dùng cuối cùng để lấy ID lớn nhất
  const lastUser = await Users.findOne().sort({ userID: -1 }).limit(1);

  // Nếu không có người dùng nào, bắt đầu từ user001
  if (!lastUser) {
    return 'user001';
  }

  // Lấy số ID của người dùng cuối cùng, tăng 1 và tạo userID mới
  const lastUserID = lastUser.userID;
  const lastNumber = parseInt(lastUserID.replace('user', ''), 10);  // Tách phần số từ userID
  const newNumber = lastNumber + 1;  // Tăng số lên 1

  // Đảm bảo rằng userID có 3 chữ số
  return `user${newNumber.toString().padStart(3, '0')}`;
};
// API đăng ký người dùng
router.post("/registerUser",async (req, res) => {
  const { sdt, name, ngaySinh, matKhau,email,gioTinh} = req.body;

  if (!sdt || !name || !ngaySinh || !matKhau || !email) {
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
  
  const userid = await generateUserID(); // Tạo userID mới
  console.log("📌 userID mới:", userid); // Log userID mới
  // Tạo người dùng mới
  const user = await Users.create({
      name: name,
      userID: userid, 
      email: email, 
      anhDaiDien:"https://res.cloudinary.com/dgqppqcbd/image/upload/v1741595806/anh-dai-…",
      trangThai: "offline",
      ngaysinh: ngaySinh,
      anhBia:"https://res.cloudinary.com/dgqppqcbd/image/upload/v1741595806/anh-dai-…",
      gioTinh: gioTinh,
      sdt: sdt,
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
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    } else {
      return res.status(200).json({ success: true, user: updatedUser });
    }
  } catch (error) {
    console.error("Lỗi:", error.message);
    res.status(500).json({ error: error.message });
  }
});
// API lấy user theo email
router.post("/users/checksdt", async (req, res) => {
  try {
    const {sdt } = req.body;
    
    console.log("Sdt:", sdt); // Log email nhận được
    
    const userExists = await Users.exists({sdt:sdt}); // Kiểm tra sự tồn tại

    res.json({ exists: !!userExists }); // Trả về true nếu tồn tại, false nếu không
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

router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Thiếu địa chỉ email' });
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Tạo OTP ngẫu nhiên
  try {
    await Controller.sendOtpEmail(email, otp);
    res.status(200).json({ message: 'Gửi OTP thành công', otp });
  } catch (error) {
    res.status(500).json({ message: 'Gửi OTP thất bại', error: error.message });
  }
});

// Cập nhật thông tin người dùng
router.put("/update-user", async (req, res) => {
  const { userID, name, email, sdt, dob, gender, avatar, anhBia, matKhau } = req.body;

  // Kiểm tra các trường bắt buộc
  if (!userID || !name || !email || !sdt) {
    return res.status(400).json({ message: "Thiếu thông tin cần thiết!" });
  }

  try {
    // Tìm người dùng trong cơ sở dữ liệu
    const user = await Users.findOne({ userID });

    // Nếu người dùng không tồn tại
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại!" });
    }

    // Cập nhật thông tin người dùng
    user.name = name || user.name;
    user.email = email || user.email;
    user.sdt = sdt || user.sdt;

    // Chuyển đổi ngày sinh từ dd/mm/yyyy thành Date hợp lệ
    if (dob) {
      const dateParts = dob.split("/"); // dd/mm/yyyy
      const validDob = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`); // chuyển thành yyyy-mm-dd
      if (isNaN(validDob)) {
        return res.status(400).json({ message: "Ngày sinh không hợp lệ!" });
      }
      user.ngaysinh = validDob;
    }

    // Kiểm tra và cập nhật giới tính nếu hợp lệ
    if (gender && ["Nam", "Nữ", "Khác"].includes(gender)) {
      user.gioiTinh = gender || user.gioiTinh;
    } else if (gender) {
      return res.status(400).json({ message: "Giới tính không hợp lệ!" });
    }

    user.anhDaiDien = avatar || user.anhDaiDien;
    user.anhBia = anhBia || user.anhBia;

    // Nếu mật khẩu mới được cung cấp, mã hóa mật khẩu mới
    if (matKhau) {
      const hashedPassword = await bcrypt.hash(matKhau, 10); // Mã hóa mật khẩu mới
      user.matKhau = hashedPassword;
    }

    // Cập nhật thời gian sửa đổi
    user.ngaySuaDoi = Date.now();

    // Lưu lại người dùng đã được cập nhật
    await user.save();

    // Trả về phản hồi thành công
    res.status(200).json({ message: "Cập nhật thông tin thành công!", user });
  } catch (err) {
    console.error("Lỗi khi cập nhật người dùng:", err.message);
    res.status(500).json({ message: "Lỗi hệ thống", error: err.message });
  }
});

router.post("/upload", upload.array("files"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    console.log("File:", req.files); // Log file để kiểm tra
    
    
    const urls = await Promise.all(
      req.files.map(async (file) => await uploadToCloudinary(file))
    );

    res.json({ urls: await Promise.all(urls) }); // Trả về các URL đã upload
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Upload failed" });
  }
});
module.exports = router;
