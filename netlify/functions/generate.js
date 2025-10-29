        // =======================================================
        // 1. GỌI API ACCESSTRADE & LỌC/ĐÁNH GIÁ CHIẾN DỊCH
        // =======================================================
        const campaignUrl = `${ACCESSTRADE_BASE_URL}/campaigns`;
        
        // --- ĐÂY LÀ ĐOẠN CODE ĐƯỢC CHỈNH SỬA ---
        // Thay đổi từ 'Token' sang 'Bearer' để fix lỗi ủy quyền API
        const authHeader = `Bearer ${ACCESSTRADE_API_KEY}`; 
        
        const campaignResponse = await fetch(campaignUrl, {
            method: 'GET',
            headers: {
                'Authorization': authHeader, // Sử dụng Header đã thay đổi
                'Content-Type': 'application/json'
            }
        });
// ... (các phần code khác giữ nguyên)
