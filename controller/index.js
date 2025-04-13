const nodemailer = require('nodemailer');
const Chats = require('../models/Chat');
const ChatMembers = require('../models/ChatMember');
const messages = require('../models/Messages');
const Users = require('../models/User');
const Contacts = require("../models/Contacts");
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
Controller.getChatsForUser = async (userID) => {
  try {
    // 1. Lấy danh sách chatID từ chat_members
    const memberDocs = await ChatMembers.find({ userID }).lean();
    const chatIDs = memberDocs.map(m => m.chatID);
    // 2. Lấy thông tin chat tương ứng
    const chats = await Chats.find({ chatID: { $in: chatIDs } }).lean();
    // 3. Gắn thêm tin nhắn cuối cùng + thông tin người gửi
    for (let chat of chats) {
      const lastMsg = await messages.find({ chatID: chat.chatID })
        .sort({ timestamp: -1 })
        .lean();
      // Lấy toàn bộ senderID trong mảng lastMsg
      const senderIDs = lastMsg.map(msg => msg.senderID);
      const senders = await Users.find({ userID: { $in: senderIDs } }).lean();
      // Map từng msg với sender
      const enrichedMessages = lastMsg.map(msg => {
        const sender = senders.find(u => u.userID === msg.senderID);
        return {
          ...msg,
          senderInfo: sender ? {
            name: sender.name,
            avatar: sender.anhDaiDien || null,
          } : null,
        };
      });

      chat.lastMessage = enrichedMessages;
    }

    console.log("Danh sách chat sau khi gán user cho tin nhắn cuối:", chats);
    return chats;
  } catch (error) {
    console.error("Lỗi khi lấy chat:", error);
    throw error;
  }
};
Controller.getCreatMessageByChatID = async (newMsg)=>{
  try {
    const lastMessage  = await messages.findOne().sort({ messageID: -1 }).limit(1);
    if (!lastMessage) {
      return 'msg001';
    }
  const lastMessageID = lastMessage.messageID;
  const lastNumber = parseInt(lastMessageID.replace('msg', ''), 10);  // Tách phần số từ userID
  const newNumber = lastNumber + 1;  // Tăng số lên 1

  // Đảm bảo rằng userID có 3 chữ số
  const messageID = `msg${newNumber.toString().padStart(3, '0')}`;
    const newMessage = new messages({
      messageID: messageID,
      chatID: newMsg.chatID,
      senderID: newMsg.senderID,
      content: newMsg.content,
      type: newMsg.type,
      timestamp: newMsg.timestamp,
      media_url:newMsg.media_url,
      status: newMsg.status,
    });
   const saveMsg= await newMessage.save();
   return saveMsg;
  } catch (error) {
    console.error("Lỗi khi lấy chat:", error);
    throw error;
  }
};
Controller.getChatMembersByChatID = async (chatID) => {
  try {
    const chatmembers = await ChatMembers.findOne({chatID: chatID });
    if (!chatmembers) {
        return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện!" });
    }
    return chatmembers;
} catch (error) {
    res.status(500).json({ error: error.message });
}
};
Controller.getContacts = async (userID) => {
  try {
    // Find all pending friend requests where the user is the receiver
    const pendingRequests = await Contacts.find({
      userID: userID,  // The user is the receiver
      status: 'pending'   // Only look for pending requests
    }).exec();

    // If there are no pending requests
    if (pendingRequests.length === 0) {
      return null
    }

    // Fetch user details for each contactID (sender of the request)
    const friendDetails = [];

    // Loop through each pending request
    for (let request of pendingRequests) {
      const contactID = request.userID; // The contactID is the sender of the request

      // Fetch user details for the contact (sender)
      const contactUser = await Users.findOne({ userID: contactID }).select('name anhDaiDien sdt').exec();

      if (contactUser) {
        friendDetails.push({
          contactID,
          name: contactUser.name,
          avatar: contactUser.anhDaiDien,
          phoneNumber: contactUser.sdt,
          alias: request.alias // The alias from the Contact collection
        });
      }
    }

    // Return the list of pending requests with user details
   return friendDetails;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách yêu cầu kết bạn:', error);
    return null; // Hoặc xử lý lỗi theo cách khác
  }
};



module.exports = Controller;