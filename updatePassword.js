const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("./models/User");

mongoose.connect("mongodb://localhost:27017/CNM")
    .then(() => console.log("Kết nối MongoDB thành công!"))
    .catch((err) => console.error("Lỗi kết nối MongoDB:", err));

    async function updateAllPasswords() {
    
        const users = await User.find({ matKhau: { $not: /^[$]/ } }); // Lọc những mật khẩu chưa mã hóa
    
        for (const user of users) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(user.matKhau, salt);
    
            await User.updateOne(
                { _id: user._id },
                { $set: { matKhau: hashedPassword } }
            );
        }
    
        console.log("✅ Tất cả mật khẩu đã được mã hóa!");
        mongoose.connection.close();
    }

updateAllPasswords();
