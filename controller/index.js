const nodemailer = require('nodemailer');
const Chats = require('../models/Chat');
const ChatMembers = require('../models/ChatMember');
const messages = require('../models/Messages');
const Users = require('../models/User');
const Contacts = require("../models/Contacts");
const { pipeline } = require('nodemailer/lib/xoauth2');

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
    // 1. Lấy tất cả chatID mà user tham gia từ ChatMembers
    const memberDocs = await ChatMembers.find({ "members.userID": userID }).lean();  // Tìm kiếm theo "userID" trong mảng "members"
    const chatIDs = memberDocs.map(m => m.chatID);

    if (chatIDs.length === 0) return [];

    // 2. Lấy thông tin các cuộc chat
    const chats = await Chats.find({ chatID: { $in: chatIDs } }).lean();

    // 3. Lấy tất cả tin nhắn thuộc các cuộc chat
    const allMessages = await messages.find({ chatID: { $in: chatIDs } })
      .sort({ timestamp: 1 })
      .lean();

    // 4. Lấy toàn bộ sender info
    const senderIDs = [...new Set(allMessages.map(m => m.senderID))];
    const senders = await Users.find({ userID: { $in: senderIDs } }).lean();

    // 5. Gắn senderInfo vào mỗi tin nhắn
    const enrichedMessages = allMessages.map(msg => {
      const sender = senders.find(s => s.userID === msg.senderID);
      return {
        ...msg,
        senderInfo: sender ? {
          name: sender.name,
          avatar: sender.anhDaiDien || null,
        } : null,
      };
    });

    // 6. Gom tin nhắn theo chatID
    const messagesByChat = {};
    enrichedMessages.forEach(msg => {
      if (!messagesByChat[msg.chatID]) {
        messagesByChat[msg.chatID] = [];
      }
      messagesByChat[msg.chatID].push(msg);
    });

    // 7. Lấy tất cả thành viên của các chat từ ChatMembers
    const allMembers = await ChatMembers.find({ chatID: { $in: chatIDs } }).lean();

    // 8. Gom member theo chatID
    const membersByChat = {};
    allMembers.forEach(member => {
      if (!membersByChat[member.chatID]) {
        membersByChat[member.chatID] = [];
      }
      
      // Thêm thành viên vào danh sách
      member.members.forEach(m => {
        membersByChat[member.chatID].push({
          userID: m.userID,
          role: m.role,
        });
      });
    });

    // 9. Gắn tin nhắn và members vào từng chat
    const result = chats.map(chat => ({
      ...chat,
      lastMessage: messagesByChat[chat.chatID] || [], // Thêm tin nhắn vào mỗi chat
      members: membersByChat[chat.chatID] || []    // Thêm thành viên vào mỗi chat
    }));

    return result;

  } catch (error) {
    console.error("Lỗi khi lấy danh sách chat và tin nhắn:", error);
    throw error;
  }
};

// update trạng thái của người dùng
Controller.updateUserStatus = async (userID,trangThai) => {
  try {
    const user = await Users.findOneAndUpdate(
      { userID: userID },
      { $set: { trangThai: trangThai } },
      { new: true, runValidators: true }
    );
    if (!user) {
      console.error("Không tìm thấy người dùng với userID:", userID);
      return null;
    }
    return user;
  }catch (error) {
    console.error("Lỗi:", error.message);
    return null;
  }
};



// Controller.getOneOnOneChat = async (loggedInUserID, friendUserID) => {
//   try {
//     // 1. Lấy danh sách chatID mà người dùng đăng nhập tham gia
//     const memberDocs = await ChatMembers.find({ "members.userID": loggedInUserID }).lean();
//     const chatIDs = memberDocs.map(m => m.chatID);

//     // 2. Tìm tất cả các chat private trong danh sách chatIDs
//     const privateChats = await Chats.find({
//       chatID: { $in: chatIDs },
//       type: 'private'
//     }).lean();
//     const listChatIDs = privateChats.map(chat => chat.chatID);
//    const chatmembers = await ChatMembers.find({ chatID: { $in: listChatIDs } }).lean();
//     let targetChat = null;

