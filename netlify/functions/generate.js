// Sử dụng Node-Fetch để gọi API bên ngoài
const fetch = require('node-fetch');

// Lấy Khóa API từ Netlify Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const ACCESSTRADE_API_KEY = process.env.ACCESSTRADE_API_KEY; 

// Endpoint API ACCESSTRADE (Base URL)
const ACCESSTRADE_BASE_URL = 'https://api.accesstrade.vn/v1';

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
        // Dữ liệu đầu vào: Affiliate ID từ Apps Script
        const affiliate_id_from_sheet = data.affiliate_id; 

        if (command !== 'FULL_AUTO_POST') {
             return { statusCode: 400, body: JSON.stringify({ message: "Invalid command." }) };
        }

        // =======================================================
        // 1. GỌI API ACCESSTRADE & LỌC/ĐÁNH GIÁ CHIẾN DỊCH
        // =======================================================
        const campaignUrl = `${ACCESSTRADE_BASE_URL}/campaigns`;
        const authHeader = `Token ${ACCESSTRADE_API_KEY}`;
        
        const campaignResponse = await fetch(campaignUrl, {
            method: 'GET',
            headers: {
                'Authorization': authHeader, 
                'Content-Type': 'application/json'
            }
        });

        if (campaignResponse.status !== 200) {
            defaultMessage = `Lỗi ACCESSTRADE: Không thể lấy danh sách Campaigns. Code: ${campaignResponse.status}`;
            throw new Error(defaultMessage);
        }

        const campaignData = await campaignResponse.json();
        
        // --- LOGIC LỌC TỐI ƯU ---
        const qualifiedCampaigns = campaignData.data.filter(c => 
            // Tiêu chí lọc:
            c.name.includes("Shopee") || // Luôn ưu tiên Shopee
            (
                // HOẶC (Hoa hồng từ 5% trở lên VÀ Chuyển đổi từ 1% trở lên)
                c.commission_rate >= 0.05 && 
                c.conversion_rate >= 0.01 
            )
        );

        if (qualifiedCampaigns.length === 0) {
            defaultMessage = "Lỗi ACCESSTRADE: Không tìm thấy Chiến dịch nào thỏa mãn tiêu chí khả thi.";
            throw new Error(defaultMessage);
        }

        // Sắp xếp theo Tỷ lệ Hoa hồng giảm dần
        qualifiedCampaigns.sort((a, b) => b.commission_rate - a.commission_rate);

        // Chọn Campaign tốt nhất (campaign đầu tiên)
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
        // Dữ liệu đầu vào: Landing Page từ ACCESSTRADE + Affiliate ID từ Apps Script
        finalAffiliateLink = `${campaignLandingPage}?utm_source=social&aff_id=${affiliate_id_from_sheet}`;

    } catch (error) {
        console.error("Lỗi trong xử lý Function:", error);
        
        // Dữ liệu mặc định khi xảy ra lỗi (FALLBACK)
        generatedContent = defaultMessage || "⚡ Lỗi Hệ thống: Không thể tạo nội dung/lấy dữ liệu. Kiểm tra Netlify Logs.";
        finalAffiliateLink = "https://www.facebook.com/luuquynhtrang"; 
    }
        
    // =======================================================
    // 4. LOGIC FIX LỖI 400 (FALLBACK CUỐI)
    // =======================================================
    if (!generatedContent || typeof generatedContent !== 'string' || generatedContent.trim().length < 10) {
        generatedContent = "⚡ Bài viết tự động bị lỗi tạo nội dung AI. Vui lòng kiểm tra lại cấu hình GEMINI API.";
    }

    if (!finalAffiliateLink) {
        finalAffiliateLink = "https://www.facebook.com/luuquynhtrang"; 
    }
    
    // 5. TRẢ VỀ DỮ LIỆU CHO APPS SCRIPT (VÀ MAKE.COM)
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            // Các key này phải khớp với Make.com
            content_ready_for_social: generatedContent, 
            af_link: finalAffiliateLink // Link Affiliate
        })
    };
};
