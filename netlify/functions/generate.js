/**
 * Dữ liệu Hằng số (Constants)
 * URL Webhook đã được cập nhật
 */
const NETLIFY_GENERATE_URL = "https://pythia-bot-clean-final.netlify.app/.netlify/functions/generate";
const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/5bg2d7a6coda07lulgo2jh9ksgtce1e2"; 
const AFFILIATE_ID = "T07107509"; 

/**
 * Hàm chính thực hiện toàn bộ quy trình tự động hóa.
 */
function DailyFullyAutomatedNewsPost() {
  
  try {
    const netlifyPayload = JSON.stringify({
      command: "FULL_AUTO_POST",
      affiliate_id: AFFILIATE_ID
    });

    const netlifyOptions = {
      method: 'post',
      contentType: 'application/json',
      payload: netlifyPayload,
      muteHttpExceptions: true
    };

    // 1. GỌI NETLIFY FUNCTION
    const netlifyResponse = UrlFetchApp.fetch(NETLIFY_GENERATE_URL, netlifyOptions);
    const responseCode = netlifyResponse.getResponseCode();
    Logger.log(`Thông tin Netlify Response Code: ${responseCode}`);
    
    // 2. XỬ LÝ PHẢN HỒI NETLIFY
    if (responseCode === 200) {
      const data = JSON.parse(netlifyResponse.getContentText());
      
      // ĐỒNG BỘ TÊN BIẾN MỚI
      const makePayload = JSON.stringify({
          dailyai_tk: data.dailyai_tk,    // Link
          verrygood_tk: data.verrygood_tk // Post Caption
      });

      const makeOptions = {
        method: 'post',
        contentType: 'application/json',
        payload: makePayload,
        muteHttpExceptions: true
      };
      
      // 3. GỌI MAKE.COM WEBHOOK
      const makeResponse = UrlFetchApp.fetch(MAKE_WEBHOOK_URL, makeOptions);
      const makeResponseCode = makeResponse.getResponseCode();
      
      Logger.log(`Thông tin Make.com Response Code: ${makeResponseCode}`);
      
      if (makeResponseCode >= 200 && makeResponseCode < 300) {
         Logger.log("Đã hoàn tất quá trình thực thi thành công.");
      } else {
         Logger.log(`Lỗi khi gọi Make.com: Code ${makeResponseCode}, Nội dung: ${makeResponse.getContentText()}`);
      }
      
    } else {
      Logger.log("Lỗi: Không nhận được phản hồi 200 từ Netlify Function.");
    }
    
  } catch(e) {
    Logger.log(`Lỗi nghiêm trọng trong quá trình thực thi: ${e}`);
  }
}
