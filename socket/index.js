const messages = require("../models/Messages");
const ChatMembers = require("../models/ChatMember");
const Controller = require("../controller/index");

const socketHandler = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Client connected:", socket.id);

    // Join theo userID để gửi new_message
    socket.on("join_user", (userID) => {
      socket.join(userID);
      console.log(`🧍‍♂️ Socket ${socket.id} joined user room: ${userID}`);
    });

    // Join room theo chatID để nhận cập nhật trong nhóm
    socket.on("join_chat", (chatID) => {
      socket.join(chatID);
      console.log(`🔁 Socket ${socket.id} joined room: ${chatID}`);
    });

    // Gửi tin nhắn mới
    socket.on("send_message", async (data) => {
      console.log(`📨 New message to chat ${data.chatID}`, data);

      try {
        // Tạo messageID mới
        const lastMessage = await messages.findOne().sort({ messageID: -1 });
        const nextID = lastMessage
          ? parseInt(lastMessage.messageID.replace("msg", "")) + 1
          : 1;
        const messageID = `msg${String(nextID).padStart(3, "0")}`;

        // Lưu vào DB
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

        // Lấy các thành viên trong đoạn chat
        const chatMembers = await ChatMembers.find({ chatID: data.chatID });
        const receiverIDs = chatMembers
          .map((m) => m.userID)
          .filter((id) => id !== data.senderID);

        // Gói tin đầy đủ gửi đi
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

        // Gửi tới người nhận qua userID
        receiverIDs.forEach((userID) => {
          io.to(userID).emit("new_message", fullMessage);
        });

        // Gửi lại cho chính người gửi để đồng bộ nếu cần
        io.to(data.senderID).emit("new_message", fullMessage);

        // Gửi vào room nếu đang trong chat
        io.to(data.chatID).emit(data.chatID, fullMessage);

        // Giả lập trạng thái "delivered" sau 1s
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

    // Đánh dấu đã đọc
    socket.on("read_messages", ({ chatID, userID }) => {
      io.to(chatID).emit(`status_update_${chatID}`, {
        userID,
        status: "read",
      });
    });

    // Gửi danh sách đoạn chat cho user
    socket.on("getChat", async (userID) => {
      try {
        const chats = await Controller.getChatsForUser(userID);
        socket.emit("ChatByUserID", chats);
      } catch (error) {
        console.error("❌ Error getting chat list:", error);
        socket.emit("error", { message: "Lỗi khi lấy danh sách chat" });
      }
    });

    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
    });
  });
};

module.exports = socketHandler;
