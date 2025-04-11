require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const userRoutes = require("./routers/UserRouter");
const chatRoutes = require("./routers/ChatRouter");
const MessagesRoutes = require("./routers/MessageRouter");
const chatMembersRoutes = require("./routers/ChatMembersRouter");

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


  
  app.use("/api", userRoutes);
  app.use("/api", chatRoutes);
  app.use("/api", MessagesRoutes);
  app.use("/api", chatMembersRoutes);
  // Chạy server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
