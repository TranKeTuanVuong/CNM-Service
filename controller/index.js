const nodemailer = require('nodemailer');
const Controller = {};
Controller.sendOtpEmail = async (recipientEmail, otp) => {
  // Tạo một đối tượng transporter để cấu hình phương thức gửi email:
  //   service: 'gmail': dùng Gmail để gửi.
  //     auth: thông tin đăng nhập Gmail.
  //     user: địa chỉ Gmail của bạn.
  //     pass: App Password, không phải mật khẩu Gmail thông thường (phải bật xác thực 2 bước trên tài khoản Google để dùng được cái này).
//   App Password (Mật khẩu ứng dụng) là một mật khẩu đặc biệt mà Google cung cấp cho bạn để đăng nhập vào tài khoản Gmail từ ứng dụng bên thứ ba như:
//     Nodemailer
//     OutlookỨng dụng di động không hỗ trợ xác thực 2 bước (2FA)
// 🔥 Nó khác với mật khẩu Gmail thông thường. Đây là một mã gồm 16 ký tự, do Google tạo ra.
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject: 'Mã xác thực OTP của bạn',
    text: `Mã OTP của bạn là: ${otp}`,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log('Gửi OTP thành công');
  } catch (error) {
    console.error('Gửi OTP thất bại:', error);
  }
};

module.exports = Controller;