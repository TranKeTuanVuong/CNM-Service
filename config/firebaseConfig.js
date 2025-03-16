const admin = require("firebase-admin");

// Kiểm tra nếu Firebase chưa được khởi tạo thì mới khởi tạo
if (!admin.apps.length) {
  const serviceAccount = require("./firebase-service-account.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = admin;
