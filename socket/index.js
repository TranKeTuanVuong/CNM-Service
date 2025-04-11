const messages = require("../models/Messages");
const ChatMembers = require("../models/ChatMember");
const Controller = require("../controller/index");

const socketHandler = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Client connected:", socket.id);

    socket.on("join_user", (userID) => {
      socket.join(userID);
      console.log(`🧍‍♂️ Socket ${socket.id} joined user room: ${userID}`);
    });

    socket.on("join_chat", (chatID) => {
      socket.join(chatID);
      console.log(`🔁 Socket ${socket.id} joined room: ${chatID}`);
    });

    socket.on("send_message", async (data) => {
      console.log(`📨 New message to chat ${data.chatID}`, data);

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

    // ✅ Cập nhật trạng thái đã đọc vào DB
    socket.on("read_messages", async ({ chatID, userID }) => {
      try {
        await messages.findOneAndUpdate(
          { chatID,userID },
          { status: "read" },
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
