const express = require("express");
const messages = require("../models/Messages");
const Controller = require("../controller/index");
const router = express.Router();

router.get("/messages", async (req, res) => {
    try {
      const message = await messages.find();
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  router.post("/messages/id", async (req, res) => {
    try {
      const { chatids } = req.body;
      if (!Array.isArray(chatids) || chatids.length === 0) {
        return res.status(400).json({ message: 'chatids phải là một mảng không rỗng' });
      }
  
      const message = await messages.find({ chatID: { $in: chatids } });
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  router.post("/creatmsg/chatID", async (req, res) => {
    try{
       const { newMsg } = req.body;
       const result = await Controller.getCreatMessageByChatID(newMsg);
       res.status(200).json(result);
    }catch (error) {
        console.error("Lỗi khi lấy chat:", error);
        res.status(500).json({ error: error.message });
    }
  });

module.exports = router;