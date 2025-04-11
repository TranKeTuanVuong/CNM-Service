require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const userRoutes = require("./routers/UserRouter");
const chatRoutes = require("./routers/ChatRouter");
const MessagesRoutes = require("./routers/MessageRouter");
const chatMembersRoutes = require("./routers/ChatMembersRouter");
const ContactsRoutes = require("./routers/ContactsRouter");

const app = express();

// Middleware
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
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

// Routes
app.use("/api", userRoutes);
app.use("/api", chatRoutes);
app.use("/api", MessagesRoutes);
app.use("/api", chatMembersRoutes);
app.use("/api", ContactsRoutes);

module.exports = app;
