const messages = require("../models/Messages");
const ChatMembers = require("../models/ChatMember");
const Controller = require("../controller/index");

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
      try{
        const contacts = await Controller.getContacts(userID);
        socket.emit("contacts", contacts);

      }catch (error) {
        console.error("❌ Error getting contacts:", error);
        socket.emit("error", { message: "Lỗi khi lấy danh sách liên hệ" });
      }
    });
    // Gửi lời mời kết bạn theo sdt
socket.on("send_friend_request", async (data) => {
  try {
    const { senderID, senderPhone, recipientPhone } = data;

    // Kiểm tra nếu người nhận có kết nối
    const recipientSocketId = users[recipientPhone];
    if (!recipientSocketId) {
      console.warn(`⚠️ User with phone number ${recipientPhone} is not connected`);
      return;
    }

    // Kiểm tra nếu userID có tồn tại và hợp lệ
    if (!senderID || !recipientPhone) {
      console.error("❌ Missing senderID or recipientPhone");
      return;
    }

    // Tạo và lưu yêu cầu kết bạn vào Contacts
    const friendRequestData = {
      senderID,            // ID của người gửi yêu cầu
      senderPhone,         // Số điện thoại người gửi
      recipientPhone,      // Số điện thoại người nhận
      status: "pending",    // Trạng thái yêu cầu kết bạn
      timestamp: Date.now(), // Thời gian gửi yêu cầu
    };

    // Lưu vào model Contacts
    const newFriendRequest = new Contacts({
      userID: senderID, // userID của người gửi yêu cầu (có thể là senderID)
      contactID: recipientPhone, // contactID có thể là số điện thoại người nhận
      alias: "Default Alias",  // Nếu có thể, hãy thêm một alias tùy chọn
      status: "pending", // Trạng thái yêu cầu kết bạn
    });

    await newFriendRequest.save(); // Lưu vào MongoDB

    // Phát sự kiện đến cả người nhận và người gửi yêu cầu kết bạn
    io.to(recipientSocketId).emit("new_friend_request", friendRequestData);
    io.to(senderID).emit("new_friend_request", friendRequestData);

    console.log("📩 Friend request sent:", friendRequestData);
  } catch (error) {
    console.error("❌ Error sending friend request:", error);
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

    // Ngắt kết nối
    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
    });
  });
};

module.exports = socketHandler;
