// routers/ContactsRouter.js
const express = require("express");
const router = express.Router();
const bodyParser = require('body-parser');
const contactController = require("../controller/index");

router.use(bodyParser.json());

// Các API sử dụng controller
// router.post('/send-friend-request', contactController.sendFriendRequest);
 router.post('/accept-friend-request', contactController.acceptFriendRequest);
 router.post('/reject-friend-request', contactController.rejectFriendRequest);
// router.get('/friends/:userID', contactController.getFriends);
 router.post('/search-friend-by-phone', contactController.searchFriendByPhone);
 router.get('/display-friend-request/:userID', contactController.displayFriendRequest);


  
  router.post('/accept-friend-request', async (req, res) => {
    const { contactID, userID } = req.body;  // contactID là người gửi yêu cầu, userID là người nhận yêu cầu
  
    // Kiểm tra nếu thiếu thông tin contactID hoặc userID
    if (!contactID || !userID) {
      return res.status(400).json({ message: 'Thiếu thông tin contactID hoặc userID.' });
    }
  
    try {
      // Tìm yêu cầu kết bạn giữa userID và contactID với trạng thái "pending"
      const contactRequest = await Contacts.findOne({
        userID: contactID,   // userID là người gửi yêu cầu
        contactID: userID,    // contactID là người nhận yêu cầu
        status: 'pending'     // Chỉ tìm các yêu cầu có trạng thái "pending"
      });
  
      if (!contactRequest) {
        return res.status(404).json({ message: 'Không tìm thấy yêu cầu kết bạn để chấp nhận.' });
      }
  
      // Cập nhật trạng thái yêu cầu kết bạn thành "accepted"
      contactRequest.status = 'accepted';
      await contactRequest.save();  // Lưu thay đổi vào cơ sở dữ liệu
  
      // Cập nhật yêu cầu ngược lại của người gửi
      await Contacts.updateOne(
        { userID: userID, contactID: contactID, status: 'pending' },
        { $set: { status: 'accepted' } } // Cập nhật trạng thái yêu cầu của người nhận
      );
  
      return res.status(200).json({ message: 'Yêu cầu kết bạn đã được chấp nhận!' });
  
    } catch (error) {
      console.error('Lỗi khi chấp nhận yêu cầu kết bạn:', error);
      return res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
    }
  });

  
  router.post('/reject-friend-request', async (req, res) => {
    const { userID, contactID } = req.body; // userID là người nhận yêu cầu, contactID là người gửi yêu cầu
  
    try {
      // Tìm yêu cầu kết bạn với trạng thái "pending"
      const contactRequest = await Contacts.findOne({
        userID: contactID,  // contactID là người gửi yêu cầu
        contactID: userID,   // userID là người nhận yêu cầu
        status: 'pending'    // Trạng thái "pending"
      });
  
      if (!contactRequest) {
        return res.status(404).json({ message: 'Không tìm thấy yêu cầu kết bạn để từ chối.' });
      }
  
      // Cập nhật trạng thái yêu cầu kết bạn thành 'not-friends'
      contactRequest.status = 'not-friends';
      await contactRequest.save();  // Lưu thay đổi vào cơ sở dữ liệu
  
      // Cập nhật yêu cầu ngược lại của người gửi yêu cầu
      await Contacts.updateOne(
        { userID: userID, contactID: contactID, status: 'pending' },
        { $set: { status: 'not-friends' } }  // Cập nhật trạng thái yêu cầu của người nhận
      );
  
      return res.status(200).json({ message: 'Yêu cầu kết bạn đã bị từ chối!' });
  
    } catch (error) {
      console.error('Lỗi khi từ chối yêu cầu kết bạn:', error);
      return res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
    }
  });
  
  
  // API để lấy danh sách bạn bè của userID
  router.get('/friends/:userID', async (req, res) => {
    const { userID } = req.params; // Lấy userID từ tham số URL
  
    try {
      // Tìm tất cả các yêu cầu kết bạn với trạng thái 'accepted' của userID
      const friends = await Contacts.find({
        $or: [
          { userID: userID, status: 'accepted' }, // userID là người gửi yêu cầu
          { contactID: userID, status: 'accepted' } // userID là người nhận yêu cầu
        ]
      }).exec();
  
      // Tạo mảng để chứa thông tin bạn bè
      const friendDetails = [];
  
      // Duyệt qua danh sách bạn bè
      for (let friend of friends) {
        // Tìm thông tin người dùng tương ứng với userID và contactID
        const user = await Users.findOne({ userID: friend.userID === userID ? friend.contactID : friend.userID })
          .select('name sdt anhDaiDien anhBia') // Chọn trường name, sdt, anhDaiDien, anhBia
          .exec();
  
        if (user) {
          friendDetails.push({
            userID: user.userID,
            name: user.name,
            sdt: user.sdt,
            anhDaiDien: user.anhDaiDien, // Thêm trường ảnh đại diện
          });
        }
      }

     // Trả về danh sách bạn bè
     res.json(friendDetails);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
    }
  });
  
  
  router.post('/search-friend-by-phone', async (req, res) => {
    const { phoneNumber, userID } = req.body; // Lấy số điện thoại và userID từ yêu cầu
  
    // Kiểm tra nếu không có số điện thoại hoặc userID
    if (!phoneNumber || !userID) {
      return res.status(400).json({ message: 'Số điện thoại và userID là bắt buộc!' });
    }
  
    // Kiểm tra định dạng số điện thoại hợp lệ
    const phoneRegex = /^(0[3,5,7,8,9])[0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ!' });
    }
  
    try {
      // Nếu số điện thoại tìm kiếm là của chính người dùng, trả về thông tin người dùng mà không cần kiểm tra kết bạn
      const currentUser = await Users.findOne({ userID }); // Lấy thông tin người dùng hiện tại từ userID
      if (currentUser && phoneNumber === currentUser.sdt) {
        return res.status(200).json({
          userID: currentUser.userID,
          anhBia: currentUser.anhBia,
          name: currentUser.name,
          phoneNumber: currentUser.sdt,
          avatar: currentUser.anhDaiDien,
          friendStatus: "self" // Trả về trạng thái "self" để chỉ ra đây là người dùng chính
        });
      }
 
      // Tìm kiếm người dùng có số điện thoại này
      const targetUser = await Users.findOne({ sdt: phoneNumber });
  
      // Nếu không tìm thấy người dùng
      if (!targetUser) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng với số điện thoại này.' });
      }
  
      // Kiểm tra xem người dùng đã là bạn bè chưa
      const existingContact = await Contacts.findOne({
        $or: [
          { userID: userID, contactID: targetUser.userID }, // userID là người gửi yêu cầu
          { userID: targetUser.userID, contactID: userID }  // contactID là người nhận yêu cầu
        ]
      });
  
      let friendStatus = 'none'; // Mặc định chưa có bạn bè
  
      if (existingContact) {
        if (existingContact.status === 'pending') {
          friendStatus = 'pending'; // Yêu cầu kết bạn đang chờ xử lý
        } else if (existingContact.status === 'accepted') {
          friendStatus = 'accepted'; // Đã là bạn bè
        } else {
          friendStatus = 'rejected'; // Yêu cầu kết bạn đã bị từ chối
        }
      }

     // Trả về thông tin người dùng và trạng thái kết bạn
     res.status(200).json({
      userID: targetUser.userID,
      name: targetUser.name,
      phoneNumber: targetUser.sdt,
      friendStatus: friendStatus, // Trạng thái kết bạn
      avatar: targetUser.anhDaiDien,
    });

  } catch (error) {
    console.error('Lỗi khi tìm kiếm người dùng:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra khi tìm kiếm người dùng.' });
  }
});

