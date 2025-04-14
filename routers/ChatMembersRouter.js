const express = require("express");
const ChatMembers = require("../models/ChatMember");
const Controller = require("../controller");
const router = express.Router();

router.get("/chatmembers", async (req, res) => {
    try {
      const chatmembers = await ChatMembers.find();
      res.json(chatmembers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
router.post("/chatmembers/id", async (req, res) => {
try {
    const {userID} = req.body;
    const chatmembers = await ChatMembers.find({userID: userID });
    if (!chatmembers) {
        return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện!" });
    }
    res.status(200).json(chatmembers);
} catch (error) {
    res.status(500).json({ error: error.message });
}
});
router.post("/chatmemberBychatID&userID", async (req, res) => {
  try {
      const {userID,chatID} = req.body;
      const chatmember = await ChatMembers.findOne({userID: userID,chatID: chatID });
      if (!chatmember) {
          return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện!" });
      }
      const user = await Controller.getUserByID(chatmember.memberID);
      res.status(200).json(user);
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
  });

module.exports = router;
