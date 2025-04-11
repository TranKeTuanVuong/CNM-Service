const express = require("express");
const Contacts = require("../models/Contacts"); // Đảm bảo bạn sử dụng đúng đường dẫn
const Users = require("../models/User");
const router = express.Router();
const bodyParser = require('body-parser');

// Middleware để parse dữ liệu từ request
router.use(bodyParser.json());

const isValidPhoneNumber = (phoneNumber) => {
    const phoneRegex = /^(0[3,5,7,8,9])[0-9]{8}$/;
    return phoneRegex.test(phoneNumber);
  };
  
  // API để gửi yêu cầu kết bạn
  router.post('/send-friend-request', async (req, res) => {
    const { phoneNumber, userID } = req.body;
  
    // Kiểm tra nếu người dùng gửi yêu cầu cho chính mình
    try {
      // Tìm người dùng theo số điện thoại
      const targetUser = await Users.findOne({ sdt: phoneNumber });
  
      if (!targetUser) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng với số điện thoại này.' });
      }
  
      // Kiểm tra nếu userID và targetUser.userID là giống nhau (gửi yêu cầu cho chính mình)
      if (userID === targetUser.userID) {
        return res.status(400).json({ message: "Bạn không thể gửi yêu cầu kết bạn cho chính mình!" });
      }
  
      // Kiểm tra xem yêu cầu kết bạn đã tồn tại chưa
      const existingContact = await Contacts.findOne({
        $or: [
          { userID: targetUser.userID, contactID: userID },  // Kiểm tra yêu cầu từ userID đến contactID
          { userID: userID, contactID: targetUser.userID }   // Kiểm tra yêu cầu ngược lại
        ]
      });
  
      if (existingContact) {
        if (existingContact.status === 'pending') {
          return res.status(400).json({ message: 'Yêu cầu kết bạn đang chờ xử lý.' });
        } else if (existingContact.status === 'accepted') {
          return res.status(400).json({ message: 'Bạn đã là bạn bè với người này!' });
        } else {
          // Nếu trạng thái không phải là "pending" hay "accepted", chuyển trạng thái thành "pending"
          existingContact.status = 'pending';
          await existingContact.save();
          return res.status(200).json({ message: 'Yêu cầu kết bạn đã được gửi lại!' });
        }
      }
  
      // Nếu không có yêu cầu kết bạn, tạo yêu cầu mới
      const newContact = new Contacts({
        contactID: targetUser.userID,
        userID: userID,
        alias: `${targetUser.name}'s Friend`,
        status: 'pending', // Trạng thái yêu cầu đang chờ
        created_at: new Date(),
      });
  
      await newContact.save();
  
      return res.status(200).json({ message: 'Yêu cầu kết bạn đã được gửi!' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
    }
  });
  
  
  router.post('/accept-friend-request', async (req, res) => {
    const { userID, contactID } = req.body;
  
    try {
      // Tìm yêu cầu kết bạn với trạng thái "pending"
      const contactRequest = await Contacts.findOne({
        userID: userID,      // Người nhận yêu cầu
        contactID: contactID, // Người gửi yêu cầu
        status: 'pending'     // Trạng thái "pending"
      });
  
      if (!contactRequest) {
        return res.status(404).json({ message: 'Không tìm thấy yêu cầu kết bạn.' });
      }
  
      // Cập nhật trạng thái yêu cầu kết bạn thành 'accepted'
      contactRequest.status = 'accepted';
      await contactRequest.save();
  
      // Tạo yêu cầu kết bạn ngược lại cho người nhận
      const reverseContactRequest = new Contacts({
        userID: contactID,  // Người gửi yêu cầu
        contactID: userID,   // Người nhận yêu cầu
        alias: `${contactRequest.alias}'s Friend`,
        status: 'accepted',
        created_at: new Date(),
      });
  
      await reverseContactRequest.save();
  
      return res.status(200).json({ message: 'Yêu cầu kết bạn đã được chấp nhận!' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
    }
  });
  
  
  router.post('/reject-friend-request', async (req, res) => {
    const { userID, contactID } = req.body; // userID là người gửi yêu cầu, contactID là người nhận yêu cầu
  
    try {
      // Tìm yêu cầu kết bạn với trạng thái "pending"
      const contactRequest = await Contacts.findOne({
        userID: userID,  // Người gửi yêu cầu (userID)
        contactID: contactID,   // Người nhận yêu cầu (contactID)
        status: 'pending'    // Trạng thái "pending"
      });
  
      if (!contactRequest) {
        return res.status(404).json({ message: 'Không tìm thấy yêu cầu kết bạn.' });
      }
  
      // Cập nhật trạng thái yêu cầu kết bạn thành 'not-friends'
      contactRequest.status = 'not-friends';
      await contactRequest.save();
  
      return res.status(200).json({ message: 'Yêu cầu kết bạn đã bị từ chối!' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
    }
  });
  
module.exports = router;  