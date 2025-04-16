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

module.exports = router;
