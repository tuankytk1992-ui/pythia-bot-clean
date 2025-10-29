// Cần sử dụng Node-Fetch để gọi API bên ngoài (nếu gọi Gemini API thật)
const fetch = require('node-fetch');

// Lấy Khóa API AI từ Netlify Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.handler = async (event, context) => {
    // Chỉ chấp nhận phương thức POST (từ Apps Script)
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: "Method Not Allowed" })
        };
    }

    try {
        const data = JSON.parse(event.body);
        const command = data.command;
        const affiliate_id_from_sheet = data.affiliate_id;

        if (command !== 'FULL_AUTO_POST') {
             return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid command." })
            };
        }

        // =======================================================
        // 1. GỌI API AI TẠO NỘI DUNG (GIẢ LẬP)
        // **Trong môi trường thực, code này sẽ gọi API Gemini và chờ nội dung**
        // **Hiện tại, sử dụng nội dung giả lập để khắc phục lỗi trống**
        // =======================================================
        
        let generatedContent = "Hôm nay là một ngày tuyệt vời để khám phá những điều mới lạ! Đừng bỏ lỡ cơ hội học hỏi và phát triển bản thân. Hãy luôn mỉm cười và tự tin nhé."; 
        
        // 2. TẠO LIÊN KẾT AFFILIATE
        // Base link phải là link thật của Chủ nhân
        const AFFILIATE_LINK_BASE = 'https://luuquynhtrang.com/affiliate'; 
        const finalAffiliateLink = `${AFFILIATE_LINK_BASE}?id=${affiliate_id_from_sheet}&source=social`;

        
        // =======================================================
        // 3. LOGIC FIX LỖI 400: ĐẢM BẢO NỘI DUNG VÀ LINK LUÔN CÓ GIÁ TRỊ
        // =======================================================
        let contentForSocial = generatedContent;
        let linkForSocial = finalAffiliateLink;

        // BỔ SUNG LOGIC KIỂM TRA: Nếu nội dung AI trả về là trống hoặc quá ngắn, sử dụng nội dung mặc định.
        if (!generatedContent || typeof generatedContent !== 'string' || generatedContent.trim().length < 10) {
            contentForSocial = "⚡ Bài viết tự động bị lỗi tạo nội dung AI. Vui lòng kiểm tra lại cấu hình API. #AutoPostError";
        }

        // BỔ SUNG LOGIC KIỂM TRA: Nếu liên kết affiliate bị lỗi, sử dụng liên kết mặc định.
        if (!finalAffiliateLink) {
            linkForSocial = "https://www.facebook.com/luuquynhtrang"; // Liên kết mặc định dự phòng
        }
        
        // 4. TRẢ VỀ DỮ LIỆU CHO APPS SCRIPT (VÀ MAKE.COM)
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                // Các KEY này phải KHỚP chính xác với tên trường trên Make.com
                content_ready_for_social: contentForSocial, 
                af_link: linkForSocial 
            })
        };

    } catch (error) {
        console.error("Lỗi trong xử lý Function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error during processing: " + error.message })
        };
    }
};
