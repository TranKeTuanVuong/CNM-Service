require("dotenv").config();
const express = require("express");
const http = require('http');
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require('socket.io');
const app = express();
const userRoutes = require("./routers/UserRouter");
const chatRoutes = require("./routers/ChatRouter");
const MessagesRoutes = require("./routers/MessageRouter");
const chatMembersRoutes = require("./routers/ChatMembersRouter");
const ContactsRoutes = require("./routers/ContactsRouter");
const messages = require('../models/Messages');


const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
// Middleware
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json());

// Kết nối MongoDB
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI environment variable is not defined");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));


// Khi client kết nối
io.on('connection', (socket) => {
  console.log('🟢 Client connected:', socket.id);

  // Lắng nghe sự kiện gửi tin nhắn từ client
  socket.on('join_chat', (chatID) => {
    socket.join(chatID);
    console.log(`🔁 Socket ${socket.id} joined room ${chatID}`);
  });

  // Khi có người gửi tin nhắn
  socket.on('send_message', async (data) => {
    console.log(`📨 New message to chat ${data.chatID}`, data);
  
    try {
      // Lấy message cuối để tạo ID tăng dần
      const lastMessage = await messages.findOne().sort({ messageID: -1 }).limit(1);
  
      let newMessageID = "msg001"; // mặc định
      if (lastMessage && lastMessage.messageID) {
        const lastNumber = parseInt(lastMessage.messageID.replace('msg', ''), 10);
        newMessageID = `msg${(lastNumber + 1).toString().padStart(3, '0')}`;
      }
  
      // Tạo document mới
      const newMsg = new messages({
        messageID: newMessageID,
        chatID: data.chatID,
        senderID: data.senderID,
        content: data.content || "",
        type: data.type || "text", // text / image / video
        timestamp: data.timestamp || Date.now(),
        media_url: data.media_url || [],
        status: "sent"
      });
  
      const saved = await newMsg.save(); // lưu vào MongoDB
  
      // Emit lại tin nhắn cho tất cả người dùng trong phòng
      io.to(data.chatID).emit(data.chatID, {
        ...data,
        messageID: saved.messageID,
        timestamp: saved.timestamp,
        status: 'sent',
      });
  
      // Sau 1 giây gửi status "delivered"
      setTimeout(() => {
        io.to(data.chatID).emit(`status_update_${data.chatID}`, {
          messageID: saved.messageID,
          status: 'delivered',
        });
  
        // (Tuỳ chọn) cập nhật status trong DB
        messages.findOneAndUpdate(
          { messageID: saved.messageID },
          { status: 'delivered' }
        ).exec();
      }, 1000);
  
    } catch (error) {
      console.error("❌ Error saving message:", error);
    }
  });

// Người dùng mở phòng → báo "read"
socket.on('read_messages', ({ chatID, userID }) => {
  io.to(chatID).emit(`status_update_${chatID}`, {
    userID,
    status: 'read',
  });
});


  // Khi client ngắt kết nối
  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
  });
});

  
  app.use("/api", userRoutes);
  app.use("/api", chatRoutes);
  app.use("/api", MessagesRoutes);
  app.use("/api", chatMembersRoutes);
  app.use("/api", ContactsRoutes);
  // Chạy server
const PORT = process.env.PORT || 5000;
const PORTSOCKET = process.env.PORTSEVER || 3000;
server.listen(PORTSOCKET, () => console.log(`🚀 Server running on port ${PORT}`));
//app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
