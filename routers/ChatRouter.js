const express = require("express");
const Chats = require("../models/Chat");
const Controller = require("../controller/index");
const router = express.Router();

router.get("/chats", async (req, res) => {
    try {
      const chats = await Chats.find();
      res.json(chats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
router.post("/chats/id", async (req, res) => {
try {
    const { chatID } = req.body;
    const chats = await Chats.find({ chatID: chatID });
    if (!chats) {
        return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện!" });
    }
    res.status(200).json(chats);
} catch (error) {
    res.status(500).json({ error: error.message });
}
});
router.post('/chatsID', async (req, res) => {
    try {
      const { chatids } = req.body;
      if (!Array.isArray(chatids) || chatids.length === 0) {
        return res.status(400).json({ message: 'chatids phải là một mảng không rỗng' });
      }
      // Lấy danh sách chat tương ứng
      const chats = await Chats.find({chatID: { $in: chatids } });
      res.json(chats);
    } catch (err) {
      console.error('Lỗi lấy thông tin chat:', err.message);
      res.status(500).json({ message: 'Lỗi server khi lấy thông tin chat' });
    }
  });
router.post('/chats/userID', async (req, res) => {
    try {
      const { userID } = req.body;
      const chats = await Controller.getChatsForUser(userID);
        if (!chats) {
            return res.status(404).json({ message: 'Không tìm thấy cuộc trò chuyện!' });
        }
      res.json(chats);
    } catch (err) {
      console.error('Lỗi lấy thông tin chat:', err.message);
      res.status(500).json({ message: 'Lỗi server khi lấy thông tin chat' });
    }
});
router.post('/chats1-1ByUserID', async (req, res) => {
  try {
    const { userID1,userID2 } = req.body;
    const chats = await Controller.getOneOnOneChat(userID1,userID2);
    if (!chats) {
        return res.status(404).json({ message: 'Không tìm thấy cuộc trò chuyện!' });
    }
    res.json(chats);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách yêu cầu kết bạn:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin chat' });
    
  }
});
router.post('/createChat1-1', async (req, res) => {
  try{
    const { userID1, userID2 } = req.body;
    const chat = await Controller.createChat(userID1, userID2);
    console.log('Tạo cuộc trò chuyện thành công:', chat);
    if(chat){
      res.status(200).json(chat);
    }
  }catch(error){
    console.error('Lỗi khi tạo cuộc trò chuyện:', error);
    res.status(500).json({ message: 'Lỗi server khi tạo cuộc trò chuyện' });
  }
});
module.exports = router;