//     // 3. Duyệt qua từng chat để tìm chat chứa cả 2 người
//     for (const chat of chatmembers) {
//       const members = chat.members; // Các thành viên của chat
//       const hasUser1 = members.some(m => m.userID === loggedInUserID);
//       const hasUser2 = members.some(m => m.userID === friendUserID);
      
//       // Nếu chat chứa cả hai người dùng, lưu lại chat đó
//       if (hasUser1 && hasUser2) {
//         targetChat = chat;
//         break;
//       }
//     }

//     // 4. Nếu không tìm thấy chat, return null
//     if (!targetChat) {
//       console.log("Chưa có chat 1-1 giữa hai người.");
//       return null;
//     }

//     // 5. Lấy toàn bộ tin nhắn trong chat
//     const messagesList = await messages.find({ chatID: targetChat.chatID }).sort({ timestamp: 1 }).lean();

//     // Nếu không có tin nhắn nào, vẫn trả về chat với lastMessage là []
//     if (messagesList.length === 0) {
//       targetChat.lastMessage = [];
//       return targetChat;
//     }

//     // 6. Nếu có tin nhắn, lấy thông tin sender
//     const senderIDs = messagesList.map(msg => msg.senderID);
//     const senders = await Users.find({ userID: { $in: senderIDs } }).lean();

//     // 7. Gắn thông tin người gửi vào mỗi tin nhắn
//     const enrichedMessages = messagesList.map(msg => {
//       const sender = senders.find(u => u.userID === msg.senderID);
//       return {
//         ...msg,
//         senderInfo: sender ? {
//           name: sender.name,
//           avatar: sender.anhDaiDien || null,
//         } : null,
//       };
//     });

//     // 8. Gán tin nhắn cuối cùng vào chat
//     targetChat.lastMessage = enrichedMessages;
//     return targetChat;

//   } catch (error) {
//     console.error("Lỗi khi lấy chat 1-1:", error);
//     throw error;
//   }
// };

Controller.getOneOnOneChat = async (loggedInUserID, friendUserID) => {
  try {
    // 1. Tìm chat 1-1 giữa 2 người
    const matchedChats = await ChatMembers.aggregate([
      {
        $match: {
          "members.userID": { $all: [loggedInUserID, friendUserID] },
        },
      },
      {
        $addFields: {
          memberCount: { $size: "$members" },
        },
      },
      {
        $match: {
          memberCount: 2,
        },
      },
      {
        $lookup: {
          from: "Chats",
          localField: "chatID",
          foreignField: "chatID",
          as: "chat",
        },
      },
      { $unwind: "$chat" },
      {
        $match: {
          "chat.type": "private",
        },
      },
    ]);

    if (!matchedChats.length) {
      console.log("Chưa có chat 1-1 giữa hai người.");
      return null;
    }

    const chatMemberDoc = matchedChats[0];
    const chatInfo = chatMemberDoc.chat;
    const members = chatMemberDoc.members.map(m => ({
      userID: m.userID,
      role: m.role,
    }));

    // 2. Lấy danh sách tin nhắn
    const messagesList = await messages.find({ chatID: chatInfo.chatID }).sort({ timestamp: 1 }).lean();

    // 3. Gắn thông tin người gửi
    let enrichedMessages = [];
    if (messagesList.length > 0) {
      const senderIDs = [...new Set(messagesList.map(msg => msg.senderID))];
      const senders = await Users.find({ userID: { $in: senderIDs } }).lean();

      enrichedMessages = messagesList.map(msg => {
        const sender = senders.find(u => u.userID === msg.senderID);
        return {
          ...msg,
          senderInfo: sender
            ? {
                name: sender.name,
                avatar: sender.anhDaiDien || null,
              }
            : null,
        };
      });
    }

    // 4. Trả về đầy đủ thông tin
    return {
      chatInfo,
      members,         // Chỉ gồm userID và role
      lastMessage: enrichedMessages,
    };
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
    console.log("Danh sách bạn bè:", friends);
    return friends;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bạn bè:', error);
    return null;
  }
};

