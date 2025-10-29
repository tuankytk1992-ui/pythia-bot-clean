const fetch = require('node-fetch');

// Lấy Khóa API từ Netlify Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ACCESSTRADE_API_KEY = process.env.ACCESSTRADE_API_KEY;

// Cấu hình URL
const ACCESSTRADE_BASE_URL = 'https://api.accesstrade.vn/v1/campaigns';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;

// Cấu hình Fallback
const DEFAULT_FALLBACK_MESSAGE = '⚡ Bài viết tự động bị lỗi tạo nội dung AI. Vui lòng kiểm tra lại cấu hình API Keys (ACCESSTRADE và GEMINI) trên Netlify.';
const DEFAULT_FALLBACK_LINK = "https://accesstrade.vn"; 


/**
 * Hàm gọi API Gemini để tạo nội dung
 * @param {string} campaignName - Tên chiến dịch để tạo prompt.
 * @returns {Promise<string>} Nội dung đã tạo hoặc thông báo lỗi Fallback.
 */
async function generatePostContent(campaignName) {
    const prompt = `Bạn là một Content Creator chuyên viết bài review ngắn gọn, hấp dẫn về ${campaignName}. Viết một bài post ngắn (tối đa 256 tokens), kích thích người đọc bấm vào link affiliate.`; 
    
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { temperature: 0.8, maxOutputTokens: 256 }
    };

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const jsonResponse = await response.json();
        
        // Kiểm tra và trích xuất nội dung
        if (jsonResponse.candidates && jsonResponse.candidates[0] && jsonResponse.candidates[0].content && jsonResponse.candidates[0].content.parts) {
            return jsonResponse.candidates[0].content.parts[0].text;
        }
        return DEFAULT_FALLBACK_MESSAGE;

    } catch (error) {
        console.error("Lỗi gọi Gemini API:", error);
        return DEFAULT_FALLBACK_MESSAGE;
    }
}


/**
 * HÀM XỬ LÝ CHÍNH CỦA NETLIFY FUNCTION (FIX LỖI 502)
 * Cú pháp này thay thế cho 'function DailyFullyAutomatedNewsPost() { ... }'
 */
exports.handler = async (event, context) => { // Dòng này fix lỗi 502
    
    // 1. Kiểm tra Method POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: "Method Not Allowed" }) };
    }

    let finalAffiliateLink = DEFAULT_FALLBACK_LINK; 
    let generatedContent = DEFAULT_FALLBACK_MESSAGE;
    let command = '';
    
    try {
        const data = JSON.parse(event.body);
        command = data.command;

        if (command !== 'FULL_AUTO_POST') {
            return { statusCode: 400, body: JSON.stringify({ message: "Invalid command" }) };
        }
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ message: "Invalid JSON payload" }) };
    }
    
    // --- Bắt đầu Logic Xử lý Dữ liệu ---

    // 2. GỌI API ACCESSTRADE ĐỂ LẤY CAMPAIGN
    try {
        const authHeader = `Bearer ${ACCESSTRADE_API_KEY}`; 
        
        const campaignResponse = await fetch(`${ACCESSTRADE_BASE_URL}?approval=successful`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });
        
        if (campaignResponse.status !== 200) {
            console.error(`Lỗi ACCESSTRADE API: Code ${campaignResponse.status}`);
            // Tiếp tục với logic Fallback
        } else {
            const campaignData = await campaignResponse.json();
            
            // Logic lọc campaign
            const qualifiedCampaigns = campaignData.data.sort((a, b) => b.commission_rate - a.commission_rate);
            
            if (qualifiedCampaigns.length > 0) {
                const campaignToPost = qualifiedCampaigns[0]; 
                finalAffiliateLink = campaignToPost.campaign_landing_page; 

                // 3. GỌI API GEMINI TẠO NỘI DUNG
                generatedContent = await generatePostContent(campaignToPost.campaign_name);
            }
        }

    } catch (error) {
        console.error("Lỗi chính trong Logic:", error);
        finalAffiliateLink = DEFAULT_FALLBACK_LINK; 
        generatedContent = DEFAULT_FALLBACK_MESSAGE;
    }
    
    // --- Đảm bảo Dữ liệu Luôn Hợp Lệ ---
    if (!generatedContent || typeof generatedContent !== 'string' || generatedContent.length < 10) {
        generatedContent = DEFAULT_FALLBACK_MESSAGE;
    }
    
    if (!finalAffiliateLink || finalAffiliateLink.includes('undefined')) {
        finalAffiliateLink = DEFAULT_FALLBACK_LINK;
    }

    // 4. TRẢ VỀ DỮ LIỆU CHO APPS SCRIPT
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            verrygood_tk: generatedContent, // Tên mới: Nội dung
            dailyai_tk: finalAffiliateLink // Tên mới: Link
        })
    };
};
