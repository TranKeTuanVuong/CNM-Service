const messages = require("../models/Messages");
const ChatMembers = require("../models/ChatMember");
const Controller = require("../controller/index");
const Contacts = require("../models/Contacts");
const Users = require("../models/User");
const Chats = require("../models/Chat");

 

const socketHandler = (io) => {
  const users = {}; // Lưu trữ các người dùng và số điện thoại của họ

  io.on("connection", (socket) => {
    console.log("🟢 Client connected:", socket.id);

    // Đăng ký số điện thoại của người dùng khi họ kết nối
    socket.on("registerPhoneNumber", (phoneNumber) => {
      users[phoneNumber] = socket.id; // Lưu socket id với số điện thoại
      console.log(`User with phone number ${phoneNumber} connected`);
    });

    // Tham gia phòng người dùng cá nhân
    socket.on("join_user", (userID) => {
      socket.join(userID);
      console.log(`🧍‍♂️ Socket ${socket.id} joined user room: ${userID}`);
    });

    // Tham gia phòng chat cụ thể
    socket.on("join_chat", (chatID) => {
      socket.join(chatID);
      console.log(`🔁 Socket ${socket.id} joined chat room: ${chatID}`);
    });
    // update user
    socket.on("updateUser",async (data) => {
      try{
        const friends = await Controller.getContactsByUserID(data.userID);
        if (!friends) {
          io.to(data.userID).emit("update_user", data);
        } else{
          io.to(data.userID).emit("update_user", data);
        friends.forEach((friend) => {
          io.to(friend.userID).emit("updatee_user", data);
        });
      }
      }catch (error) {
        console.error("❌ Error updating user:", error);
      }
    });
      // update trạng thái online/offline
    socket.on("updateStatus", async (data) => {
      try {
        //const { user} = data;
        const friends = await Controller.getContactsByUserID(data.userID);
        if (!friends) {
          console.error("❌ Không tìm thấy bạn bè với userID:", data.userID);
          return;
        }
        friends.forEach((friend) => {
          io.to(friend.userID).emit("status_update", data);
        });
        
      } catch (error) {
        console.error("❌ Error updating status:", error);
      }
    });

    // Tham gia phòng chat 1-1
    socket.on("createChat1-1", async (data) => {
      try {
        console.log("Tạo cuộc trò chuyện 1-1:", data);
        if (!data?.chatID) {
          console.error("❌ Không có chatID trong data");
          return;
        }
    
        
          data.members.forEach((member) => {
          io.to(member.userID).emit("newChat1-1",data);
          console.log(`📤 Gửi newChat1-1 đến user ${member.userID}`);
        });
      } catch (error) {
        console.error("❌ Error creating chat:", error);
      }
    });
    
    // tin nhắn mới
   socket.on("send_message", async (data) => {
  try {
    const lastMessage = await messages.findOne().sort({ messageID: -1 });
    const nextID = lastMessage
      ? parseInt(lastMessage.messageID.replace("msg", ""), 10) + 1
      : 1;
    const messageID = `msg${String(nextID).padStart(3, "0")}`;
    let newMsg;
    if (data.replyTo){
       newMsg = new messages({
      messageID,
      chatID: data.chatID,
      senderID: data.senderID,
      content: data.content || "",
      type: data.type || "text",
      timestamp: data.timestamp || Date.now(),
      media_url: data.media_url || [],
      status: "sent",
      pinnedInfo: null,
      replyTo: data.replyTo,
    });
    }else{
      newMsg = new messages({
      messageID,
      chatID: data.chatID,
      senderID: data.senderID,
      content: data.content || "",
      type: data.type || "text",
      timestamp: data.timestamp || Date.now(),
      media_url: data.media_url || [],
      status: "sent",
      pinnedInfo: null,
      replyTo: null,
    });
  }

    const saved = await newMsg.save();

    const chatMembers = await ChatMembers.findOne({ chatID: data.chatID });
    const receiverIDs = chatMembers?.members
      .map((m) => m.userID)
      .filter((id) => id !== data.senderID);
    console.log("receiverIDs", receiverIDs);
    const fullMessage = {
      ...data,
      messageID: saved.messageID,
      timestamp: saved.timestamp,
      status: "sent",
      senderInfo: {
        name: data.senderInfo?.name || "Người dùng",
        avatar: data.senderInfo?.avatar || null,
      },
    };

    // Gửi tới người nhận và người gửi
    receiverIDs.forEach((id) => io.to(id).emit("new_message", fullMessage));
    io.to(data.senderID).emit("new_message", fullMessage);
    io.to(data.chatID).emit(data.chatID, fullMessage);

    // Cập nhật trạng thái "delivered"
    setTimeout(async () => {
      await messages.findOneAndUpdate(
        { messageID: saved.messageID },
        { status: "delivered" }
      ).exec();

      io.to(data.chatID).emit(`status_update_${data.chatID}`, {
        messageID: saved.messageID,
        status: "delivered",
      });
    }, 1000);
  } catch (error) {
    console.error("❌ Error sending message:", error);
  }
});

    // socket.on("send_message", async (data) => {
    //   const messcount = await messages.findOne().sort({ messageID: -1 });
    //   const nextID = messcount
    //   ? parseInt(messcount.messageID.replace("msg", ""), 10) + 1
    //   : 1;
    // const messageID = `msg${String(nextID).padStart(3, "0")}`;
    //   const newMsg = new messages({
    //   messageID,
    //   chatID: data.chatID,
    //   senderID: data.senderID,
    //   content: data.content || "",
    //   type: data.type || "text",
    //   timestamp: data.timestamp || Date.now(),
    //   media_url: data.media_url || [],
    //   status: "sent",
    //   pinnedInfo: null,
    //   replyTo: null,
    // });
    // // Lưu message vào database
    // const saved = await newMsg.save();
    // if (!saved) {
    //   console.error("❌ Không thể lưu tin nhắn vào cơ sở dữ liệu");
    //   return;
    // }
    //   const lastMessage = await messages.findOne({ chatID: data.chatID }).sort({ timestamp: -1 });
    //   if (!lastMessage) {
    //     console.error("❌ Không tìm thấy tin nhắn nào trong cuộc trò chuyện");
    //     return;
    //   }
    //   const chatMembers = await ChatMembers.find({ chatID: data.chatID });
    //   if (!chatMembers || chatMembers.length === 0) {
    //     console.error("❌ Không tìm thấy thành viên nào trong cuộc trò chuyện");
    //     return;
    //   }
    //   const chat = await Chats.findOne({ chatID: data.chatID });
    //   if (!chat) {
    //     console.error("❌ Không tìm thấy cuộc trò chuyện với chatID:", data.chatID);
    //     return;
    //   }
    //   const mychat = {
    //     ...chat,
    //     members: chatMembers,
    //     lastMessage: lastMessage
    //   }
    //   const receiverIDs = chatMembers.map((m) => m.userID).filter((id) => id !== data.senderID);
    //   io.to(data.chatID).emit(data.chatID, mychat);
    //   receiverIDs.forEach((userID) => {
    //    // io.to(userID).emit("new_message", mychat);
    //     io.to(userID).emit("chat_update", mychat);
    //   });
    // });
    

    // Cập nhật trạng thái đã đọc
    socket.on("read_messages", async ({ chatID, userID }) => {
      try {
        await messages.updateMany(
          { chatID, status: { $ne: "read" } },
          { status: "read" }
        );

        io.to(chatID).emit(`status_update_${chatID}`, {
          userID,
          status: "read",
        });

        io.to(userID).emit("status_update_all", {
          chatID,
          userID,
          status: "read",
        });
      } catch (err) {
        console.error("❌ Error updating read status:", err);
      }
    });
    socket.on("getContacts", async (userID) => {
      try {
        const contacts = await Controller.getContacts(userID);
        socket.emit("contacts", contacts);
      } catch (error) {
        console.error("❌ Error getting contacts:", error);
        socket.emit("error", { message: "Lỗi khi lấy danh sách liên hệ" });
      }
    });


// giui loi moi ket ban
socket.on("send_friend_request", async (data) => {
  // Kiểm tra xem recipientID có tồn tại hay không
  if (!data.recipientID) {
    console.error("Recipient ID is missing or invalid.");
    return; 
  }
  try {
          const newContact = await Controller.createContact(data.senderID,data.recipientPhone);
  if (!newContact) {
    console.error("Failed to save new contact request.");
    return;
  }
  const User = await Users.findOne({ userID: data.senderID });
  if (!User) {
    console.error("Failed to find user for senderID:", data.senderID);
    return;
  }
  io.to(data.recipientID).emit("new_friend_request", {
    alias:newContact.alias,
    contactID: newContact.contactID,
    userID: data.recipientID,
    name: userRecipient.name,
    avatar: userRecipient.anhDaiDien,
  }); // Gửi yêu cầu kết bạn đến người nhận
  const userRecipient = await Users.findOne({ userID: data.recipientID });
  if (!userRecipient) {
    console.error("Failed to find user for recipientID:", data.recipientID);
    return;
  }
  io.to(data.senderID).emit('friend_request_sent', {
    alias:newContact.alias,
    contactID: newContact.contactID,
    userID: data.recipientID,
    name: userRecipient.name,
    avatar: userRecipient.anhDaiDien,
  });
  }catch (error) {
    console.error("❌ Error sending friend request:", error);
    socket.emit("error", { message: "Lỗi server" });
  }
});


   

    
        
    // Lấy danh sách chat của user
    socket.on("getChat", async (userID) => {
      try {
        const chats = await Controller.getChatsForUser(userID);
        socket.emit("ChatByUserID", chats);
      } catch (error) {
        console.error("❌ Error getting chat list:", error);
        socket.emit("error", { message: "Lỗi khi lấy danh sách chat" });
      }
    });

    // ✅ Thu hồi tin nhắn
    socket.on("unsend_message", async ({ messageID, chatID, senderID }) => {
      try {
        const message = await messages.findOne({ messageID });

        if (!message ) {
          console.warn("⚠️ Unauthorized unsend or not found");
          return;
        }

        message.type = "unsend";
        message.content = "";
        message.media_url = [];
        await message.save();

        if (!message) {
          console.error("❌ Message not found:", messageID);
          return;
        }

        io.to(chatID).emit("unsend_notification", message);

        const members = await ChatMembers.find({ chatID });
        members.forEach((m) => {
          m.members.forEach((member) => {
            io.to(member.userID).emit("unsend_notification", message);
          });
        });

        console.log("❌ Message unsent:", messageID);
      } catch (error) {
        console.error("❌ Error unsending message:", error);
      }
    });

     // ✅ ghim tin nhắn
    socket.on("ghim_message", async ({ messageID, chatID, senderID }) => {
      try {
        const message = await messages.findOne({ messageID });

        if (!message ) {
          console.warn("⚠️ Unauthorized ghim or not found");
          return;
        }

       message.pinnedInfo = {
         pinnedBy: senderID,
         pinnedAt: Date.now(),
       };
       await message.save();

        if (!message) {
          console.error("❌ Message not found:", messageID);
          return;
        }

        io.to(chatID).emit("ghim_notification", message);

        const members = await ChatMembers.find({ chatID });
        members.forEach((m) => {
          m.members.forEach((member) => {
            io.to(member.userID).emit("ghim_notification", message);
          });
        });

        console.log("❌ Message unsent:", messageID);
      } catch (error) {
        console.error("❌ Error unsending message:", error);
      }
    });
    // ✅ unghim tin nhắn
    socket.on("unghim_message", async ({ messageID, chatID}) => {
      try {
        const message = await messages.findOne({ messageID });

        if (!message) {
          console.warn("⚠️ Unauthorized unghim or not found");
          return;
        }

       message.pinnedInfo = null;
       await message.save();

        if (!message) {
          console.error("❌ Message not found:", messageID);
          return;
        }

        io.to(chatID).emit("unghim_notification", message);

        const members = await ChatMembers.find({ chatID });
        members.forEach((m) => {
          m.members.forEach((member) => {
            io.to(member.userID).emit("unghim_notification", message);
          });
        });

        console.log("❌ Message unpinned:", messageID);
      } catch (error) {
        console.error("❌ Error unpinning message:", error);
      }
    });

    // ✅ trả lời tin nhắn
    socket.on("reply_message", async ({ messageID, chatID, senderID, content }) => {
      try {
        const message = await messages.findOne({ messageID });

        if (!message || message.senderID !== senderID) {
          console.warn("⚠️ Unauthorized reply or not found");
          return;
        }

        message.replyTo = {
          messageID: message.messageID,
          senderID: message.senderID,
          content: content,
          type: message.type,
          media_url: message.media_url,
        };
       await message.save();

        if (!message) {
          console.error("❌ Message not found:", messageID);
          return;
        }

        io.to(chatID).emit("reply_notification", message);

        const members = await ChatMembers.find({ chatID });
        members.forEach((m) => {
          m.members.forEach((member) => {
            io.to(member.userID).emit("reply_notification", message);
          });
        });

        console.log("❌ Message replied:", messageID);
      } catch (error) {
        console.error("❌ Error replying message:", error);
      }
    });

  // Lắng nghe sự kiện accept_friend_request
  socket.on("accept_friend_request", async ({ senderID, recipientID, senderName, senderImage }) => {
    try {
      // 1. Cập nhật trạng thái yêu cầu từ sender → recipient
      const updatedRequest = await Contacts.findOneAndUpdate(
        { userID:recipientID , contactID: senderID, status: "pending" },
        { status: "accepted" },
        { new: true }
      );
  
  
      // 3. Lấy thông tin người nhận (để gửi lại qua socket)
      const userRecipient = await Users.findOne({ userID: recipientID });
       console.log("userRecipient",userRecipient);
      if (updatedRequest && userRecipient) {
        // 4. Emit tới người gửi
        io.to(recipientID).emit("friend_request_accepted", {
          userID:senderID,
          name:senderName,
          anhDaiDien:senderImage,
          status: "accepted",
        });
  
        // 5. Emit nguoi nhan
        io.to(senderID).emit("friend_request_accepted", {
          recipientID,
          status: "accepted",
        });
      }
    } catch (error) {
      console.error("❌ Error accepting friend request:", error);
    }
  });
  
      
  socket.on("reject_friend_request", async ({ senderID, recipientID, senderName, senderImage }) => {
    try {
      // 1. Xóa yêu cầu kết bạn trong database
      const deletedRequest = await Contacts.findOneAndDelete({
        userID: recipientID,
        contactID: senderID,
        status: "pending",
      });
  
      // 2. Lấy thông tin người nhận
      const userRecipient = await Users.findOne({ userID: recipientID });
  
      if (!deletedRequest || !userRecipient) {
        console.error("❌ Không tìm thấy yêu cầu kết bạn hoặc người nhận");
        return;
      }
  
      // 3. Emit tới người gửi
      io.to(recipientID).emit("friend_request_recipientID", {
        userID: senderID,
        name: senderName,
        avatar: senderImage, // Ensuring consistency with your code
        status: "rejected",
      });
  
      // 4. Emit tới người nhận
      io.to(senderID).emit("friend_request_senderID", {
        recipientID,
        status: "rejected",
      });
  
      console.log(`✔️ Đã từ chối yêu cầu kết bạn từ ${senderID} tới ${recipientID}`);
    } catch (error) {
      console.error("❌ Error rejecting friend request:", error);
    }
  });
  
  
      

    

   
    
    

    // Lắng nghe sự kiện get_pending_friend_requests
    socket.on("get_pending_friend_requests", async (userID) => {
      try {
        // Gọi controller để lấy danh sách yêu cầu kết bạn đang chờ
        const friendRequests = await Controller.displayFriendRequest(userID);
        socket.emit("pending_friend_requests", friendRequests); // Gửi lại thông tin yêu cầu kết bạn đang chờ
      } catch (error) {
        console.error("❌ Error fetching pending friend requests:", error);
        socket.emit("error", { message: "Lỗi khi lấy yêu cầu kết bạn" });
      }
    });
    socket.on("AddMember", async (data) => {
      try {
        // Thêm thành viên vào nhóm
        const chat = await Controller.addMembersToGroup(data.chatID, data.members);
        
        // Kiểm tra xem nhóm có tồn tại hay không
        if (!chat) {
          console.error("❌ Không tìm thấy nhóm hoặc không thể thêm thành viên");
          return;
        }
     console.log("Thêm thành viên vào nhóm:", chat);
        const newMembers = chat.members;
    
        // Lấy thông tin đầy đủ của các thành viên mới
        const Informember = await Controller.getInforMember(newMembers);
    
        // Gửi socket event tới tất cả thành viên
        newMembers.forEach((member) => {
          const socketID = member.userID;
    
          // Gửi thông tin thành viên mới đến từng người
          io.to(socketID).emit("newMember", Informember);
    
          // Gửi bản cập nhật nhóm mới (chat) đến từng người
          io.to(socketID).emit("updateChat",chat);
        });
    
      } catch (error) {
        console.error("❌ Error adding member:", error);
      }
    });

    socket.on("removeMember", async (data) => {
      const { chatID, memberID } = data;
    
      try {
        // Gọi controller để xóa thành viên
        const chat = await Controller.userRemoveFromGroup(chatID, memberID);
        
        // Kiểm tra xem nhóm có tồn tại hay không
        if (!chat) {
          console.error("❌ Không tìm thấy nhóm hoặc không thể xóa thành viên");
          return;
        }
        console.log("Xóa thành viên khỏi nhóm:", chat);
        // Kiểm tra xem members có tồn tại và có dữ liệu không
        if (!chat.members || chat.members.length === 0) {
          console.error("❌ Không có thành viên trong nhóm sau khi xóa.");
          return;
        }
        const newMembers = chat.members;
        // Lấy thông tin đầy đủ của các thành viên mới
        const Informember = await Controller.getInforMember(newMembers);
    
        if (!Informember || Informember.length === 0) {
          console.error("❌ Không thể lấy thông tin thành viên mới.");
          return;
        }
        io.to(memberID).emit("removeChatt", chatID); 
        // Gửi socket event tới tất cả thành viên
        newMembers.forEach((member) => {
          const socketID = member.userID;
          // Gửi thông tin thành viên mới đến từng người
          io.to(socketID).emit("outMember", Informember);
      
          // Gửi bản cập nhật nhóm mới (chat) đến từng người
          io.to(socketID).emit("updateMemberChat", chat);
        });
    
      } catch (error) {
        console.error("Error removing member:", error);
        socket.emit("removeMemberResponse", { success: false, message: "Lỗi khi xóa thành viên." });
      }
    });
    socket.on("updateAdmin", async (data) => {
      try {
        const { chatID, adminID, memberID } = data;
    
        // Gọi controller để cập nhật admin
        const chat = await Controller.transferRole(chatID, adminID, memberID);
    
        console.log("Cập nhật quyền admin:", chat);
        // Kiểm tra lỗi từ controller
        if (!chat || chat.error) {
          console.error("❌ Không thể cập nhật quyền admin:", chat?.error || "Lỗi không xác định");
          return;
        }
    
        // Kiểm tra members tồn tại
        if (!chat.members || chat.members.length === 0) {
          console.error("❌ Không có thành viên trong nhóm sau khi chuyển quyền.");
          return;
        }
    
        const newMembers = chat.members;
        console.log("✅ Thành viên mới sau khi chuyển quyền:", newMembers);
    
        // Lấy thông tin thành viên
        const Informember = await Controller.getInforMember(newMembers);
    
        if (!Informember || Informember.length === 0) {
          console.error("❌ Không thể lấy thông tin thành viên.");
          return;
        }
    
        console.log("✅ Thông tin thành viên mới:", Informember);
    
        // Gửi socket đến các thành viên
        newMembers.forEach((member) => {
          const socketID = member.userID;
    
          io.to(socketID).emit("UpdateRole", Informember);   // Gửi danh sách thành viên cập nhật
          io.to(socketID).emit("updateChatmember", chat);         // Gửi dữ liệu nhóm mới
        });
    
      } catch (error) {
        console.error("❌ Lỗi khi cập nhật admin:", error);
      }
    });

    socket.on("deleteGroupAndMessages", async (data) => {
      try{
      const { chatID } = data;
      const chatmember = await ChatMembers.findOne({ chatID });
      if (!chatmember) {
        console.error("❌ Không tìm thấy nhóm với chatID:", chatID);
        return;
      }
      const result = await Controller.deleteGroupAndMessages(chatID);
      if (!result) {
        console.error("❌ Không thể xóa nhóm hoặc không tìm thấy nhóm với chatID:", chatID);
        return;
      }
      chatmember.members.forEach((member) => {
        const socketID = member.userID;
        io.to(socketID).emit("removeChatt", chatID); // Gửi thông báo xóa nhóm cho tất cả thành viên
      });
    }catch (error) {
      console.error("❌ Lỗi khi xóa nhóm và tin nhắn:", error);
    }
    });
    socket.on("deleteMember", async (data) => {
      try {
        const {chatID,adminID, memberID} = data;
        const chat = await Controller.removeMemberFromGroup(chatID, adminID, memberID);
        if (!chat) {
          console.error("❌ Không tìm thấy nhóm hoặc không thể xóa thành viên");
          return;
        }
        console.log("Xóa thành viên khỏi nhóm:", chat);
        const newMembers = chat.members;
        // Lấy thông tin đầy đủ của các thành viên mới
        const Informember = await Controller.getInforMember(newMembers);
        if (!Informember || Informember.length === 0) {
          console.error("❌ Không thể lấy thông tin thành viên mới.");
          return;
        }
          io.to(memberID).emit("removeChattt", chatID); // Gửi thông báo xóa nhóm cho thành viên đã bị xóa
         // return; // Bỏ qua thành viên đã bị xóa
        // Gửi socket event tới tất cả thành viên
        newMembers.forEach((member) => {
          const socketID = member.userID;
          // Gửi thông tin thành viên mới đến từng người
          io.to(socketID).emit("outMemberr", Informember);
      
          // Gửi bản cập nhật nhóm mới (chat) đến từng người
          io.to(socketID).emit("updateMemberChattt", chat);
        });
      
      }
      catch (error) {
        console.error("❌ Lỗi khi xóa thành viên:", error);
      }
    });
     socket.on("call-user", (data) => {
    io.to(data.to).emit("call-made", {
      offer: data.offer,
      from: socket.id,
    });
  });

  socket.on("make-answer", (data) => {
    io.to(data.to).emit("answer-made", {
      answer: data.answer,
      from: socket.id,
    });
  });

  socket.on("ice-candidate", (data) => {
    io.to(data.to).emit("ice-candidate", {
      candidate: data.candidate,
      from: socket.id,
    });
  });
        
    // Ngắt kết nối
    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
    });
  });
};

module.exports = socketHandler;