Controller.createChat = async (userID1, userID2) => {
  try {
    const lastChat = await Chats.findOne().sort({ chatID: -1 }).limit(1);
    let chatID = '';

    if (!lastChat || !lastChat.chatID) {
      chatID = 'chat001';
    } else {
      const lastNumber = parseInt(lastChat.chatID.replace('chat', ''), 10);
      const newNumber = lastNumber + 1;
      chatID = `chat${newNumber.toString().padStart(3, '0')}`;
    }
    const user1 = await Users.findOne({ userID: userID1 });
    const user2 = await Users.findOne({ userID: userID2 });
    const parts1 = user1.name.trim().split(" ");
    const lastName1 = parts1[parts1.length - 1];
    const parts2 = user2.name.trim().split(" ");
    const lastName2 = parts2[parts2.length - 1];
    const newChat = new Chats({
      chatID: chatID,
      type: 'private',
      avatar:user2.anhDaiDien,
      name: `${lastName1} & ${lastName2}`, // Hoặc `${user1.name} & ${user2.name}` nếu cần
      created_at: Date.now(),
    });

    const saveChat = await newChat.save();
    if (!saveChat) return false;

    const members = [
      { userID: userID1, role: 'admin' },
      { userID: userID2, role: 'member' }
    ];

    const chatMember = new ChatMembers({
      chatID: chatID,
      members: members
    });
    
    await chatMember.save();
    

    if (!chatMember) return false;

    // ✅ Lấy lại chat + members để trả về
    const createdChat = await Chats.findOne({ chatID }).lean();
    //const chatMembers = await ChatMembers.find({ chatID }).lean();

    return {
      ...createdChat,
      lastMessage: [],
      members: members
    };

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

    // Lấy tất cả yêu cầu kết bạn liên quan đến userID (gửi hoặc nhận)
    const pendingRequests = await Contacts.find({
      $or: [
        { contactID: userID }, // userID là người gửi
        { userID: userID }     // userID là người nhận
      ],
      status: "pending",
    }).exec();

    if (pendingRequests.length === 0) {
      return {
        sentRequests: [],
        receivedRequests: [],
      };
    }

    const sentRequests = [];
    const receivedRequests = [];

    for (let request of pendingRequests) {
      if (request.contactID === userID) {
        // userID là người gửi
        const receiverID = request.userID;

        const receiver = await Users.findOne({ userID: receiverID })
          .select("name anhDaiDien sdt")
          .exec();

        if (receiver) {
          sentRequests.push({
            contactID:userID,
            userID: receiverID,
            name: receiver.name,
            phoneNumber: receiver.sdt,
            avatar: receiver.anhDaiDien,
            alias: request.alias,
          });
        }
      } else if (request.userID === userID) {
        // userID là người nhận
        const senderID = request.contactID;

        const sender = await Users.findOne({ userID: senderID })
          .select("name anhDaiDien sdt")
          .exec();

        if (sender) {
          receivedRequests.push({
            contactID: senderID,
            userID:userID,
            name: sender.name,
            phoneNumber: sender.sdt,
            avatar: sender.anhDaiDien,
            alias: request.alias,
          });
        }
      }
    }

    return {
      sentRequests,
      receivedRequests,
    };
  } catch (error) {
    console.error("❌ Error fetching pending friend requests:", error);
    throw error;
  }
};
Controller.createChatGroup = async (data)=>{
  try{
    const lastChat = await Chats.findOne().sort({ chatID: -1 }).limit(1);
    let chatID = '';

    if (!lastChat || !lastChat.chatID) {
      chatID = 'chat001';
    } else {
      const lastNumber = parseInt(lastChat.chatID.replace('chat', ''), 10);
      const newNumber = lastNumber + 1;
      chatID = `chat${newNumber.toString().padStart(3, '0')}`;
    }

    const newGroupChat = new Chats({
      chatID: chatID,
      type: 'group',
      avatar: data.avatar,
      name: data.name,
      created_at: Date.now(),
    });

    const saveGroupChat = await newGroupChat.save();
    if (!saveGroupChat) return null;
    const members = [];
    const adminUser = {userID: data.adminID, role: 'admin'};
        members.push(adminUser); // Thêm admin vào danh sách thành viên

      data.members.map(member => (members.push({
      userID: member.userID,
      role:'member' // Mặc định là 'member' nếu không có role
    })));

    const groupMember = new ChatMembers({
      chatID: chatID,
       members: members
    });
    
    await groupMember.save();

    if (!groupMember) return null;
    const userAdmin = await Users.findOne({ userID: data.adminID });
    const userMember = await Promise.all(
      data.members.map((member) => Users.findOne({ userID: member.userID }))
    );

    let thanhvien = '';
      userMember.forEach((member) => {
        thanhvien += `${member.name}, `;
      });


    const content = `${thanhvien}đã được ${userAdmin.name} thêm vào nhóm.`;

     const messageForMember = new messages({
          messageID: `msg${Date.now()}`, // Tạo ID tin nhắn mới
          chatID: chatID,
          senderID: data.adminID,
          content: content,
          type: 'notification',
          timestamp: Date.now(),
          status: 'sent',
          pinnedInfo: null
        });

        await messageForMember.save();
        let lastMessage = [];

    // Lấy tất cả các tin nhắn của nhóm
    lastMessage = await messages.find({ chatID: chatID }).lean();

    // ✅ Lấy lại chat + members để trả về
    const createdGroupChat = await Chats.findOne({ chatID }).lean();
    
    return {
      ...createdGroupChat,
      lastMessage: lastMessage.length > 0 ? lastMessage : [messageForMember],
      members: members
    };

  } catch (error) {
    console.error("Lỗi khi tạo nhóm:", error);
    return null;
  }

};
Controller.getInforMember = async (members) => {
  try {
    const users = await Promise.all(
      members.map(async (member) => {
        const user = await Users.findOne({ userID: member.userID });
        if (user) {
          return {
            userID: user.userID,
            name: user.name,
            avatar: user.anhDaiDien,
            sdt: user.sdt
          };
        } else {
          return null;
        }
      })
    );

    // Lọc bỏ các kết quả null nếu cần
    return users.filter(Boolean);
  } catch (error) {
    console.error("❌ Lỗi khi lấy thông tin thành viên:", error);
    return null;
  }
};
// them nhieu thanh vien vao nhom
Controller.addMembersToGroup = async (chatID, memberIDs) => {
  try {
    // Tìm chat theo chatID
    const memberChat = await ChatMembers.findOne({ chatID: chatID });

    if (!memberChat) {
      console.log("Không tìm thấy nhóm.");
      return null; // Nếu không tìm thấy nhóm, trả về null
    }

    // Lọc ra các memberID chưa có trong mảng members
    const newMembers = memberIDs.filter(memberID => 
      !memberChat.members.some(member => member.userID === memberID)
    );

    if (newMembers.length === 0) {
      console.log("Tất cả các thành viên đã có trong nhóm.");
      return { error: "Tất cả các thành viên đã có trong nhóm." };
    }

    // Thêm các thành viên mới vào nhóm
    await ChatMembers.updateOne(
      { chatID: chatID },
      { $addToSet: { members: { $each: newMembers.map(userID => ({ userID, role: "member" })) } } }
    );

    // Lấy lại thông tin nhóm sau khi thêm thành viên
    const updatedChat = await ChatMembers.findOne({ chatID: chatID });

    // Nếu không tìm thấy chat sau khi cập nhật
    if (!updatedChat) {
      console.log("Không tìm thấy nhóm sau khi thêm thành viên.");
      return null;
    }

    // Lấy thông tin về nhóm
    const chat = await Chats.findOne({ chatID: chatID });
    if (!chat) {
      console.log("Không tìm thấy thông tin chat.");
      return null;
    }
   let lastMessage = [];
    // Lấy tất cả các tin nhắn của nhóm
    const listmessages = await messages.find({ chatID: chatID }).lean();
    if (listmessages.length === 0) {
      console.log("Không có tin nhắn nào trong nhóm.");
      lastMessage = [];
    }
     // 6. Nếu có tin nhắn, lấy thông tin sender
     const senderIDs = listmessages.map(msg => msg.senderID);
     const senders = await Users.find({ userID: { $in: senderIDs } }).lean();
 
     // 7. Gắn thông tin người gửi vào mỗi tin nhắn
     const enrichedMessages = listmessages.map(msg => {
       const sender = senders.find(u => u.userID === msg.senderID);
       return {
         ...msg,
         senderInfo: sender ? {
           name: sender.name,
           avatar: sender.anhDaiDien || null,
         } : null,
       };
     });
     lastMessage = enrichedMessages;
    
    // Trả về thông tin nhóm, tin nhắn mới và thành viên
    return {
      ...chat.toObject(),
      lastMessage: lastMessage,
      members: updatedChat.members
    };
  } catch (error) {
    console.error("Đã xảy ra lỗi:", error);
    return null;
  }
};

