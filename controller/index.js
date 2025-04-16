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
  try{
  const constacs = await  Contacts.find({
      $or: [{ userID: userID }, { contactID: userID }],
      status: "accepted" // Chỉ lấy những yêu cầu đã được chấp nhận
    }).exec();
    return constacs;
  }catch(error){
    console.error('Lỗi khi lấy danh sách yêu cầu kết bạn:', error);
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
Controller.createContact = async (userID,sdt )=>{
  try{
    if (userID === sdt) {
      return null; // Không cho phép gửi yêu cầu kết bạn cho chính mình
    }
      // Tìm người dùng theo số điện thoại
      const targetUser = await Users.findOne({ sdt: sdt });
  
      if (!targetUser) {
          return null;
      }
  
      // Kiểm tra xem yêu cầu kết bạn đã tồn tại chưa
      const existingContact = await Contacts.findOne({
          $or: [
              { userID: userID, contactID: targetUser.userID }, // Kiểm tra yêu cầu từ userID đến contactID
              { userID: targetUser.userID, contactID: userID }  // Kiểm tra yêu cầu ngược lại
          ]
      });
  
      if (existingContact) {
          if (existingContact.status === 'pending') {
              return null;
          } else if (existingContact.status === 'accepted') {
              return null
          } else {
              // Nếu trạng thái không phải là "pending" hay "accepted", chuyển trạng thái thành "pending"
              existingContact.status = 'pending';
              await existingContact.save();
              return ({ message: 'Yêu cầu kết bạn đã được gửi lại!' });
          }
      }
    
      // Nếu không có yêu cầu kết bạn, tạo yêu cầu mới
      const newContact = new Contacts({
          contactID:userID,
          userID: targetUser.userID,
          alias: `${targetUser.name}`,
          status: 'pending', // Trạng thái yêu cầu đang chờ
          created_at: new Date(),
      });
    
      await newContact.save();
  
    if (!newContact) {
      console.error("Failed to save new contact request.");
      return;
    }
    return newContact
  }catch (error) {
    console.error("Error creating contact:", error);
    return;
  }
};
// Hàm từ chối yêu cầu kết bạn
Controller.rejectFriendRequest = async (req, res) => {
    const { userID, contactID } = req.body;

    try {
        const contactRequest = await Contacts.findOneAndDelete({
            userID: contactID,
            contactID: userID,
            status: 'pending'
        });

        if (!contactRequest) {
            return res.status(404).json({ message: 'Không tìm thấy yêu cầu kết bạn để từ chối.' });
        }

        return res.status(200).json({ message: 'Yêu cầu kết bạn đã bị từ chối!' });
    } catch (error) {
        console.error('Lỗi khi từ chối yêu cầu kết bạn:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
    }
};

// Tìm kiếm bạn bè theo số điện thoại
Controller.searchFriendByPhone = async (req, res) => {
    const { phoneNumber, userID } = req.body;

    if (!phoneNumber || !userID) {
        return res.status(400).json({ message: 'Số điện thoại và userID là bắt buộc!' });
    }

    const phoneRegex = /^(0[3,5,7,8,9])[0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({ message: 'Số điện thoại không hợp lệ!' });
    }

    try {
        const currentUser = await Users.findOne({ userID });
        if (currentUser && phoneNumber === currentUser.sdt) {
            return res.status(200).json({
                userID: currentUser.userID,
                anhBia: currentUser.anhBia,
                name: currentUser.name,
                phoneNumber: currentUser.sdt,
                avatar: currentUser.anhDaiDien,
                friendStatus: "self"
            });
        }

        const targetUser = await Users.findOne({ sdt: phoneNumber });

        if (!targetUser) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng với số điện thoại này.' });
        }

        const existingContact = await Contacts.findOne({
            $or: [
                { userID: userID, contactID: targetUser.userID },
                { userID: targetUser.userID, contactID: userID }
            ]
        });

        let friendStatus = 'none';

        if (existingContact) {
            if (existingContact.status === 'pending') {
                friendStatus = 'pending';
            } else if (existingContact.status === 'accepted') {
                friendStatus = 'accepted';
            } else {
                friendStatus = 'rejected';
            }
        }

        res.status(200).json({
            userID: targetUser.userID,
            name: targetUser.name,
            phoneNumber: targetUser.sdt,
            friendStatus: friendStatus,
            avatar: targetUser.anhDaiDien
        });
    } catch (error) {
        console.error('Lỗi khi tìm kiếm người dùng:', error);
        res.status(500).json({ message: 'Có lỗi xảy ra khi tìm kiếm người dùng.' });
    }
};
Controller.acceptFriendRequest = async (req, res) => {
    const { contactID, userID } = req.body;

    if (!contactID || !userID) {
        return res.status(400).json({ message: 'Thiếu thông tin contactID hoặc userID.' });
    }

    try {
        const contactRequest = await Contacts.findOne({
            userID: contactID,
            contactID: userID,
            status: 'pending'
        });

        if (!contactRequest) {
            return res.status(404).json({ message: 'Không tìm thấy yêu cầu kết bạn để chấp nhận.' });
        }

        contactRequest.status = 'accepted';
        await contactRequest.save();

        await Contacts.updateOne(
            { userID: userID, contactID: contactID, status: 'pending' },
            { $set: { status: 'accepted' } }
        );

        return res.status(200).json({ message: 'Yêu cầu kết bạn đã được chấp nhận!' });
    } catch (error) {
        console.error('Lỗi khi chấp nhận yêu cầu kết bạn:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
    }
};
Controller.displayFriendRequest = async (userID) => {
  try {
    if (!userID) {
      throw new Error("userID không hợp lệ");
    }

    // Tìm các yêu cầu kết bạn đang chờ mà userID là người gửi hoặc người nhận
    const pendingRequests = await Contacts.find({
      $or: [
        { contactID: userID },
        { userID: userID }
      ],
      status: "pending",
    }).exec();

    if (pendingRequests.length === 0) {
      return [];
    }

    const friendDetails = [];

    for (let request of pendingRequests) {
      // Xác định ai là người gửi (không phải user hiện tại)
      const targetUserID = (request.contactID === userID) 
        ? request.userID 
        : request.contactID;

      const senderUser = await Users.findOne({ userID: targetUserID })
        .select("name anhDaiDien sdt")
        .exec();

      if (senderUser) {
        friendDetails.push({
          contactID: targetUserID,
          name: senderUser.name,
          avatar: senderUser.anhDaiDien,
          phoneNumber: senderUser.sdt,
          alias: request.alias,
        });
      }
    }

    return friendDetails;
  } catch (error) {
    console.error("❌ Error fetching pending friend requests:", error);
    throw error;
  }
};


module.exports = Controller;