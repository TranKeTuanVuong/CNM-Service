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
      const chatmember = await ChatMembers.findOne({"members.userID": userID,chatID: chatID });
      if (!chatmember) {
          return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện!" });
      }
      const memberIDs = chatmember.members
      .filter(member => member.userID !== userID)
      .map(member => member.userID);
  
      console.log(memberIDs);
      const user = await Controller.getUserByID(memberIDs);
      res.status(200).json(user);
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
  });
  router.post("/addMemberGroup", async (req, res) => {
    try {
      const { chatID, memberIDs } = req.body;  // Sử dụng mảng memberIDs thay vì một memberID duy nhất
      console.log("Chat ID:", chatID, "Member IDs:", memberIDs);
    
      if (!Array.isArray(memberIDs)) {
        return res.status(400).json({ message: "memberIDs phải là một mảng!" });
      }
  
      // Gọi Controller để thêm các thành viên vào nhóm
      const chat = await Controller.addMembersToGroup(chatID, memberIDs);
    
      // Nếu không tìm thấy chat hoặc không thêm thành viên
      if (!chat) {
        return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện!" });
      }
  
      // Nếu thành công, trả về thông tin nhóm đã được cập nhật
      res.status(200).json({
        message: "Các thành viên đã được thêm vào nhóm thành công!",
        chat: chat
      });
    } catch (error) {
      // Catch any errors and respond with 500 status code
      console.error("Lỗi khi xử lý yêu cầu:", error);
      res.status(500).json({ error: error.message });
    }
  });
  

  router.post("/removeMemberFromGroup", async (req, res) => {
    try {
      const { chatID, adminID, memberID } = req.body; // Lấy chatID, adminID và memberID từ request body
      console.log(chatID, adminID, memberID);
  
      // Gọi Controller để xóa thành viên khỏi nhóm
      const result = await Controller.removeMemberFromGroup(chatID, adminID, memberID);
  
      // Kiểm tra nếu Controller trả về lỗi (thành viên không tồn tại hoặc không phải admin)
      if (result && result.error) {
        return res.status(400).json({ message: result.error }); // Trả về lỗi nếu có
      }
  
      // Nếu thành công, trả về nhóm đã được cập nhật
      res.status(200).json({
        message: "Thành viên đã được xóa khỏi nhóm thành công!",
        chat: result
      });
    } catch (error) {
      // Catch any errors and respond with 500 status code
      console.error("Lỗi khi xử lý yêu cầu:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/leaveGroup", async (req, res) => {
  try {
    const { chatID, memberID } = req.body; // Nhận chatID và memberID từ body

    console.log(`Thành viên ${memberID} muốn rời nhóm ${chatID}`);

    // Gọi Controller để thành viên rời nhóm
    const result = await Controller.userRemoveFromGroup(chatID, memberID);

    // Kiểm tra nếu controller trả về lỗi (thành viên không tồn tại hoặc không tìm thấy nhóm)
    if (result && result.error) {
      return res.status(400).json({ message: result.error }); // Trả về lỗi nếu có
    }

    // Nếu thành công, trả về nhóm đã được cập nhật
    res.status(200).json({
      message: "Thành viên đã rời nhóm thành công!",
      chat: result
    });
  } catch (error) {
    // Catch any errors and respond with 500 status code
    console.error("Lỗi khi xử lý yêu cầu:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/changeMemberRole", async (req, res) => {
  try {
    const { chatID, adminID, memberID, newRole } = req.body; // Nhận chatID, adminID, memberID, newRole từ body

    console.log(`Admin ${adminID} muốn thay đổi quyền của thành viên ${memberID} thành ${newRole} trong nhóm ${chatID}`);

    // Gọi Controller để thay đổi quyền cho thành viên
    const result = await Controller.changeMemberRole(chatID, adminID, memberID, newRole);

    // Kiểm tra nếu Controller trả về lỗi (không phải admin hoặc không tìm thấy thành viên)
    if (result && result.error) {
      return res.status(400).json({ message: result.error }); // Trả về lỗi nếu có
    }

    // Nếu thành công, trả về nhóm đã được cập nhật
    res.status(200).json({
      message: `Quyền của thành viên đã được thay đổi thành ${newRole} thành công!`,
      chat: result
    });
  } catch (error) {
    // Catch any errors and respond with 500 status code
    console.error("Lỗi khi xử lý yêu cầu:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/transferRole", async (req, res) => {
  try {
    const { chatID, adminID, memberID } = req.body; // Nhận chatID, adminID, memberID từ body

    console.log(`Admin ${adminID} muốn chuyển quyền cho thành viên ${memberID} trong nhóm ${chatID}`);

    // Gọi Controller để thay đổi quyền
    const result = await Controller.transferRole(chatID, adminID, memberID);

    // Kiểm tra nếu Controller trả về lỗi (không phải admin, thành viên không tồn tại)
    if (result && result.error) {
      return res.status(400).json({ message: result.error }); // Trả về lỗi nếu có
    }

    // Nếu thành công, trả về nhóm đã được cập nhật
    res.status(200).json({
      message: `Quyền của thành viên và admin đã được thay đổi thành công!`,
      chat: result
    });
  } catch (error) {
    // Catch any errors and respond with 500 status code
    console.error("Lỗi khi xử lý yêu cầu:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/deleteGroupAndMessages", async (req, res) => {
  try {
    const { chatID } = req.body; // Nhận chatID từ body

    console.log(`Yêu cầu giải tán nhóm và xóa tất cả dữ liệu liên quan đến nhóm ${chatID}`);

    // Gọi Controller để xóa nhóm và các tin nhắn liên quan
    const result = await Controller.deleteGroupAndMessages(chatID);

    // Kiểm tra nếu Controller trả về lỗi (không tìm thấy nhóm)
    if (result && result.error) {
      return res.status(400).json({ message: result.error }); // Trả về lỗi nếu có
    }

    // Nếu thành công, trả về thông báo nhóm đã được xóa
    res.status(200).json({
      message: result.message,
    });
  } catch (error) {
    // Catch any errors and respond with 500 status code
    console.error("Lỗi khi xử lý yêu cầu:", error);
    res.status(500).json({ error: error.message });
  }
});

// Router để gọi Controller.getMemberAddMember
// Router để gọi Controller.getMemberAddMember
router.post("/getMemberAddMember", async (req, res) => {
  try {
    const { chatID, userID } = req.body;

    // Gọi Controller để lấy danh sách bạn bè chưa là thành viên nhóm
    const friendsNotInGroup = await Controller.getMemberAddMember(chatID, userID);

    if (friendsNotInGroup.error) {
      return res.status(400).json({ message: friendsNotInGroup.error }); // Nếu có lỗi, trả về thông báo lỗi
    }

    // Nếu thành công, trả về danh sách bạn bè chưa là thành viên nhóm
    return res.status(200).json({
      message: "Lấy danh sách bạn bè thành công.",
      friends: friendsNotInGroup,
    });
  } catch (error) {
    console.error("Lỗi khi xử lý yêu cầu:", error);
    return res.status(500).json({ error: error.message });
  }
});



  
module.exports = router;