Controller.removeMemberFromGroup = async (chatID, adminID, memberID) => {
  try {
    // Tìm nhóm (chat) theo chatID
    const memberChat = await ChatMembers.findOne({ chatID: chatID });

    if (!memberChat) {
      console.log("Không tìm thấy nhóm.");
      return { error: "Không tìm thấy nhóm." }; // Trả về lỗi nếu không tìm thấy nhóm
    }

    // Kiểm tra nếu adminID có quyền 'admin' trong nhóm
    const adminMember = memberChat.members.find(member => member.userID === adminID && member.role === 'admin');

    if (!adminMember) {
      console.log("Chỉ admin mới có quyền xóa thành viên.");
      return { error: "Chỉ admin mới có quyền xóa thành viên." }; // Nếu không phải admin, trả về lỗi
    }

    // Kiểm tra xem memberID có trong mảng members hay không
    const memberIndex = memberChat.members.findIndex(member => member.userID === memberID);

    if (memberIndex === -1) {
      console.log("Thành viên không tồn tại trong nhóm.");
      return { error: "Thành viên không tồn tại trong nhóm." }; // Nếu không tìm thấy thành viên, trả về lỗi
    }

    // Xóa thành viên khỏi mảng members
    memberChat.members.splice(memberIndex, 1);

    // Lưu thay đổi vào cơ sở dữ liệu
    await memberChat.save();

    console.log("Thành viên đã được xóa khỏi nhóm.");
    const chat = await Chats.findOne({ chatID: chatID });
    if (!chat) {
      console.log("Không tìm thấy thông tin chat.");
      return { error: "Không tìm thấy thông tin chat." };
    }
    let lastMessage = [];
    // Lấy tất cả các tin nhắn của nhóm
    const listmessages = await messages.find({ chatID: chatID }).lean();
    if (listmessages.length === 0) {
      console.log("Không có tin nhắn nào trong nhóm.");
      lastMessage = [];
    } else{
      // 6. Nếu có tin nhắn, lấy thông tin sender
      const senderIDs = listmessages.map(msg => msg.senderID);
      const senders = await Users.find({ userID: { $in: senderIDs } }).lean();

      // 7. Gắn thông tin người gửi vào mỗi tin nhắn
      const enrichedMessages = listmessages.map(msg => {
        const sender = senders.find(u => u.userID === msg.senderID);
        return {
          ...msg,
          senderInfo: sender ? {
            name: sender.name,
            avatar: sender.anhDaiDien || null,
          } : null,
        };
      });
      lastMessage = enrichedMessages;
    }
    const updatedChat = await ChatMembers.findOne({ chatID: chatID });
    if (!updatedChat) {
      console.log("Không tìm thấy nhóm sau khi xóa thành viên.");
      return { error: "Không tìm thấy nhóm sau khi xóa thành viên." };
    }
    return { ...chat.toObject(), lastMessage, members: updatedChat.members }; // Trả về nhóm sau khi xóa thành viên
  } catch (error) {
    console.error("Lỗi khi xóa thành viên:", error);
    return { error: error.message };
  }
};

