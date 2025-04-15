require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const http = require("http"); // Import http module để tạo server HTTP
const socketIo = require("socket.io"); // Import socket.io

const userRoutes = require("./routers/UserRouter");
const chatRoutes = require("./routers/ChatRouter");
const MessagesRoutes = require("./routers/MessageRouter");
const chatMembersRoutes = require("./routers/ChatMembersRouter");
const ContactsRoutes = require("./routers/ContactsRouter");

const app = express();

// Middleware
app.use(cors({ origin: '*', methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json());

// Kết nối MongoDB
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

  // Tạo một HTTP server
const server = http.createServer(app);

// Khởi tạo Socket.io với HTTP server và cấu hình CORS
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5174", // Cho phép frontend kết nối tới Socket.io từ port 5174
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});


// Routes
app.use("/api", userRoutes);
app.use("/api", chatRoutes);
app.use("/api", MessagesRoutes);
app.use("/api", chatMembersRoutes);
app.use("/api", ContactsRoutes);

module.exports = app;
