const express = require("express");
const Contacts = require("../models/Contacts"); // Đảm bảo bạn sử dụng đúng đường dẫn
const Users = require("../models/User");
const router = express.Router();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// Middleware để parse dữ liệu từ request
router.use(bodyParser.json());

const isValidPhoneNumber = (phoneNumber) => {
    const phoneRegex = /^(0[3,5,7,8,9])[0-9]{8}$/;
    return phoneRegex.test(phoneNumber);
  };
  // API để gửi yêu cầu kết bạn
router.post('/send-friend-request', async (req, res) => {
  const { phoneNumber, userID } = req.body;

  // Kiểm tra nếu người dùng gửi yêu cầu cho chính mình
  if (userID === phoneNumber) {
    return res.status(400).json({ message: "Bạn không thể gửi yêu cầu kết bạn cho chính mình!" });
  }

  // Kiểm tra số điện thoại có hợp lệ không
  if (!isValidPhoneNumber(phoneNumber)) {
    return res.status(400).json({ message: 'Số điện thoại không hợp lệ!' });
  }

  try {
    // Tìm người dùng theo số điện thoại
    const targetUser = await Users.findOne({ sdt: phoneNumber });

    if (!targetUser) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng với số điện thoại này.' });
    }

    // Kiểm tra xem yêu cầu kết bạn đã tồn tại chưa
    const existingContact = await Contacts.findOne({
      $or: [
        { userID: userID, contactID: targetUser.userID }, // Kiểm tra yêu cầu từ userID đến contactID
        { userID: targetUser.userID, contactID: userID }  // Kiểm tra yêu cầu ngược lại
      ]
    });

    if (existingContact) {
      if (existingContact.status === 'pending') {
        return res.status(400).json({ message: 'Yêu cầu kết bạn đang chờ xử lý.' });
      } else if (existingContact.status === 'accepted') {
        return res.status(400).json({ message: 'Bạn đã là bạn bè với người này!' });
      } else {
        // Nếu trạng thái không phải là "pending" hay "accepted", chuyển trạng thái thành "pending"
        existingContact.status = 'pending';
        await existingContact.save();
        return res.status(200).json({ message: 'Yêu cầu kết bạn đã được gửi lại!' });
      }
    }

    // Nếu không có yêu cầu kết bạn, tạo yêu cầu mới
    const newContact = new Contacts({
      contactID: targetUser.userID,
      userID: userID,
      alias: `${targetUser.name}`,
      status: 'pending', // Trạng thái yêu cầu đang chờ
      created_at: new Date(),
    });

    await newContact.save();

    return res.status(200).json({ message: 'Yêu cầu kết bạn đã được gửi!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
  }
});

  
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
  const { userID } = req.params; // Lấy userID từ tham số URL (người nhận yêu cầu kết bạn)

  try {
    // Tìm tất cả các yêu cầu kết bạn đang chờ mà người nhận là userID (contactID trong Contacts)
    const pendingRequests = await Contacts.find({
      contactID: userID,  // Người nhận là contactID (userID của người nhận yêu cầu)
      status: 'pending'   // Chỉ lấy những yêu cầu đang chờ
    }).exec();

    // Nếu không có yêu cầu nào
    if (pendingRequests.length === 0) {
      return res.status(200).json({ message: 'Không có yêu cầu kết bạn nào đang chờ.' });
    }

    // Fetch thông tin chi tiết người gửi yêu cầu (người có contactID)
    const friendDetails = [];

    // Duyệt qua tất cả các yêu cầu đang chờ
    for (let request of pendingRequests) {
      const senderID = request.userID; // userID là người gửi yêu cầu

      // Lấy thông tin người gửi từ Users
      const senderUser = await Users.findOne({ userID: senderID }).select('name anhDaiDien sdt').exec();

      if (senderUser) {
        friendDetails.push({
          userID: senderID,  // Trả về userID của người gửi yêu cầu kết bạn (người đã gửi)
          name: senderUser.name,
          avatar: senderUser.anhDaiDien,
          phoneNumber: senderUser.sdt,
          alias: request.alias // Alias từ bảng Contacts
        });
      }
    }

    // Trả về danh sách yêu cầu kết bạn đang chờ với thông tin người gửi
    res.status(200).json(friendDetails);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách yêu cầu kết bạn:', error);
    res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau.' });
  }
});
module.exports = router;  