Controller.userRemoveFromGroup = async (chatID, memberID) => {
  try {
    // Tìm chat theo chatID
    const memberChat = await ChatMembers.findOne({ chatID: chatID });

    if (!memberChat) {
      console.log("Không tìm thấy nhóm.");
      return { error: "Không tìm thấy nhóm." }; // Nếu không tìm thấy nhóm
    }

    // Kiểm tra xem memberID có trong mảng members hay không
    const memberIndex = memberChat.members.findIndex(member => member.userID === memberID);

    if (memberIndex === -1) {
      console.log("Thành viên không tồn tại trong nhóm.");
      return { error: "Thành viên không tồn tại trong nhóm." }; // Nếu không tìm thấy thành viên
    }

    // Xóa thành viên khỏi mảng members
    memberChat.members.splice(memberIndex, 1);

    // Lưu thay đổi vào cơ sở dữ liệu
    await memberChat.save();

    // Lấy lại thông tin nhóm sau khi xóa thành viên
    const updatedChat = await ChatMembers.findOne({ chatID: chatID });

    if (!updatedChat) {
      console.log("Không tìm thấy nhóm sau khi xóa thành viên.");
      return { error: "Không tìm thấy nhóm sau khi xóa thành viên." };
    }

    // Lấy thông tin nhóm
    const chat = await Chats.findOne({ chatID: chatID });
    if (!chat) {
      console.log("Không tìm thấy thông tin chat.");
      return { error: "Không tìm thấy thông tin chat." };
    }

    let lastMessage = [];
    // Lấy tất cả các tin nhắn của nhóm
    const listmessages = await messages.find({ chatID: chatID }).lean();
    if (listmessages.length === 0) {
      console.log("Không có tin nhắn nào trong nhóm.");
      lastMessage = [];
    } else {
      // 6. Nếu có tin nhắn, lấy thông tin sender
      const senderIDs = listmessages.map(msg => msg.senderID);
      const senders = await Users.find({ userID: { $in: senderIDs } }).lean();

      // 7. Gắn thông tin người gửi vào mỗi tin nhắn
      const enrichedMessages = listmessages.map(msg => {
        const sender = senders.find(u => u.userID === msg.senderID);
        return {
          ...msg,
          senderInfo: sender ? {
            name: sender.name,
            avatar: sender.anhDaiDien || null,
          } : null,
        };
      });
      lastMessage = enrichedMessages;
    }

    // Trả về thông tin nhóm, tin nhắn mới và thành viên
    return {
      ...chat.toObject(),
      lastMessage: lastMessage,
      members: updatedChat.members
    };

  } catch (error) {
    console.error("Đã xảy ra lỗi khi xóa thành viên:", error);
    return { error: error.message };
  }
};


