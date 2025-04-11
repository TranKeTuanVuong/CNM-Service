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
  socket.on('send_message', (data) => {
    console.log(`📨 New message to chat ${data.chatID}`, data);

    // Gửi lại cho tất cả trong phòng (trừ người gửi cũng được nếu muốn)
    io.to(data.chatID).emit(data.chatID, data); 
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