router.get('/display-friend-request/:userID', async (req, res) => {
  const { userID } = req.params; // Get userID from URL parameter

  try {
    // Find all pending friend requests where the user is the receiver
    const pendingRequests = await Contacts.find({
      contactID: userID,  // The user is the receiver
      status: 'pending'   // Only look for pending requests
    }).exec();

    // If there are no pending requests
    if (pendingRequests.length === 0) {
      return res.status(200).json({ message: 'Không có yêu cầu kết bạn nào đang chờ.' });
    }

    // Fetch user details for each contactID (sender of the request)
    const friendDetails = [];

    // Loop through each pending request
    for (let request of pendingRequests) {
      const contactID = request.userID; // The contactID is the sender of the request

      // Fetch user details for the contact (sender)
      const contactUser = await Users.findOne({ userID: contactID }).select('name anhDaiDien sdt').exec();

      if (contactUser) {
        friendDetails.push({
          contactID,
          name: contactUser.name,
          avatar: contactUser.anhDaiDien,
          phoneNumber: contactUser.sdt,
          alias: request.alias // The alias from the Contact collection
        });
      }
    }

     // Return the list of pending requests with user details
     res.status(200).json(friendDetails);
   } catch (error) {
     console.error('Lỗi khi lấy danh sách yêu cầu kết bạn:', error);
     res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
   }
 });

 router.post('/ContacsFriendByUserID', async (req, res) => {
      try {
      const  {userID} = req.body;
        const contacts = await Controller.getContactsByUserID(userID);
        if (!contacts) {
          return res.status(404).json({ message: 'Không tìm thấy danh bạ!' });
        }
        res.status(200).json(contacts);
      } catch (error) {
        return res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
      }
 });
module.exports = router;  