Controller.changeMemberRole = async (chatID, adminID, memberID, newRole) => {
  try {
    // Tìm nhóm (chat) theo chatID
    const memberChat = await ChatMembers.findOne({ chatID: chatID });

    if (!memberChat) {
      console.log("Không tìm thấy nhóm.");
      return { error: "Không tìm thấy nhóm." }; // Trả về lỗi nếu không tìm thấy nhóm
    }

    // Kiểm tra nếu adminID có quyền 'admin' trong nhóm
    const adminMember = memberChat.members.find(member => member.userID === adminID && member.role === 'admin');

    if (!adminMember) {
      console.log("Chỉ admin mới có quyền thay đổi quyền của thành viên.");
      return { error: "Chỉ admin mới có quyền thay đổi quyền của thành viên." }; // Nếu không phải admin, trả về lỗi
    }

    // Kiểm tra xem memberID có trong mảng members hay không
    const memberIndex = memberChat.members.findIndex(member => member.userID === memberID);

    if (memberIndex === -1) {
      console.log("Thành viên không tồn tại trong nhóm.");
      return { error: "Thành viên không tồn tại trong nhóm." }; // Nếu không tìm thấy thành viên, trả về lỗi
    }

    // Thay đổi role của thành viên
    memberChat.members[memberIndex].role = newRole;

    // Lưu thay đổi vào cơ sở dữ liệu
    await memberChat.save();

    console.log(`Quyền của thành viên ${memberID} đã được thay đổi thành ${newRole}.`);
    return memberChat; // Trả về nhóm sau khi thay đổi quyền
  } catch (error) {
    console.error("Lỗi khi phân quyền:", error);
    return { error: error.message };
  }
};

