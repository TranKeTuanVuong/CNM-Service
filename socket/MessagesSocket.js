

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