const fetch = require('node-fetch');

// Lấy Khóa API từ Netlify Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const ACCESSTRADE_API_KEY = process.env.ACCESSTRADE_API_KEY; 
const ACCESSTRADE_BASE_URL = 'https://api.accesstrade.vn/v1';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;


async function generatePostContent(campaignName) {
    // ... (Code gọi API Gemini giữ nguyên)
    const prompt = `Bạn là một Content Creator chuyên nghiệp. Hãy viết một bài post Facebook (tối đa 5 câu) thật hấp dẫn và kêu gọi hành động (Call To Action) cho chiến dịch affiliate: "${campaignName}". Bài viết cần sử dụng ngôn ngữ trẻ trung, có emoji và nhấn mạnh ưu đãi.`;

    // ... (Payload và Options cho Gemini)

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

exports.handler = async (event, context) => {
    // ... (Kiểm tra method POST)

    let generatedContent = "";
    let finalAffiliateLink = "";
    let defaultMessage = "";

    try {
        // ... (Xử lý data và command)

        // =======================================================
        // 1. GỌI API ACCESSTRADE & LỌC/ĐÁNH GIÁ CHIẾN DỊCH
        // =======================================================
        const campaignUrl = `${ACCESSTRADE_BASE_URL}/campaigns`;
        
        // --- FIX LỖI UỶ QUYỀN API ACCESSTRADE ---
        // Thay đổi Header từ 'Token' sang 'Bearer' để fix lỗi 401 Authorization
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
            defaultMessage = `Lỗi ACCESSTRADE: Không thể lấy danh sách Campaigns. Code: ${campaignResponse.status}. (Kiểm tra lại API KEY)`;
            throw new Error(defaultMessage);
        }

        const campaignData = await campaignResponse.json();
        
        // --- LOGIC LỌC: TẠM THỜI NỚI LỎNG ĐỂ TEST (CHỌN TẤT CẢ) ---
        // Hoặc sử dụng logic lọc của Chủ nhân nếu đã sửa lỗi:
        const qualifiedCampaigns = campaignData.data; 

        if (qualifiedCampaigns.length === 0) {
            defaultMessage = "Lỗi ACCESSTRADE: Không tìm thấy Chiến dịch nào để đăng.";
            throw new Error(defaultMessage);
        }

        // Chọn Campaign tốt nhất (hoặc campaign đầu tiên)
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
        
        // Cập nhật Link Fallback an toàn hơn để tránh lỗi Invalid URL trong Make.com
        finalAffiliateLink = "https://accesstrade.vn/"; 
    }
        
    // ... (Logic Fallback cuối)
    
    // 5. TRẢ VỀ DỮ LIỆU CHO APPS SCRIPT
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            // ĐẦU RA PHẢI KHỚP VỚI APPS SCRIPT
            content_ready_for_social: generatedContent, 
            af_link: finalAffiliateLink 
        })
    };
};