Controller.transferRole = async (chatID, adminID, memberID) => {
  try {
    // 1. Tìm nhóm (chat) theo chatID
    const memberChat = await ChatMembers.findOne({ chatID: chatID });

    if (!memberChat) {
      console.log("Không tìm thấy nhóm.");
      return { error: "Không tìm thấy nhóm." };
    }

    // 2. Kiểm tra nếu adminID có quyền 'admin' trong nhóm
    const adminMember = memberChat.members.find(member => member.userID === adminID && member.role === 'admin');
    if (!adminMember) {
      console.log("Chỉ admin mới có quyền thay đổi quyền của thành viên.");
      return { error: "Chỉ admin mới có quyền thay đổi quyền của thành viên." };
    }

    // 3. Kiểm tra xem memberID có trong nhóm
    const memberIndex = memberChat.members.findIndex(member => member.userID === memberID);
    if (memberIndex === -1) {
      console.log("Thành viên không tồn tại trong nhóm.");
      return { error: "Thành viên không tồn tại trong nhóm." };
    }

    // 4. Kiểm tra nếu thành viên đã là admin
    if (memberChat.members[memberIndex].role === 'admin') {
      console.log("Thành viên đã là admin.");
      return { error: "Thành viên đã là admin." };
    }

    // 5. Chuyển quyền: member → admin, admin → member
    memberChat.members[memberIndex].role = 'admin';
    adminMember.role = 'member';

    // 6. Lưu thay đổi vào DB
    await memberChat.save();

    // 7. Lấy lại dữ liệu cập nhật
    const updatedChat = await ChatMembers.findOne({ chatID: chatID });

    if (!updatedChat) {
      console.log("Không tìm thấy nhóm sau khi chuyển quyền.");
      return { error: "Không tìm thấy nhóm sau khi chuyển quyền." };
    }

    // 8. Lấy thông tin nhóm
    const chat = await Chats.findOne({ chatID: chatID });
    if (!chat) {
      console.log("Không tìm thấy thông tin chat.");
      return { error: "Không tìm thấy thông tin chat." };
    }

    // 9. Lấy tin nhắn
    const listmessages = await messages.find({ chatID: chatID }).lean();

    let lastMessage = [];
    if (listmessages.length > 0) {
      const senderIDs = listmessages.map(msg => msg.senderID);
      const senders = await Users.find({ userID: { $in: senderIDs } }).lean();

      const enrichedMessages = listmessages.map(msg => {
        const sender = senders.find(u => u.userID === msg.senderID);
        return {
          ...msg,
          senderInfo: sender ? {
            name: sender.name,
            avatar: sender.anhDaiDien || null,
          } : null,
        };
      });

      lastMessage = enrichedMessages;
    }

    // 10. Trả về dữ liệu đồng bộ
    return {
      ...chat.toObject(),
      lastMessage: lastMessage,
      members: updatedChat.members
    };

  } catch (error) {
    console.error("Lỗi khi chuyển quyền:", error);
    return { error: error.message };
  }
};


Controller.deleteGroupAndMessages = async (chatID) => {
  try {
    // Tìm nhóm (chat) theo chatID trong ChatMembers
    const memberChat = await ChatMembers.findOne({ chatID: chatID });

    if (!memberChat) {
      console.log("Không tìm thấy nhóm.");
      return { error: "Không tìm thấy nhóm." }; // Nếu không tìm thấy nhóm
    }

    // Xóa nhóm trong ChatMembers
    await ChatMembers.deleteOne({ chatID: chatID });

    // Xóa nhóm trong Chats
    await Chats.deleteOne({ chatID: chatID });

    // Xóa tất cả tin nhắn liên quan đến chatID
    await messages.deleteMany({ chatID: chatID });

    console.log(`Nhóm ${chatID} đã được giải tán và xóa hoàn toàn.`);
    return true;
  } catch (error) {
    console.error("Lỗi khi giải tán nhóm và xóa tin nhắn:", error);
    return false; // Trả về false nếu có lỗi xảy ra
  }
};

