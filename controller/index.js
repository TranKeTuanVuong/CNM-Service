const nodemailer = require('nodemailer');
const Chats = require('../models/Chat');
const ChatMembers = require('../models/ChatMember');
const messages = require('../models/Messages');
const Users = require('../models/User');
const Contacts = require("../models/Contacts");
const Controller = {};

Controller.getUserByID = async (userID) => {
  try {
    const user = await Users.findOne({ userID: userID });
    if (!user) {
      return null
    }
    return user;
  } catch (error) {
    console.error('Lỗi khi lấy thông tin người dùng:', error);
    return null;
  }
}
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
Controller.getOneOnOneChat = async (loggedInUserID, friendUserID) => {
  try {
    // 1. Lấy danh sách chatID mà người dùng đăng nhập tham gia
    const memberDocs = await ChatMembers.find({ userID: loggedInUserID }).lean();
    const chatIDs = memberDocs.map(m => m.chatID);

    // 2. Tìm tất cả các chat private trong danh sách đó
    const privateChats = await Chats.find({ 
      chatID: { $in: chatIDs },
      type: 'private'
    }).lean();

    let targetChat = null;

    // 3. Duyệt từng chat để tìm chat chứa cả 2 người
    for (const chat of privateChats) {
      const members = await ChatMembers.find({ chatID: chat.chatID }).lean();
      const hasUser1 = members.some(m => m.userID === loggedInUserID);
      const hasUser2 = members.some(m => m.userID === friendUserID);
      if (hasUser1 && hasUser2) {
        targetChat = chat;
        break;
      }
    }

    // 4. Nếu không tìm thấy chat, return null
    if (!targetChat) {
      console.log("Chưa có chat 1-1 giữa hai người.");
      return null;
    }

    // 5. Lấy toàn bộ tin nhắn trong chat
    const messagesList = await messages.find({ chatID: targetChat.chatID }).sort({ timestamp: 1 }).lean();

    if (messagesList.length === 0) {
      // Không có tin nhắn nào nhưng vẫn trả về chat với lastMessage là []
      targetChat.lastMessage = [];
      return targetChat;
    }

    // 6. Nếu có tin nhắn, lấy thông tin sender
    const senderIDs = messagesList.map(msg => msg.senderID);
    const senders = await Users.find({ userID: { $in: senderIDs } }).lean();

    const enrichedMessages = messagesList.map(msg => {
      const sender = senders.find(u => u.userID === msg.senderID);
      return {
        ...msg,
        senderInfo: sender ? {
          name: sender.name,
          avatar: sender.anhDaiDien || null,
        } : null,
      };
    });

    targetChat.lastMessage = enrichedMessages;
    return targetChat;

  } catch (error) {
    console.error("Lỗi khi lấy chat 1-1:", error);
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
    // Tìm tất cả các yêu cầu kết bạn đang chờ mà người nhận là userID (contactID trong Contacts)
    const pendingRequests = await Contacts.find({
      contactID: userID,  // Người nhận là contactID (userID của người nhận yêu cầu)
      status: 'pending'   // Chỉ lấy những yêu cầu đang chờ
    }).exec();

    // Nếu không có yêu cầu nào
    if (pendingRequests.length === 0) {
      return null;
    }

    // Fetch thông tin chi tiết người gửi yêu cầu (người có contactID)
    const friendDetails = [];

    // Duyệt qua tất cả các yêu cầu đang chờ
    for (let request of pendingRequests) {
      const senderID = request.userID; // userID là người gửi yêu cầu

      // Lấy thông tin người gửi từ Users
      const senderUser = await Users.findOne({ userID: senderID }).select('name anhDaiDien sdt').exec();

      if (senderUser) {
        friendDetails.push({
          userID: senderID,  // Trả về userID của người gửi yêu cầu kết bạn (người đã gửi)
          name: senderUser.name,
          avatar: senderUser.anhDaiDien,
          phoneNumber: senderUser.sdt,
          alias: request.alias // Alias từ bảng Contacts
        });
      }
    }

    // Trả về danh sách yêu cầu kết bạn đang chờ với thông tin người gửi
   return friendDetails ;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách yêu cầu kết bạn:', error);
    return null;
  }
};
Controller.getContactsByUserID = async (userID) => {
  try {
    // 1. Lấy danh sách kết bạn đã accepted
    const contacts = await Contacts.find({
      $or: [{ userID: userID }, { contactID: userID }],
      status: "accepted"
    }).exec();
      
    // 2. Lấy danh sách userIDs là bạn của user đang đăng nhập
    const friendIDs = contacts.map(contact => {
      return contact.userID === userID ? contact.contactID : contact.userID;
    });

    // 3. Truy vấn thông tin người dùng từ danh sách bạn
    const friends = await Users.find({ userID: { $in: friendIDs } })
      .select('userID anhDaiDien sdt email name trangThai') // chọn các trường bạn cần
      .exec();

    return friends;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bạn bè:', error);
    return null;
  }
};

Controller.createChat = async (userID1,userID2)=>{
    try {
      const lastChat = await Chats.findOne().sort({ chatID: -1 }).limit(1);
        let chatID = '';
        console.log("lastChat",lastChat);
        if (!lastChat || !lastChat.chatID) {
          chatID = 'chat001';
        } else {
          const lastNumber = parseInt(lastChat.chatID.replace('chat', ''), 10);
          const newNumber = lastNumber + 1;
          chatID = `chat${newNumber.toString().padStart(3, '0')}`;
        }
      const user2 = await Users.findOne({ userID: userID2 });
      // name: { type: String, required: true },
      // userID: { type: String, unique: true, required: true },
      // type: { type: String, required: true },
      // created_at: { type: Date, default: Date.now },
      const newChat = new Chats({
        chatID: chatID,
        type: 'private',
        name: user2.name,
        created_at: Date.now(),
      });
      const saveChat = await newChat.save();
      if (!saveChat) {
        console.error('Lỗi khi tạo chat:', error);
        return false;
      }
      // userID: { type: String, unique: true, required: true },
      // memberID: { type: String, unique: true, required: true },
      // role: { type: String, required: true },
      // chatID: { type: String, unique: true, required: true }
      // Tạo chat members cho cả hai người dùng
      const chatMember1 = new ChatMembers({
        userID: userID1,
        memberID: userID2,
        role: 'admin',
        chatID: newChat.chatID,
      });
      const chatMember2 = new ChatMembers({
        userID: userID2,
        memberID: userID1,
        role: 'member',
        chatID: newChat.chatID,
      });
      const saveChatMember1 = await chatMember1.save();
      const saveChatMember2 = await chatMember2.save();
      if (!saveChatMember1 || !saveChatMember2) {
        console.error('Lỗi khi tạo chat members:', error);
        return false;
      }
      return true;

    } catch (error) {
      console.error('Lỗi khi tạo chat 1-1:', error);
      return false;
      
    }
};


module.exports = Controller;