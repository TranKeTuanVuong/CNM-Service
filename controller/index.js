const nodemailer = require('nodemailer');
const Controller = {};
Controller.sendOtpEmail = async (recipientEmail, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: "tktvuong040103@gmail.com",
      pass: "tumgvyfdkwluqihz",
    },
  });
  const mailOptions = {
    from: 'tktvuong040103@gmail.com',
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