// Controller.getMemberAddMember
// Controller.getMemberAddMember
Controller.getMemberAddMember = async (chatID, userID) => {
  try {
    // Tìm nhóm (chat) theo chatID trong ChatMembers
    const memberChat = await ChatMembers.findOne({ chatID: chatID });

    if (!memberChat) {
      console.log("Không tìm thấy nhóm.");
      return { error: "Không tìm thấy nhóm." }; // Nếu không tìm thấy nhóm
    }

    // Lấy danh sách thành viên hiện tại của nhóm
    const memberIDs = memberChat.members.map(member => member.userID);

    // Lấy danh sách bạn bè của userID từ Contacts (trừ userID chính)
    const userContacts = await Contacts.find({
      $or: [
        { userID: userID },   // Tìm các bản ghi có userID là userID của người dùng
        { contactID: userID }  // Tìm các bản ghi có contactID là userID của người dùng
      ]
    });

    if (!userContacts || userContacts.length === 0) {
      return { error: "Không tìm thấy danh bạ bạn bè của người dùng." };
    }

    // Lọc bạn bè trong Contacts, trừ những người đã là thành viên của nhóm
    const friendsNotInGroup = await Promise.all(userContacts.filter(contact => {
      const friendID = contact.userID === userID ? contact.contactID : contact.userID;
      return !memberIDs.includes(friendID);
    }).map(async (contact) => {
      const friendID = contact.userID === userID ? contact.contactID : contact.userID;

      // Lấy thông tin chi tiết người bạn từ bảng Users
      const friendInfo = await Users.findOne({ userID: friendID });

      // Trả về các thông tin bạn bè, bao gồm ảnh đại diện và số điện thoại từ Users
      return {
        userID: friendID,
        status: contact.status,
        avatar: friendInfo?.anhDaiDien, // Lấy avatar từ bảng Users
        phone: friendInfo?.sdt,   // Lấy số điện thoại từ bảng Users
        name: friendInfo?.name, // Lấy tên từ bảng Users

      };
    }));

    // Trả về danh sách bạn bè chưa phải thành viên của nhóm
    return friendsNotInGroup;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bạn bè:", error);
    return { error: error.message };
  }
};

// Hàm kiểm tra tính hợp lệ của số điện thoại
const isValidPhoneNumber = (phoneNumber) => {
  const phoneRegex = /^(0[3|5|7|8|9][0-9]{8}|(\+84)[3|5|7|8|9][0-9]{8})$/;
  return phoneRegex.test(phoneNumber);
};

// Hàm kiểm tra tính hợp lệ của email
const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};


// Hàm kiểm tra tính hợp lệ của ngày sinh và tuổi >= 18
const isValidDOB = (dob) => {
  const dobRegex = /^\d{4}-\d{2}-\d{2}$/;  // Kiểm tra định dạng yyyy-mm-dd
  if (!dobRegex.test(dob)) return false;

  // Kiểm tra tuổi >= 18
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();

  // Nếu tháng hiện tại chưa đến sinh nhật của năm nay, giảm tuổi đi 1
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 18; // Kiểm tra tuổi >= 18
};

Controller.updateUserInfo = async (req, res) => {
  try {
    const { userID } = req.params;
    const updateData = req.body;

    // Ràng buộc định dạng số điện thoại
    if (updateData.sdt && !isValidPhoneNumber(updateData.sdt)) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    // Ràng buộc định dạng email
    if (updateData.email && !isValidEmail(updateData.email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Chuẩn hóa và kiểm tra ngày sinh
    if (updateData.ngaysinh) {
      const dobParts = updateData.ngaysinh.split("-");
      if (dobParts.length === 3) {
        const year = dobParts[0];
        const month = dobParts[1].padStart(2, "0"); // Đảm bảo có 2 chữ số
        const day = dobParts[2].padStart(2, "0");   // Đảm bảo có 2 chữ số
        updateData.ngaysinh = `${year}-${month}-${day}`;
      }

      if (!isValidDOB(updateData.ngaysinh)) {
        return res.status(400).json({ error: "Invalid date of birth or age must be at least 18" });
      }
    }

    // Tìm người dùng
    const user = await Users.findOne({ userID });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Cập nhật ngày sinh
    if (updateData.ngaysinh) {
      user.ngaysinh = new Date(updateData.ngaysinh);
    }

    // Các trường được phép cập nhật
    const allowedFields = ["name", "email", "sdt", "ngaySuaDoi", "ngaysinh", "gioTinh", "anhDaiDien", "anhBia"];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        user[field] = updateData[field];
      }
    });

    // Cập nhật ngày sửa đổi
    user.ngaySuaDoi = new Date();

    // Lưu lại thay đổi
    await user.save();

    return res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    console.error('Lỗi khi cập nhật thông tin người dùng:', error);
    return res.status(500).json({ error: error.message });
  }
};



module.exports = Controller;