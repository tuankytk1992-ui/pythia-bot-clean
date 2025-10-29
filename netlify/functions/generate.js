// Sử dụng Node-Fetch để gọi API bên ngoài
const fetch = require('node-fetch');

// Lấy Khóa API từ Netlify Environment Variables
const GEMINI_API_KEY = process.process.env.GEMINI_API_KEY; 
const ACCESSTRADE_API_KEY = process.env.ACCESSTRADE_API_KEY; // Key: OWVe8pCilqvc24abPBYehuFjcONijLyT
const ACCESSTRADE_BASE_URL = 'https://api.accesstrade.vn/v1'; // Endpoint: https://api.accesstrade.vn/v1/campaigns

// Cấu hình Model Gemini
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;


// Hàm gọi API Gemini để tạo nội dung
async function generatePostContent(campaignName) {
    const prompt = `Bạn là một Content Creator chuyên nghiệp. Hãy viết một bài post Facebook (tối đa 5 câu) thật hấp dẫn và kêu gọi hành động (Call To Action) cho chiến dịch affiliate: "${campaignName}". Bài viết cần sử dụng ngôn ngữ trẻ trung, có emoji và nhấn mạnh ưu đãi.`;

    const payload = {
        contents: [
            {
                role: "user",
                parts: [{ text: prompt }]
            }
        ],
        config: {
            temperature: 0.8,
            maxOutputTokens: 256,
        }
    };

    const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0) {
        return data.candidates[0].content.parts[0].text;
    }
    
    return "";
}

// Hàm chính của Netlify Function
exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: "Method Not Allowed" }) };
    }

    let generatedContent = "";
    let finalAffiliateLink = "";
    let defaultMessage = "";

    try {
        const data = JSON.parse(event.body);
        const command = data.command;
        const affiliate_id_from_sheet = data.affiliate_id; // Lấy ID từ Apps Script

        if (command !== 'FULL_AUTO_POST') {
             return { statusCode: 400, body: JSON.stringify({ message: "Invalid command." }) };
        }

        // =======================================================
        // 1. GỌI API ACCESSTRADE & LỌC/ĐÁNH GIÁ CHIẾN DỊCH
        // =======================================================
        const campaignUrl = `${ACCESSTRADE_BASE_URL}/campaigns`;
        
        // --- FIX LỖI UỶ QUYỀN API ACCESSTRADE ---
        // Thay đổi từ 'Token' sang 'Bearer' để fix lỗi 401 Authorization
        const authHeader = `Bearer ${ACCESSTRADE_API_KEY}`; 
        
        const campaignResponse = await fetch(campaignUrl, {
            method: 'GET',
            headers: {
                'Authorization': authHeader, 
                'Content-Type': 'application/json'
            }
        });

        // Kiểm tra lỗi từ ACCESSTRADE
        if (campaignResponse.status !== 200) {
            // Lỗi xảy ra nếu Link Affiliate bị undefined
            defaultMessage = `Lỗi ACCESSTRADE: Không thể lấy danh sách Campaigns. Code: ${campaignResponse.status}. (Kiểm tra lại API KEY)`;
            throw new Error(defaultMessage);
        }

        const campaignData = await campaignResponse.json();
        
        // --- LOGIC LỌC: TẠM THỜI NỚI LỎNG ĐỂ TEST (CHỌN TẤT CẢ) ---
        const qualifiedCampaigns = campaignData.data; 

        if (qualifiedCampaigns.length === 0) {
            defaultMessage = "Lỗi ACCESSTRADE: Không tìm thấy Chiến dịch nào để đăng.";
            throw new Error(defaultMessage);
        }

        // Chọn Campaign tốt nhất (nếu có) hoặc campaign đầu tiên
        qualifiedCampaigns.sort((a, b) => b.commission_rate - a.commission_rate);
        const campaignToPost = qualifiedCampaigns[0];
        
        const campaignName = campaignToPost.name || "Chiến dịch Đặc biệt";
        const campaignLandingPage = campaignToPost.landing_page_link; 
        
        // =======================================================
        // 2. GỌI API GEMINI TẠO NỘI DUNG (THẬT)
        // =======================================================
        generatedContent = await generatePostContent(campaignName); 
        
        // =======================================================
        // 3. TẠO LIÊN KẾT AFFILIATE CUỐI CÙNG
        // =======================================================
        finalAffiliateLink = `${campaignLandingPage}?utm_source=social&aff_id=${affiliate_id_from_sheet}`;

    } catch (error) {
        console.error("Lỗi trong xử lý Function:", error);
        
        // Dữ liệu mặc định khi xảy ra lỗi (FALLBACK)
        generatedContent = defaultMessage || "⚡ Lỗi Hệ thống: Kiểm tra lại API KEY và Netlify Logs.";
        
        // Cập nhật Link Fallback an toàn (tránh lỗi Invalid URL)
        finalAffiliateLink = "https://accesstrade.vn/"; 
    }
        
    // =======================================================
    // 4. LOGIC FIX LỖI RỖNG (FALLBACK CUỐI)
    // =======================================================
    if (!generatedContent || typeof generatedContent !== 'string' || generatedContent.trim().length < 10) {
        generatedContent = "⚡ Bài viết tự động bị lỗi tạo nội dung AI. Vui lòng kiểm tra lại cấu hình GEMINI API.";
    }

    if (!finalAffiliateLink || !finalAffiliateLink.startsWith('http')) {
        finalAffiliateLink = "https://accesstrade.vn/"; 
    }
    
    // 5. TRẢ VỀ DỮ LIỆU CHO APPS SCRIPT
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            // TÊN BIẾN MỚI ĐỒNG BỘ 100% VỚI APPS SCRIPT VÀ MAKE.COM
            verrygood_tk: generatedContent, // Post caption
            dailyai_tk: finalAffiliateLink // Link
        })
    };
};
