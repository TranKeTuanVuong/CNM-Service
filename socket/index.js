const messages = require("../models/Messages");
const ChatMembers = require("../models/ChatMember");
const Controller = require("../controller/index");
const Contacts = require("../models/Contacts");
const Users = require("../models/User");

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
    // Tham gia phòng chat 1-1
    socket.on('createChat1-1', async (data) => {
      try {
        if (!data?.chatID) {
          console.error("❌ Không có chatID trong data");
          return;
        }
    
        const chatmembers = await ChatMembers.find({ chatID: data.chatID });
    
        if (!chatmembers.length) {
          console.log("⚠️ Không tìm thấy thành viên trong chat:", data.chatID);
          return;
        }
    
        chatmembers.forEach((member) => {
          io.to(member.userID).emit("newChat1-1", { data });
          console.log(`📤 Gửi newChat1-1 đến user ${member.userID}`);
        });
      } catch (error) {
        console.error("❌ Error creating chat:", error);
      }
    });
    

    // Gửi tin nhắn mới
    socket.on("send_message", async (data) => {
      try {
        const lastMessage = await messages.findOne().sort({ messageID: -1 });
        const nextID = lastMessage
          ? parseInt(lastMessage.messageID.replace("msg", "")) + 1
          : 1;
        const messageID = `msg${String(nextID).padStart(3, "0")}`;

        const newMsg = new messages({
          messageID,
          chatID: data.chatID,
          senderID: data.senderID,
          content: data.content || "",
          type: data.type || "text",
          timestamp: data.timestamp || Date.now(),
          media_url: data.media_url || [],
          status: "sent",
        });

        const saved = await newMsg.save();

        const chatMembers = await ChatMembers.find({ chatID: data.chatID });
        const receiverIDs = chatMembers
          .map((m) => m.userID)
          .filter((id) => id !== data.senderID);

        const fullMessage = {
          ...data,
          messageID: saved.messageID,
          timestamp: saved.timestamp,
          status: "sent",
          senderInfo: {
            name: data.senderName || "Người dùng",
            avatar: data.senderAvatar || null,
          },
        };

        receiverIDs.forEach((userID) => {
          io.to(userID).emit("new_message", fullMessage);
        });

        io.to(data.senderID).emit("new_message", fullMessage);
        io.to(data.chatID).emit(data.chatID, fullMessage);

        setTimeout(() => {
          messages.findOneAndUpdate(
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

        if (!message || message.senderID !== senderID) {
          console.warn("⚠️ Unauthorized unsend or not found");
          return;
        }

        message.isUnsent = true;
        message.content = "";
        message.media_url = [];
        await message.save();

        const unsentData = {
          messageID,
          chatID,
          senderID,
          isUnsent: true,
          timestamp: Date.now(),
        };

        io.to(chatID).emit("unsend_notification", unsentData);

        const members = await ChatMembers.find({ chatID });
        members.forEach((m) => {
          io.to(m.userID).emit("unsend_notification", unsentData);
        });

        console.log("❌ Message unsent:", messageID);
      } catch (error) {
        console.error("❌ Error unsending message:", error);
      }
    });
// Lắng nghe sự kiện gửi yêu cầu kết bạn
    socket.on("send_friend_request", async (data) => {
      try {
        const { senderID, senderPhone, recipientPhone, senderName, senderImage } = data;
    
        if (!senderID || !senderPhone || !recipientPhone) {
          socket.emit("error", { message: "Thiếu thông tin người gửi hoặc người nhận" });
          return;
        }
    
        const recipientUser = await Users.findOne({ sdt: recipientPhone });
        if (!recipientUser) {
          socket.emit("error", { message: "Không tìm thấy người nhận" });
          return;
        }
    
        // Kiểm tra đã gửi lời mời chưa
        const existingRequest = await Contacts.findOne({
          userID: senderID,
          contactID: recipientUser.userID,
          status: "pending",
        });
    
        if (existingRequest) {
          socket.emit("error", { message: "Đã gửi lời mời trước đó" });
          return;
        }
    
        // Lưu vào database
        const newFriendRequest = new Contacts({
          userID: senderID,
          contactID: recipientUser.userID,
          alias: "Default Alias",
          status: "pending",
        });
    
        await newFriendRequest.save();
    
        // Gửi yêu cầu kết bạn qua socket tới người nhận và người gửi
        const friendRequestData = {
          senderID,
          senderPhone,
          recipientPhone,
          senderName,
          senderImage,
          status: "pending",
          timestamp: Date.now(),
        };
    
        // Phát sự kiện cho người nhận yêu cầu kết bạn ngay lập tức
        const recipientSocketId = users[recipientPhone];
    
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("new_friend_request", friendRequestData); // Phát sự kiện gửi yêu cầu
        }
    
        // Phát sự kiện cho người gửi yêu cầu kết bạn (để hiển thị trạng thái đã gửi yêu cầu)
        const senderSocketId = users[senderPhone];
        if (senderSocketId) {
          io.to(senderSocketId).emit("friend_request_sent", friendRequestData);
        }
    
        console.log("📩 Friend request sent:", friendRequestData);
      } catch (error) {
        console.error("❌ Error sending friend request:", error);
        socket.emit("error", { message: "Lỗi server" });
      }
    });
  // Lắng nghe sự kiện accept_friend_request
    socket.on("accept_friend_request", async ({ senderID, recipientID }) => {
      try {
        // Cập nhật trạng thái yêu cầu kết bạn trong database
        const updatedRequest = await Contacts.findOneAndUpdate(
          { userID: senderID, contactID: recipientID, status: "pending" },
          { status: "accepted" },
          { new: true }
        );
    
        if (updatedRequest) {
          // Phát sự kiện cho cả người gửi và người nhận
          io.to(users[senderID]).emit("friend_request_accepted", { senderID, recipientID });
          io.to(users[recipientID]).emit("friend_request_accepted", { senderID, recipientID });
          }
        } catch (error) {
          console.error("❌ Error accepting friend request:", error);
        }
      });
      
      socket.on("reject_friend_request", async ({ senderID, recipientID }) => {
        try {
          // Xóa yêu cầu kết bạn trong database
          const deletedRequest = await Contacts.findOneAndDelete({
            userID: senderID,
            contactID: recipientID,
            status: "pending",
          });
      
          if (deletedRequest) {
            // Phát sự kiện từ chối yêu cầu cho cả người gửi và người nhận
            io.to(users[senderID]).emit("friend_request_rejected", { senderID, recipientID });
            io.to(users[recipientID]).emit("friend_request_rejected", { senderID, recipientID });
          }
        } catch (error) {
          console.error("❌ Error rejecting friend request:", error);
        }
      });
  
      // Lắng nghe sự kiện get_pending_friend_requests
      socket.on("get_pending_friend_requests", async (userID) => {
        try {
          // Gọi controller để lấy danh sách yêu cầu kết bạn đang chờ
          const friendRequests = await contactController.displayFriendRequest(userID);
          socket.emit("pending_friend_requests", friendRequests); // Gửi lại thông tin yêu cầu kết bạn đang chờ
        } catch (error) { 
          console.error("❌ Error fetching pending friend requests:", error);
          socket.emit("error", { message: "Lỗi khi lấy yêu cầu kết bạn" });
        }
      });

    // Ngắt kết nối
    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
    });
  });
};

module.exports = socketHandler;
