// seedCourses.js
const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const { Course } = require('./models/projectModels');

const MONGO_URI = const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
async function seedDatabase() {
    try {
        console.log('🔄 Đang kết nối tới cơ sở dữ liệu MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Kết nối thành công!\n');

        const seedDataPath = path.join(__dirname, 'seedData');
        const files = fs.readdirSync(seedDataPath).filter(file => file.endsWith('.json'));

        if (files.length === 0) {
            console.log('⚠️ Không tìm thấy file JSON nào trong thư mục seedData.');
            return;
        }

        for (const file of files) {
            const filePath = path.join(seedDataPath, file);
            const rawData = fs.readFileSync(filePath, 'utf-8');
            const courseData = JSON.parse(rawData);

            await Course.deleteMany({ title: courseData.title });
            await Course.create(courseData);
            console.log(`🌱 Đã gieo thành công khóa học: ${courseData.title} (từ file ${file})`);
        }

        console.log('===================================================');
        console.log(`🎉 HOÀN THÀNH! Đã nạp thành công ${files.length} khóa học vào database.`);
        console.log('===================================================');

    } catch (error) {
        console.error('❌ Có lỗi xảy ra trong quá trình gieo dữ liệu:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Đã ngắt kết nối an toàn.');
        process.exit(0);
    }
}

seedDatabase();