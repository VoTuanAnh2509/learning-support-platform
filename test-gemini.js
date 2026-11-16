// test-gemini.js
require('dotenv').config(); // Load file .env của bạn

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ Không tìm thấy GEMINI_API_KEY trong file .env");
    process.exit(1);
}

async function checkAvailableModels() {
    console.log("Đang kiểm tra danh sách models được hỗ trợ bởi API Key của bạn...");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        
        if (data.error) {
            console.error("❌ Lỗi từ Google:", data.error.message);
            return;
        }

        console.log("✅ Các models khả dụng cho 'generateContent':\n");
        const supportedModels = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
        
        supportedModels.forEach(m => {
            console.log(`- Tên Model: "${m.name.replace('models/', '')}"`);
        });
        
    } catch (error) {
        console.error("❌ Lỗi kết nối:", error);
    }
}

checkAvailableModels();