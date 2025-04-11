const messages = require("../models/Messages");
const Controller = require("../controller/index");

const socketHandler = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Client connected:", socket.id);

    socket.on("join_chat", (chatID) => {
      socket.join(chatID);
      console.log(`🔁 Socket ${socket.id} joined room ${chatID}`);
    });

    socket.on("send_message", async (data) => {
      console.log(`📨 New message to chat ${data.chatID}`, data);

      try {
        const lastMessage = await messages.findOne().sort({ messageID: -1 }).limit(1);
        let newMessageID = "msg001";
        if (lastMessage && lastMessage.messageID) {
          const lastNumber = parseInt(lastMessage.messageID.replace("msg", ""), 10);
          newMessageID = `msg${(lastNumber + 1).toString().padStart(3, "0")}`;
        }

        const newMsg = new messages({
          messageID: newMessageID,
          chatID: data.chatID,
          senderID: data.senderID,
          content: data.content || "",
          type: data.type || "text",
          timestamp: data.timestamp || Date.now(),
          media_url: data.media_url || [],
          status: "sent",
        });

        const saved = await newMsg.save();

        io.to(data.chatID).emit(data.chatID, {
          ...data,
          messageID: saved.messageID,
          timestamp: saved.timestamp,
          status: "sent",
        });

        setTimeout(() => {
          io.to(data.chatID).emit(`status_update_${data.chatID}`, {
            messageID: saved.messageID,
            status: "delivered",
          });

          messages.findOneAndUpdate(
            { messageID: saved.messageID },
            { status: "delivered" }
          ).exec();
        }, 1000);
      } catch (error) {
        console.error("❌ Error saving message:", error);
      }
    });

    socket.on("read_messages", ({ chatID, userID }) => {
      io.to(chatID).emit(`status_update_${chatID}`, {
        userID,
        status: "read",
      });
    });

    socket.on("getChat", async (userID) => {
        try{
            const chats = await Controller.getChatsForUser(userID);
            socket.emit("ChatByUserID", chats);
        }catch(error){
            console.error("❌ Error saving message:", error);
            socket.emit("error", { message: "Lỗi khi lấy danh sách chat" });
            }
    });

    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
    });
  });
};

module.exports = socketHandler;
