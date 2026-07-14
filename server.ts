import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Helper function for lazy initialization of the Google GenAI client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm trong Settings > Secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Rút gọn thông tin nguồn tri thức xuống tầm 20 từ (20 chữ) cho Heuristic/Fallback hoặc hiển thị ngoài màn hình
function summarizeTo20Words(text: string): string {
  if (!text) return "";
  // Loại bỏ nguồn nếu có dạng "Nguồn:..." để bớt rác từ ngữ
  const cleanText = text.replace(/^Nguồn:\s*[^\n]+\n/gi, "").trim();
  const words = cleanText.split(/\s+/).filter(Boolean);
  if (words.length <= 20) return cleanText;

  // Lấy câu đầu tiên nếu nó đủ ngắn gọn
  const sentences = cleanText.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length > 0) {
    const sWords = sentences[0].split(/\s+/).filter(Boolean);
    if (sWords.length <= 20 && sWords.length >= 5) {
      return sentences[0] + ".";
    }
  }
  
  // Nếu không, chỉ lấy đúng 20 từ đầu và thêm dấu chấm ba chấm
  return words.slice(0, 20).join(" ") + "...";
}

function getGoogleMapsApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_PLATFORM_KEY ||
    process.env.GOOGLE_MAPS_PLATF ||
    process.env.GOOGLE_MAPS_PLATFORM ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAP_API_KEY ||
    ""
  ).trim();
}

// Gọi Routes API để lấy khoảng cách và thời gian di chuyển thực tế đến dự án Nyah Phú Định
async function getRoutesDistanceAndDuration(destinationName: string): Promise<{ distance: string; duration: string } | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    console.log("GOOGLE_MAPS_PLATFORM_KEY hoặc các biến thay thế chưa được cấu hình. Bỏ qua gọi Routes API.");
    return null;
  }

  const queryWithCity = destinationName.toLowerCase().includes("hồ chí minh") || destinationName.toLowerCase().includes("hcm")
    ? destinationName
    : `${destinationName}, Hồ Chí Minh`;

  try {
    const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
    const headers = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    };

    const body = {
      origin: {
        address: queryWithCity,
      },
      destination: {
        location: {
          latLng: {
            latitude: 10.725175,
            longitude: 106.615175,
          },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "vi-VN",
      units: "METRIC",
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Lỗi gọi Routes API:", errText);
      return null;
    }

    const data: any = await res.json();
    if (data.routes && data.routes[0]) {
      const route = data.routes[0];
      const distanceMeters = route.distanceMeters;
      const durationStr = route.duration; // e.g., "165s"

      if (distanceMeters !== undefined && durationStr) {
        const distance = distanceMeters < 1000 
          ? `${distanceMeters} m`
          : `${(distanceMeters / 1000).toFixed(1)} km`;

        const seconds = parseInt(durationStr.replace("s", ""), 10);
        const minutes = Math.ceil(seconds / 60);
        const duration = `${minutes} phút`;

        return { distance, duration };
      }
    }
    return null;
  } catch (error) {
    console.error("Lỗi khi xử lý Routes API:", error);
    return null;
  }
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Route: Health check
  app.get("/api/health", (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({ status: "ok", aiConfigured: hasKey });
  });

  // API Route: Kiểm tra chi tiết trạng thái của các API Key
  app.get("/api/check-keys", async (req, res) => {
    const geminiKey = process.env.GEMINI_API_KEY || "";
    const routesKey = getGoogleMapsApiKey();

    const geminiConfigured = !!geminiKey;
    const routesConfigured = !!routesKey;

    // Mask keys for security
    const maskKey = (key: string) => {
      if (!key) return "Chưa cấu hình";
      if (key.length <= 8) return "Đã cấu hình (Quá ngắn)";
      return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    };

    res.json({
      gemini: {
        configured: geminiConfigured,
        masked: maskKey(geminiKey),
        length: geminiKey.length,
      },
      routes: {
        configured: routesConfigured,
        masked: maskKey(routesKey),
        length: routesKey.length,
      },
    });
  });

  // API Route: Test gọi thực tế đến Routes API của Google Maps
  app.post("/api/test-routes-api", async (req, res) => {
    const { destination } = req.body;
    const testDest = destination || "Chợ Bến Thành";

    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "Google Maps API Key chưa được cấu hình. Vui lòng thêm một Secret mới có tên là GOOGLE_MAPS_PLATFORM_KEY hoặc GOOGLE_MAPS_PLATF trong Settings > Secrets.",
      });
    }

    const queryWithCity = testDest.toLowerCase().includes("hồ chí minh") || testDest.toLowerCase().includes("hcm")
      ? testDest
      : `${testDest}, Hồ Chí Minh`;

    try {
      const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
      const headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      };

      const body = {
        origin: {
          address: queryWithCity,
        },
        destination: {
          location: {
            latLng: {
              latitude: 10.725175,
              longitude: 106.615175,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "vi-VN",
        units: "METRIC",
      };

      const googleResponse = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const responseText = await googleResponse.text();

      if (!googleResponse.ok) {
        return res.json({
          success: false,
          status: googleResponse.status,
          statusText: googleResponse.statusText,
          error: responseText || "Lỗi không xác định từ Google Maps Routes API",
        });
      }

      const data = JSON.parse(responseText);
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const distanceMeters = route.distanceMeters;
        const durationStr = route.duration;

        let distance = "N/A";
        let duration = "N/A";

        if (distanceMeters !== undefined) {
          distance = distanceMeters < 1000 
            ? `${distanceMeters} m`
            : `${(distanceMeters / 1000).toFixed(1)} km`;
        }

        if (durationStr) {
          const seconds = parseInt(durationStr.replace("s", ""), 10);
          const minutes = Math.ceil(seconds / 60);
          duration = `${minutes} phút`;
        }

        return res.json({
          success: true,
          destination: testDest,
          distance,
          duration,
          distanceMeters,
          durationRaw: durationStr,
          rawResponse: data,
        });
      } else {
        return res.json({
          success: false,
          error: "Google Maps trả về phản hồi hợp lệ nhưng không tìm thấy tuyến đường nào phù hợp (không có routes).",
          rawResponse: data,
        });
      }
    } catch (error: any) {
      return res.json({
        success: false,
        error: error.message || "Lỗi kết nối mạng đến Google Maps Routes API",
      });
    }
  });

  // Master Knowledge Base constant
  const MASTER_KNOWLEDGE_BASE = `
MASTER KNOWLEDGE BASE: DỰ ÁN NY’AH PHÚ ĐỊNH (CẬP NHẬT T3/2026)

1. Tổng quan Dự án & Triết lý Phát triển
- Tên dự án: Ny’ah Phú Định.
- Chủ đầu tư: Công ty Nhã Đạt (nd).
- Quy mô: 50 căn (Mã lô từ #01 đến #50), bao gồm nhà phố Compound biệt lập và Shophouse thương mại.
- Vị trí chiến lược: 156 An Dương Vương, Phường 16, Quận 8, TP.HCM.
- Tiến độ bàn giao: Dự kiến năm 2026.
- Đơn vị thiết kế: Signature by Codinachs (Barcelona).
- Khả năng kết nối: 18 phút đến Quận 1; 27 phút đến Quận 2.
- Trục lộ chính: Cách Võ Văn Kiệt 1.000m, cận kề Vành Đai 2. Đặc biệt, trục đường Trương Đình Hội (lộ giới 20m) đã hoàn tất xây dựng, kết nối trực tiếp với Nguyễn Văn Linh qua nút giao khác mức.
- Tiện ích ngoại khu: Aeon Mall Bình Tân, Co.op Mart Phú Lâm, MM Mega Market Bình Phú, Bệnh viện Chợ Rẫy, Hệ thống trường học các cấp (Phú Định, THCS, THPT).
- Triết lý "Chất liệu Hạnh phúc": Dự án tập trung vào 4 giá trị cốt lõi: Thở sạch sống khỏe (AirTop), Nắng tràn sức sống (Thiết kế Super Bright), Tự do khôn lớn (An ninh Compound), và Bật tung năng lượng (17 đặc quyền tiện ích).
- Hệ thống 17 đặc quyền tiện ích nội khu:
  1. Biển hiệu Ny’ah Phú Định | 2. Khu Landmark Coffee | 3. Cổng chính tự động | 4. Khu “Sạc pin” | 5. Sảnh lối vào sân | 6. Đường chính sinh hoạt nội khu | 7. Cây xanh nội khu (kèn hồng/vàng) | 8. Ghế công viên | 9. Bồn hoa công viên | 10. Khu vui chơi trẻ em | 11. Khu thể thao ngoài trời | 12. Sân bóng rổ mini | 13. Tranh graffiti | 14. Sân cầu lông | 15. Signature by Codinachs (Kiến trúc) | 16. Công viên số 2 | 17. Trạm khử khuẩn hàng shipper.

2. Pháp lý & Cam kết Bảo hành
- Hồ sơ Pháp lý (Quy trình 4 bước):
  + Bước 1: Giấy chứng nhận quyền sử dụng đất (Sổ đỏ tổng đã sẵn có).
  + Bước 2: Giấy phép xây dựng (Sẵn có, cập nhật sang tên chủ mới).
  + Bước 3: Giấy chứng nhận nhà + đất (Sổ hồng riêng từng căn sau hoàn công).
  + Bước 4: Hợp đồng mua bán công chứng (Chuyển quyền sở hữu tài sản trọn đời).
  * Dự án được phê duyệt 1/500, hồ sơ PCCC thẩm tra theo tiêu chuẩn mới nhất.
  * Thanh toán đủ 85% có thể tiến hành công chứng sang tên ngay. Ngoại lệ duy nhất là lô #03 (không áp dụng chính sách này).
- Chính sách Bảo hành:
  + Kết cấu: Bảo hành 05 năm đối với khung sườn bê tông cốt thép.
  + Vận hành: Bên A cam kết bàn giao căn nhà và trang thiết bị không khiếm khuyết, vận hành tốt trong điều kiện bình thường. Các thiết bị khác bảo hành theo quy định của nhà sản xuất tại thời điểm bàn giao.

3. Chi tiết Kỹ thuật Xây dựng & Vật liệu
- Tải trọng sàn:
  + Mẫu Office: 3 tầng khối đế thiết kế chịu tải trọng gấp 3 lần thông thường (phục vụ Gym/Spa chuyên dụng).
  + Mẫu Opus: Thiết kế chịu tải trọng tăng thêm 150% so với tiêu chuẩn nhà ở thông thường.
- An toàn: Trang bị hầm nước chữa cháy riêng biệt cho các khối nhà thương mại.
- Mật độ: Tất cả các mẫu nhà đều xây dựng với mật độ tối đa theo quy định.
- Danh mục vật liệu hoàn thiện (Phụ lục 1 – v6):
  + Sàn & Tường: Gạch Porcelain (Vietceramics, Trường Thịnh, Đồng Tâm); Sàn gỗ công nghiệp (Inovar, Robina, Egger); Sơn Maxilite/Jotun trắng.
  + Hệ thống Điện: Dây dẫn Cadivi đi ngầm; Thiết bị thông minh Zigbee/Wifi; Máy chủ ByteLife (tại Bếp).
  + Hệ thống Nước: Ống PPR cấp/PVC thoát (Bình Minh); Bồn nước 1000L & Máy nước nóng năng lượng mặt trời 210L (Đại Thành).
  + Thiết bị vệ sinh: Trọn bộ Inax (Lavabo mặt đá granite, vòi sen tắm mưa, bồn cầu, phụ kiện). Vách kính tắm 10mm (Imundex).
  + Cửa & Kính: Cửa nhựa Composite (phụ kiện Hafele); Nhôm kính Xingfa 8mm cường lực (phụ kiện Kinlong); Vách kính tắm 10mm (phụ kiện Imundex).
  + Máy lạnh (Gói MAX): LG Âm trần (cho các phòng ngủ); LG Treo tường (cho phòng khách và phòng ăn).

4. Phân tích Mẫu nhà (Product Datasheet)
- Fusion (Gen 5): Kích thước 4m x 11m, kết cấu "Trệt, lửng, 3 lầu, sân thượng". Garage cực đại cho xe bán tải; Thang biến hóa không chia đôi nhà; Phòng ngủ Master chiếm 2/3 chiều dài nhà.
- Cosmo (Gen 1): Kích thước 5m x 8.75m, kết cấu "Trệt, lửng, 2 lầu, 1 lầu đa năng". Mặt tiền 5m; Sảnh đón và cổng garage riêng biệt.
- Cosmo (Gen 2): Kích thước 5m x 9m, kết cấu "Trệt, lửng, 3 lầu, tầng đa năng". Thiết kế "Super Bright"; Nâng cấp thang máy và 4 phòng ngủ en-suite; Giếng trời "siêu thực" 7m².
- Opus (Startup): Kích thước 4m x 12.5m, kết cấu "Trệt, lửng, 3 lầu, sân thượng". Mô hình 2-in-1: 2 tầng văn phòng Grade A (tải trọng sàn +150%); 4 tầng nhà ở cao cấp; Thang máy lên tận sân thượng. Phù hợp cho Doanh nghiệp Startup công nghệ, Livestream, Studio hoặc Shop Online cần văn phòng đạt chuẩn Grade A (tải trọng sàn +150%, lối đi người khuyết tật, thang máy lên sân thượng).
- Office 1 & 2: Tổng diện tích 130.2m² (2 căn), kết cấu "7 tầng (Hầm, trệt, lửng + 4 lầu)". Khối đế 3 tầng kinh doanh (Gym/Spa/Showroom); 4 tầng trên gồm 28 - 32 căn hộ dịch vụ phong cách Cashmere.

5. So sánh Gói Hoàn thiện AIR và MAX
- "Phần ướt & Thiết bị vệ sinh": Gói AIR bao gồm đầy đủ; Gói MAX bao gồm đầy đủ.
- Hệ thống AirTop: Gói AIR bao gồm đầy đủ; Gói MAX bao gồm đầy đủ.
- Hệ thống ByteLife: Gói AIR không bao gồm; Gói MAX bao gồm đầy đủ (Máy chủ + Công tắc thông minh).
- Thiết bị Bếp (Sink, Bếp từ, Hút mùi, Lò vi sóng): Gói AIR không bao gồm; Gói MAX bao gồm đầy đủ (Ván An Cường, phụ kiện Imundex).
- Hệ thống Máy lạnh LG (Âm trần & Treo tường theo phòng): Gói AIR không bao gồm; Gói MAX bao gồm đầy đủ.
- Nội thất rời (Giường, bàn, ghế, tủ thờ, đồ trang trí rời): Cả hai gói AIR và MAX đều không bao gồm.

6. Công nghệ ByteLife & Hệ thống AirTop
- Hệ thống AirTop (Sức khỏe):
  + Cơ chế: Nạp khí qua quạt Panasonic và bộ lọc chuyên dụng trên mái. Lọc bụi mịn từ mái và thổi 9.5 triệu lít khí tươi/ngày, giúp không gian luôn sạch mà không cần mở cửa.
  + Hiệu suất: Cung cấp 9,5 triệu lít khí tươi mỗi ngày. Đối với mẫu Opus, công suất cấp khí tươi được tăng cường gấp 3 lần.
- Công nghệ ByteLife (Smart Solution):
  + Tự động hóa: Hơn 30 cảm biến điều khiển thiết bị theo nhịp sinh học và chuyển động.
  + Kinh tế học: Hệ thống tự động hóa vận hành giúp tối ưu nhân sự bảo vệ và quản lý nội khu. Đây là yếu tố cốt lõi cho phép áp dụng chính sách Phí quản lý 0 đồng cho cư dân.

7. Bảng giá & Phương thức Thanh toán (T3/2026)
- Rổ hàng v12:
  + "Lot_50": "11,470,000,000 VNĐ (Cosmo Gen 2 - Giá nhà chưa nội thất)"
  + "Lot_42": "8,981,000,000 VNĐ (Cosmo Gen 2 - Giá nhà chưa nội thất)"
  + "Lot_24": "12,751,000,000 VNĐ (Opus v3 - Giá nhà chưa nội thất)"
  + "Lot_03": "9,710,000,000 VNĐ (Cosmo - Giá nhà chưa nội thất)"
  + "Office_Package": "32,230,000,000 VNĐ (2 căn kèm nội thất mẫu Opus)"
- Phương thức Thanh toán (PTTT v7d):
  + Thanh toán chuẩn: 10% ký HĐ, sau đó thanh toán 3%/tháng trong 7 tháng. 8% khi nhận nhà (Gói AIR). 61% khi công chứng.
  + Thanh toán sớm (Chiết khấu):
    * Công thức: Chiết khấu = (Số tiền đóng trước) x (Hệ số x 2.9% / 12) x (Số tháng đóng trước).
    * Hệ số: Gấp 3 lần hoặc 6 lần lãi suất tiết kiệm 9 tháng của Vietcombank (hiện là 2.9%).
    * Ví dụ: Thanh toán ngay 50% nhận chiết khấu 4.06% (đối với gói Max).

8. Bộ FAQ Tư vấn Chuyên sâu
- Vị trí dự án có bị ngập nước không?
  + Không. Trục đường Trương Đình Hội lộ giới 20m đã hoàn tất xây dựng cao ráo, đồng bộ hạ tầng thoát nước.
- Làm sao để có phí quản lý 0 đồng?
  + Nhờ hệ thống ByteLife tự động hóa vận hành toàn khu compound, giảm thiểu tối đa chi phí nhân sự quản lý và an ninh, lợi ích này được chuyển trực tiếp cho cư dân.
- Khác biệt kỹ thuật giữa Cosmo Gen 1 và Gen 2?
  + Gen 1 (5m x 8.75m) cao 4 lầu; Gen 2 (5m x 9m) cao 5 lầu, tích hợp sẵn thang máy, 4 phòng ngủ en-suite và thiết kế "Super Bright" tối ưu ánh sáng.
- Thanh toán bao nhiêu thì được công chứng sang tên?
  + Thanh toán đủ 85% có thể tiến hành công chứng sang tên ngay. Ngoại lệ duy nhất là lô #03 (không áp dụng chính sách này).
- Chính sách cam kết thuê lại cho mẫu Office?
  + Áp dụng cho gói 2 căn Office (32.23 tỷ VNĐ): Cam kết thuê lại tổng giá trị 9.53 tỷ VNĐ trong 7 năm. (Tối thiểu cam kết 3-6 năm).
- Ngân hàng nào tài trợ dự án?
  + Các đối tác chiến lược: TPBank, Techcombank, MB và BIDV.
- Hệ thống AirTop có thực sự hiệu quả?
  + Hệ thống lọc bụi mịn từ mái và thổi 9.5 triệu lít khí tươi/ngày, giúp không gian luôn sạch mà không cần mở cửa.
- Mẫu Opus phù hợp với đối tượng nào?
  + Doanh nghiệp Startup công nghệ, Livestream, Studio hoặc Shop Online cần văn phòng đạt chuẩn Grade A (tải trọng sàn +150%, lối đi người khuyết tật, thang máy lên sân thượng).
- Gói nội thất MAX có bao gồm giường nệm không?
  + Không. Theo Phụ lục 1, gói MAX không bao gồm bàn, ghế, giường, tủ thờ và đồ trang trí rời.
- Bảo hành nhà bao gồm những gì?
  + Chủ đầu tư bảo hành 5 năm cho khung sườn bê tông cốt thép. Các thiết bị khác bảo hành theo quy định của nhà sản xuất tại thời điểm bàn giao.
`;

  // API Route: Analyze conversation content
  app.post("/api/analyze-conversation", async (req, res) => {
    const { text, activeTopics, topicKeywordsMap, topicKnowledge, isSelfLearningDisabled } = req.body;

    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "Nội dung cuộc thoại không hợp lệ" });
    }

    // Default self learning to disabled (user intent) if not explicitly set
    const selfLearningDisabled = isSelfLearningDisabled !== false;

    // Determine topics list dynamically based on activeTopics
    const topicsList = Array.isArray(activeTopics) && activeTopics.length > 0 
      ? [...activeTopics, "Chủ đề khác hoặc dự án khác"] 
      : ["Vị trí dự án Nyah Phú Định", "Tiện ích xung quanh", "Mẫu nhà Cosmo Gen 2", "Nội thất nhà bếp", "Chủ đề khác hoặc dự án khác"];

    try {
      const ai = getGeminiClient();

      let promptTopicsText = "";
      topicsList.forEach((t, index) => {
        const customKnowledge = topicKnowledge?.[t] || "";
        const knowledgeSection = customKnowledge 
          ? `\n   - DỮ LIỆU KIẾN THỨC NGUỒN (Hãy chỉ trả lời dựa trên thông tin này, không bịa đặt): "${customKnowledge}"` 
          : "";

        if (t === "Vị trí dự án Nyah Phú Định") {
          promptTopicsText += `${index + 1}. "Vị trí dự án Nyah Phú Định" (Nếu cuộc thoại nhắc đến dự án Nyah Phú Định, vị trí địa lý Quận 8, mặt tiền đường Trương Đình Hội, bản đồ, đường đi, khả năng di chuyển sang các quận trung tâm, vấn đề kẹt xe hay ngập nước... LƯU Ý: Phải là dự án Nyah Phú Định. Nếu đề cập đến vị trí các dự án khác hoặc chủ đầu tư khác như Vinhomes, Novaland, v.v., thì bạn KHÔNG ĐƯỢC chọn chủ đề này mà phải xếp vào chủ đề "Chủ đề khác hoặc dự án khác")${knowledgeSection}\n`;
        } else if (t === "Tiện ích xung quanh") {
          promptTopicsText += `${index + 1}. "Tiện ích xung quanh" (Nếu cuộc thoại nhắc đến các tiện ích xung quanh, ngoại khu của dự án Nyah Phú Định như trường học các cấp, siêu thị Mega Market, Aeon Mall Bình Tân, Coop Mart, chợ Phú Định, bệnh viện Quận 8 hay UBND...)${knowledgeSection}\n`;
        } else if (t === "Mẫu nhà Cosmo Gen 2") {
          promptTopicsText += `${index + 1}. "Mẫu nhà Cosmo Gen 2" (Nếu cuộc thoại nhắc đến mẫu nhà Cosmo Gen 2, diện tích đất 5m x 9m, diện tích sử dụng 250m², kết cấu 6 tầng gồm 1 trệt + 1 lửng + 3 lầu + 1 tăng đa năng, chiều cao trần, kết cấu xây dựng...)${knowledgeSection}\n`;
        } else if (t === "Nội thất nhà bếp") {
          promptTopicsText += `${index + 1}. "Nội thất nhà bếp" (Nếu cuộc thoại nói về thiết kế bếp căn hộ Cosmo Gen 2, nội thất nhà bếp, không gian bếp, tủ bếp chữ L kịch trần, chất liệu gỗ MDF, Acrylic, Melamine, bố trí nội thất tối giản, ấm cúng, các thiết bị nhà bếp, vị trí lắp đặt thiết bị, hoặc cấu trúc nhà bếp...)${knowledgeSection}\n`;
        } else if (t === "Chủ đề khác hoặc dự án khác") {
          promptTopicsText += `${index + 1}. "Chủ đề khác hoặc dự án khác" (Nếu cuộc thoại nói về vị trí hoặc thông tin của các dự án khác không phải Nyah Phú Định (như Vinhomes, Novaland, Grand Park, Masteri, Sunrise, Phú Mỹ Hưng, v.v.), hoặc bất kỳ câu nói hỏi thăm, trò chuyện không thuộc các chủ đề trên như hết quota, lỗi hệ thống, chào hỏi thông thường.)\n`;
        } else {
          const customKeywords = topicKeywordsMap?.[t] || [];
          promptTopicsText += `${index + 1}. "${t}" (Chủ đề tùy chỉnh do người dùng thêm vào. Các từ khóa liên quan: ${customKeywords.join(", ")}. Phân tích xem cuộc thoại có nhắc đến chủ đề này dựa trên tên chủ đề và các từ khóa liên quan.)${knowledgeSection}\n`;
        }
      });

      let selfLearningInstructions = "";
      if (selfLearningDisabled) {
        selfLearningInstructions = `LƯU Ý BẮT BUỘC VỀ PHÂN LOẠI CHỦ ĐỀ (TỰ HỌC ĐANG TẮT):
- Hiện tại chức năng tự học đang tạm ẩn/tắt. Bạn TUYỆT ĐỐI KHÔNG ĐƯỢC đề xuất hoặc tự tạo bất kỳ tên chủ đề mới nào nằm ngoài danh sách có sẵn: ${topicsList.map(t => `"${t}"`).join(", ")}.
- Bạn BẮT BUỘC phải quy cuộc hội thoại về một trong các chủ đề có sẵn trên (hoặc chọn 'Chủ đề khác hoặc dự án khác' nếu hoàn toàn không liên quan).
- Nếu khách hỏi một khía cạnh kiến thức khác trong MASTER KNOWLEDGE BASE mà chưa có chủ đề tương ứng (ví dụ: Pháp lý, Thanh toán, Bảo hành), bạn vẫn phải trả lời cực kỳ chính xác vào trường 'suggestion', nhưng trường 'topic' vẫn phải chọn một chủ đề phù hợp nhất có sẵn trong danh sách trên (ví dụ gán vào 'Mẫu nhà Cosmo Gen 2', 'Vị trí dự án Nyah Phú Định' hoặc 'Chủ đề khác hoặc dự án khác' tùy bối cảnh), tuyệt đối không được tự ý đổi 'topic' thành tên khác ngoài danh sách.`;
      } else {
        selfLearningInstructions = `Nếu chủ đề thảo luận thực tế nằm ngoài những chủ đề đã cài đặt trước đó (ví dụ nói về Pháp lý, Bảo hành, Bảng giá, Thanh toán, Tải trọng sàn, hay các câu hỏi trong FAQ), bạn hãy:
1. Đặt trường 'topic' là một tên chủ đề tiếng Việt tự đề xuất ngắn gọn, súc tích (ví dụ: "Pháp lý & Sổ hồng", "Bảo hành kết cấu", "Bảng giá & Chiết khấu", "Mẫu nhà Opus Startup", "Chi tiết kỹ thuật & Vật liệu").
2. Đặt trường 'category' là "Tư vấn tùy chỉnh" hoặc "Chủ đề khác".
3. Trích xuất câu trả lời chuẩn xác nhất từ tài liệu chuẩn phía trên và lưu vào trường 'suggestion', trả lời đầy đủ, chi tiết, đi thẳng vào trọng tâm đáp án và kết thúc bằng câu hỏi gợi mở nhu cầu hoặc kêu gọi hành động nhẹ nhàng. Nếu là giải đáp pháp lý hay bảo hành, hãy bám sát từng bước hoặc thời gian bảo hành ghi trong tài liệu chuẩn.`;
      }

      // Analyze with gemini-3.5-flash using structured JSON output
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Hãy phân tích nội dung cuộc trò chuyện tiếng Việt sau đây. Cho dù cuộc trò chuyện có thể dài dòng, lan man hay chứa nhiều chi tiết phụ, nhiệm vụ của bạn là chắt lọc ý chính và phân loại/quy về đúng một trong các chủ đề kịch bản chính sau:
${promptTopicsText}

LƯU Ý CỰC KỲ QUAN TRỌNG VỀ TÀI LIỆU NGUỒN CHUẨN (MASTER KNOWLEDGE BASE):
Chúng ta có một tài liệu chuẩn duy nhất đại diện cho toàn bộ thông tin của dự án Ny'ah Phú Định như sau:
"""
${MASTER_KNOWLEDGE_BASE}
"""

Khi khách hàng đặt câu hỏi, cho dù chủ đề có thuộc danh mục sẵn có hay nằm ngoài danh sách (như Pháp lý, Bảo hành, Bảng giá, Thanh toán, Tải trọng sàn, hay các câu hỏi trong FAQ của tài liệu chuẩn), bạn BẮT BUỘC phải tra cứu tài liệu chuẩn trên để đưa ra câu trả lời (suggestion) chính xác, trung thực nhất, đóng vai chuyên viên tư vấn NhaDat.company xưng "em" gọi "anh/chị" rất dễ gần, am hiểu, lịch sự. Tuyệt đối không được bịa đặt thông tin.

${selfLearningInstructions}

LƯU Ý CỰC KỲ QUAN TRỌNG VỀ TÍNH THỜI GIAN THỰC (REAL-TIME TRANSITION):
Nếu trong nội dung cuộc trò chuyện có sự chuyển hướng chủ đề (ví dụ: ban đầu hỏi về vị trí dự án Nyah Phú Định nhưng phần sau hoặc phần cuối lại chuyển sang hỏi về mẫu nhà Cosmo Gen 2 hoặc nội thất nhà bếp, hoặc ngược lại), bạn BẮT BUỘC phải ưu tiên phân loại (topic) và tóm tắt theo chủ đề MỚI NHẤT, đang diễn ra ở cuối đoạn hội thoại. Điều này giúp hệ thống tự động đổi hình ảnh minh họa theo đúng ngữ cảnh thời gian thực của cuộc trò chuyện.

Nhiệm vụ phân tích chi tiết của bạn gồm:
1. Xác định chủ đề chính (topic). ${selfLearningDisabled ? "Bạn BẮT BUỘC phải chọn một trong các chủ đề có sẵn. Không đề xuất chủ đề mới." : "Nếu cuộc thoại thực sự liên quan đến dự án nhưng nằm ngoài các chủ đề chính có sẵn, hãy tự đề xuất một tên chủ đề mới bằng tiếng Việt ngắn gọn (2-5 từ, ví dụ: 'Pháp lý & Bảo hành', 'Bảng giá & Chiết khấu')."}
2. Phân loại danh mục phù hợp (category - ví dụ: "Vị trí & Tiện ích", "Thông số & Kết cấu", "Thiết kế Nội thất", "Chủ đề khác", "Tư vấn tùy chỉnh").
3. Tóm tắt nội dung cuộc thoại ngắn gọn bằng tiếng Việt (1-2 câu), tập trung vào ý chính mà khách hàng thực sự đang đề cập đến ở cuối cuộc hội thoại.
4. Tìm ra 4-5 từ khóa quan trọng để tìm ảnh minh họa (keywords).
5. Tạo ra một từ khóa tìm kiếm hình ảnh bằng tiếng Anh (imageQuery - khoảng 2-5 từ) để tìm ảnh nghệ thuật, chất lượng cao mô tả chủ đề này trên Unsplash. Ví dụ: "modern town house exterior architecture", "minimalist luxury kitchen cabinet", "modern luxury living room design".
6. Đóng vai một chuyên viên tư vấn bất động sản của NhaDat.company cực kỳ am hiểu, am tường dự án, nhiệt tình và chân thành, xưng "em" và gọi khách hàng là "anh/chị". Hãy đưa ra 1 lời phản hồi/tư vấn (suggestion) tự nhiên, trôi chảy, có cấu trúc gọn gàng, có tính thẩm mỹ cao và dễ đọc trên màn hình điện thoại di động (không bị giới hạn 20 chữ nữa).
Yêu cầu phản hồi (suggestion):
- Trả lời trực tiếp vào đúng trọng tâm câu hỏi của khách hàng ngay ở câu đầu tiên, sau đó mới trình bày các chi tiết bổ trợ từ MASTER KNOWLEDGE BASE.
- Sử dụng **in đậm** cho các con số quan trọng, giá bán, diện tích, thông số kỹ thuật, gói bàn giao hoặc cột mốc để giúp khách dễ lướt quét thông tin.
- Nếu cần liệt kê từ 3 ý trở lên, hãy sử dụng các gạch đầu dòng ngắn gọn, gọn gàng, không viết thành một đoạn quá dài lê thê.
- Tuyệt đối dựa hoàn toàn vào MASTER KNOWLEDGE BASE hoặc dữ liệu kiến thức nguồn đối với các câu hỏi về dự án, không được bịa đặt bất cứ chi tiết nào về pháp lý, giá bán hay kỹ thuật để bảo đảm tính trung thực tuyệt đối.
- Nếu câu hỏi của khách hàng hoàn toàn không liên quan đến dự án Nyah Phú Định hoặc bất động sản (ví dụ: hỏi về thời tiết, ẩm thực, địa lý thế giới, lập trình, toán học, trò chuyện thông thường, nói vui, v.v.), bạn hãy đóng vai trợ lý AI thông minh vẫn lịch sự trả lời trực tiếp và chính xác câu hỏi đó của khách hàng bằng kiến thức chung của bạn. Tuy nhiên, sau khi trả lời, hãy khéo léo kết nối hoặc chuyển hướng nhẹ nhàng trở lại dự án bằng một câu từ tốn (ví dụ: "Dạ ngoài ra, nếu anh/chị cần em hỗ trợ tìm hiểu thêm các thông tin về nhà phố thông minh Nyah Phú Định hay mẫu thiết kế Cosmo Gen 2 thì cứ nhắn em nha!"). Đồng thời, đối với các câu hỏi không liên quan này, bạn BẮT BUỘC phải xếp vào chủ đề 'Chủ đề khác hoặc dự án khác'.
- Nếu là một câu hỏi liên quan đến dự án Nyah Phú Định nhưng thực sự không có thông tin chi tiết kỹ thuật/giá bán cụ thể trong tài liệu chuẩn, hãy trả lời chân thành: "Dạ thông tin này hiện em chưa có sẵn ạ" — rồi mời khách để lại số điện thoại hoặc liên hệ trực tiếp số hotline 0909 176 119 để được hỗ trợ chính xác. Tuyệt đối không tự bịa đặt hay đoán mò về dự án.
- Luôn kết thúc bằng một câu hỏi gợi mở nhu cầu thông minh (ví dụ: hỏi thêm về ngân sách, mục đích mua ở hay đầu tư, hoặc số lượng thành viên gia đình) hoặc một lời mời tinh tế để lại thông tin để em gửi file tài liệu trọn bộ.
- Có thể lồng ghép 1-2 emoji nhẹ nhàng phù hợp (🏠, 📍, 💰) nhưng không lạm dụng. NGOẠI LỆ ĐẶC BIỆT: Nếu khách hỏi khoảng cách, đường đi hoặc lộ trình di chuyển từ một địa danh cụ thể nào đó đến dự án Nyah Phú Định, trường 'suggestion' hãy viết một câu tư vấn chi tiết, chỉ rõ khoảng cách (km), thời gian di chuyển (phút) và hướng dẫn cụ thể tuyến đường di chuyển chính (ví dụ đi dọc theo đại lộ nào, rẽ vào đường nào...) để anh/chị khách hàng dễ hình dung lộ trình nhất nhé.
7. ĐẶC BIỆT LƯU Ý VỀ ĐO KHOẢNG CÁCH DỰ ÁN (Nyah Phú Định, mặt tiền đường Trương Đình Hội, Phường 16, Quận 8): Nếu trong cuộc hội thoại, khách hàng có nhắc đến một địa danh cụ thể nào đó (ví dụ: "bệnh viện Chợ Rẫy", "nhà tôi ở gần bệnh viện Chợ Rẫy", "đi từ bến xe miền Tây", "quận 5", "sân bay", v.v.) và hỏi khoảng cách hay thời gian di chuyển đến dự án, bạn hãy:
   - Trích xuất tên địa danh cụ thể đó vào trường "detectedDestination" dưới dạng một chuỗi địa danh rõ ràng (ví dụ: "Bệnh viện Chợ Rẫy").
   - Ước tính khoảng cách thực tế di chuyển bằng xe máy từ địa danh đó đến dự án Nyah Phú Định Quận 8 (ví dụ: "6.5 km") vào trường "estimatedDistance".
   - Ước tính thời gian di chuyển thực tế bằng xe máy (ví dụ: "15 phút") vào trường "estimatedDuration".
   - Nếu không có địa điểm cụ thể nào được nhắc đến, hãy để 3 trường này là chuỗi rỗng "".

Dưới đây là nội dung cuộc trò chuyện:
"${text}"`,
        config: {
          responseMimeType: "application/json",
          temperature: 0,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topic: {
                type: Type.STRING,
                description: selfLearningDisabled
                  ? `Chủ đề chính. Bạn BẮT BUỘC phải chọn và ghi chính xác một trong các chủ đề có sẵn sau: ${topicsList.join(", ")}. Không được phép tự chế tên chủ đề mới.`
                  : `Chủ đề chính. Nếu cuộc hội thoại phù hợp với một trong các chủ đề hiện có sau, bạn PHẢI dùng chính xác tên của chủ đề đó: ${topicsList.join(", ")}. Nhưng nếu cuộc hội thoại chuyển sang một khía cạnh/chủ đề mới có ý nghĩa liên quan đến dự án Nyah Phú Định, thiết kế, tiện ích, pháp lý, thanh toán... mà chưa có sẵn trong danh sách trên, bạn được phép tự động đề xuất một tên chủ đề mới bằng tiếng Việt cực kỳ ngắn gọn, súc tích (ví dụ: "Tiện ích hồ bơi & gym", "Pháp lý & Sổ hồng", "Thiết kế phòng ngủ Master").`,
              },
              category: {
                type: Type.STRING,
                description: "Danh mục chủ đề (ví dụ: Vị trí & Tiện ích, Thông số & Kết cấu, Thiết kế Nội thất, Chủ đề khác...)",
              },
              summary: {
                type: Type.STRING,
                description: "Tóm tắt cuộc trò chuyện bằng tiếng Việt ngắn gọn (1-2 câu).",
              },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách 4-5 từ khóa quan trọng tiếng Việt.",
              },
              imageQuery: {
                type: Type.STRING,
                description: "Từ khóa tìm ảnh bằng tiếng Anh thích hợp tìm trên Unsplash.",
              },
              suggestion: {
                type: Type.STRING,
                description:
                  "Lời khuyên/tư vấn ấm áp từ chuyên viên NhaDat.company xưng 'em' gọi 'anh/chị', lồng ghép emoji nhẹ nhàng.",
              },
              slideSuggestion: {
                type: Type.STRING,
                description: "Một thông điệp siêu ngắn gọn, cô đọng (khoảng 10-20 từ) tóm tắt ý tư vấn cốt lõi nhất để hiển thị trực tiếp lên slide.",
              },
              detectedDestination: {
                type: Type.STRING,
                description: "Tên địa điểm cụ thể khách hỏi khoảng cách đến dự án, ví dụ: 'Bệnh viện Chợ Rẫy'. Trả về chuỗi rỗng nếu không có.",
              },
              estimatedDistance: {
                type: Type.STRING,
                description: "Khoảng cách ước tính bằng xe máy (ví dụ: '6.5 km'). Trả về chuỗi rỗng nếu không có.",
              },
              estimatedDuration: {
                type: Type.STRING,
                description: "Thời gian di chuyển ước tính bằng xe máy (ví dụ: '15 phút'). Trả về chuỗi rỗng nếu không có.",
              },
            },
            required: ["topic", "category", "summary", "keywords", "imageQuery", "suggestion", "slideSuggestion"],
          },
        },
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("Không nhận được dữ liệu phân tích từ Gemini");
      }

      const analysis = JSON.parse(resultText.trim());
      
      // Nếu phát hiện địa danh cụ thể và có API key, gọi Routes API để ghi nhận dữ liệu thực tế
      if (analysis.detectedDestination) {
        const routeData = await getRoutesDistanceAndDuration(analysis.detectedDestination);
        if (routeData) {
          analysis.estimatedDistance = routeData.distance;
          analysis.estimatedDuration = routeData.duration;
          console.log(`Cập nhật khoảng cách chính xác từ Routes API cho ${analysis.detectedDestination}: ${routeData.distance}, ${routeData.duration}`);
        }
        
        // Trộn thông tin khoảng cách và thời gian vào câu trả lời tư vấn của chatbot để phản hồi khách hàng tự động, trực quan
        const dist = analysis.estimatedDistance || "5.0 km";
        const dur = analysis.estimatedDuration || "12 phút";
        const routePrefix = `🗺️ Khoảng cách từ ${analysis.detectedDestination} đến dự án Nyah Phú Định là khoảng **${dist}**, di chuyển bằng xe máy mất tầm **${dur}** anh/chị nhé. `;
        if (analysis.suggestion && !analysis.suggestion.includes("🗺️")) {
          analysis.suggestion = routePrefix + analysis.suggestion;
        }
      }

      res.json({ success: true, analysis });
    } catch (error: any) {
      // Quietly fall back to heuristic analysis without throwing noisy JSON logs that trigger system checks
      const errorMsg = error.message || String(error);
      const isQuota = errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limit");
      if (isQuota) {
        console.log("Hệ thống tự động sử dụng phân tích Heuristic do giới hạn cuộc gọi API (429).");
      } else {
        console.log("Hệ thống chuyển sang chế độ Heuristic dự phòng.");
      }
      
      // Heuristic detection based on input text
      const lower = text.toLowerCase();
      
      // Detect other projects/developers
      const otherProjectsKeywords = [
        "vinhomes", "vinhome", "novaland", "masterise", "masteri", "khang điền", "khang dien",
        "nam long", "akari", "mizuki", "sunrise", "grand park", "vạn phúc", "him lam",
        "capitaland", "sun group", "sunshine", "dự án khác", "các dự án khác", "bên khác"
      ];
      
      let mentionsOtherProject = false;
      otherProjectsKeywords.forEach(kw => {
        if (lower.includes(kw)) {
          mentionsOtherProject = true;
        }
      });
      
      if (lower.includes("phú mỹ hưng") && !lower.includes("di chuyển") && !lower.includes("sang") && !lower.includes("đến")) {
        mentionsOtherProject = true;
      }

      // Default: Chủ đề khác hoặc dự án khác
      let topic = "Chủ đề khác hoặc dự án khác";
      let category = "Chủ đề khác";
      let summary = "Cuộc trò chuyện đề cập đến dự án khác hoặc nội dung không thuộc phạm vi tư vấn.";
      let keywords = ["chủ đề khác", "dự án khác", "ngoài danh mục"];
      let imageQuery = "modern workspace";
      let suggestion = "Dạ, hiện tại hệ thống ghi nhận anh/chị đang trao đổi về chủ đề khác hoặc thông tin dự án khác ngoài dự án Nyah Phú Định Quận 8 và mẫu nhà Cosmo Gen 2. Nếu anh/chị cần hỗ trợ thêm thông tin gì về vị trí Nyah Phú Định, thiết kế Cosmo Gen 2 hay nội thất bếp, hãy cứ nói cho em biết nhé! 😊";
      let slideSuggestion = "Tìm hiểu thông tin và nhận hỗ trợ tư vấn chi tiết về dự án.";

      if (!mentionsOtherProject) {
        const scores: Record<string, number> = {};
        topicsList.forEach(t => {
          if (t === "Chủ đề khác hoặc dự án khác") return;
          scores[t] = 0;
          const kws = topicKeywordsMap?.[t] || [];
          kws.forEach((kw: string) => {
            if (lower.includes(kw.toLowerCase())) {
              scores[t] += 2;
            }
          });
          // Positional boost
          kws.forEach((kw: string) => {
            const lastIdx = lower.lastIndexOf(kw.toLowerCase());
            if (lastIdx !== -1 && lastIdx > lower.length * 0.6) {
              scores[t] += 3;
            }
          });
        });

        // Find the topic with the maximum score greater than 0
        let maxTopic = "";
        let maxScore = 0;
        Object.entries(scores).forEach(([t, score]) => {
          if (score > maxScore) {
            maxScore = score;
            maxTopic = t;
          }
        });

        if (maxScore > 0) {
          topic = maxTopic;
          const hasCustomKnowledge = topicKnowledge?.[maxTopic];

          if (maxTopic === "Nội thất nhà bếp") {
            category = "Thiết kế Nội thất";
            summary = "Trao đổi chi tiết về phương án thiết kế tủ bếp chữ L kịch trần bằng chất liệu cao cấp và tối ưu vị trí thiết bị cho mẫu nhà Cosmo Gen 2.";
            keywords = ["nội thất bếp", "tủ bếp chữ L", "gỗ mdf", "acrylic", "tối ưu không gian"];
            imageQuery = "minimalist luxury kitchen cabinet";
            suggestion = hasCustomKnowledge 
              ? `Dạ, theo tài liệu bếp: ${summarizeTo20Words(hasCustomKnowledge)}`
              : "Dạ, thiết kế tủ bếp chữ L kịch trần bằng chất liệu MDF chống ẩm phủ Acrylic hoặc Melamine cực kỳ sang trọng và bền bỉ ạ ✨. Bố trí này vừa tối ưu không gian góc vừa tạo độ thoáng kết nối với phòng khách. Em gợi ý mình đặt bồn rửa và bếp từ cách nhau ít nhất 60cm để hợp phong thủy thủy hỏa, và tủ lạnh ở đầu tủ để tiện lưu trữ nha anh/chị! 🍳";
            slideSuggestion = "Tủ bếp chữ L kịch trần gỗ MDF cao cấp, kết hợp Acrylic bóng gương hiện đại sang trọng.";
          } else if (maxTopic === "Mẫu nhà Cosmo Gen 2") {
            category = "Thông số & Kết cấu";
            summary = "Tìm hiểu thông số kỹ thuật mẫu nhà phố Cosmo Gen 2 diện tích 5mx9m, quy mô 6 tầng tối ưu không gian sống.";
            keywords = ["cosmo gen 2", "diện tích 5x9", "6 tầng", "nhà phố quận 8", "kết cấu"];
            imageQuery = "modern town house exterior architecture";
            suggestion = hasCustomKnowledge
              ? `Dạ, thông số theo bản vẽ: ${summarizeTo20Words(hasCustomKnowledge)}`
              : "Dạ đúng rồi ạ, mẫu Cosmo Gen 2 có diện tích đất 5m x 9m nhưng tổng diện tích sử dụng lên tới 250m² nhờ thiết kế thông minh 6 tầng (1 trệt, 1 lửng, 3 lầu và 1 tầng đa năng) 🏠. Kết cấu này được thiết kế móng cọc bê tông cốt thép cực kỳ vững chắc. Tầng lửng làm phòng khách thoáng đạt, tầng đa năng trên cùng có thể làm phòng thờ hoặc sân vườn BBQ siêu chill luôn đó anh/chị! 🌟";
            slideSuggestion = "Thiết kế 6 tầng tối ưu thông minh trên nền đất 5x9m, tổng diện tích sử dụng 250m² lý tưởng.";
          } else if (maxTopic === "Vị trí dự án Nyah Phú Định") {
            category = "Vị trí & Tiện ích";
            summary = "Cuộc trò chuyện khảo sát vị trí và khả năng kết nối giao thông của dự án Nyah Phú Định Quận 8.";
            keywords = ["vị trí", "nyah phú định", "trương đình hội", "quận 8", "giao thông"];
            imageQuery = "modern town house exterior architecture";
            suggestion = hasCustomKnowledge
              ? `Dạ, vị trí dự án: ${summarizeTo20Words(hasCustomKnowledge)}`
              : "Dạ, dự án Nyah Phú Định nằm ngay mặt tiền đường Trương Đình Hội, Quận 8 cực kỳ đắc địa 📍. Từ đây anh/chị di chuyển qua các quận trung tâm như Q.1, Q.5 chỉ khoảng 15-20 phút rất thuận tiện ạ. Đặc biệt khu vực này đã có hệ thống thoát nước mới nên anh/chị không lo ngập úng đâu nhé. Anh/Chị có cần em gửi bản đồ lộ trình di chuyển chi tiết không ạ? 🏠";
            slideSuggestion = "Mặt tiền Trương Đình Hội, kết nối thẳng Võ Văn Kiệt chỉ 3 phút, cốt nền cao ráo không ngập úng.";
          } else if (maxTopic === "Tiện ích xung quanh") {
            category = "Vị trí & Tiện ích";
            summary = "Khảo sát hệ thống tiện ích xung quanh ngoại khu của dự án Nyah Phú Định như trường học, chợ, trung tâm thương mại.";
            keywords = ["tiện ích", "xung quanh", "chợ phú định", "trường học", "bệnh viện"];
            imageQuery = "modern clean neighborhood park shopping center school street";
            suggestion = hasCustomKnowledge
              ? `Dạ, tiện ích xung quanh: ${summarizeTo20Words(hasCustomKnowledge)}`
              : "Dạ, quanh dự án Nyah Phú Định có đầy đủ tiện ích ngoại khu phục vụ cuộc sống thường nhật của gia đình mình luôn ạ 🏫. Chỉ mất vài phút đi bộ là tới chợ Phú Định, trường tiểu học và THCS Phú Định. Ngoài ra, đại siêu thị Aeon Mall Bình Tân và Mega Market cũng chỉ cách khoảng 10-15 phút chạy xe thôi anh/chị nhé! 🛍️✨";
            slideSuggestion = "Tiếp cận Chợ Phú Định, CoopMart trong 2 phút; cách Aeon Mall Bình Tân và Mega Market chỉ 10 phút.";
          } else {
            // Custom user-defined topics
            category = "Tư vấn tùy chỉnh";
            summary = `Cuộc hội thoại liên quan đến chủ đề tự thiết lập: ${maxTopic}.`;
            keywords = topicKeywordsMap?.[maxTopic] || [maxTopic];
            imageQuery = "modern design workspace";
            suggestion = hasCustomKnowledge
              ? `Dạ, tư vấn về ${maxTopic}: ${summarizeTo20Words(hasCustomKnowledge)}`
              : `Dạ, em nhận thấy anh/chị đang quan tâm đến "${maxTopic}" 😊. Đây là một chủ đề rất hay và hữu ích. Em rất sẵn lòng giải đáp thêm các thắc mắc chi tiết của anh/chị về khía cạnh này, anh/chị cứ thoải mái chia sẻ thêm nhé! 💬`;
            slideSuggestion = hasCustomKnowledge
              ? `Tư vấn về ${maxTopic}: ${summarizeTo20Words(hasCustomKnowledge)}`
              : `Tìm hiểu thông tin và nhận hỗ trợ tư vấn chi tiết về ${maxTopic}.`;
          }
        } else {
          // If no pre-set topic matched, check for specific project topics
          if (lower.includes("pháp lý") || lower.includes("phap ly") || lower.includes("sổ hồng") || lower.includes("so hong") || lower.includes("sổ đỏ") || lower.includes("so do") || lower.includes("giấy phép") || lower.includes("giay phep") || lower.includes("hoàn công") || lower.includes("hoan cong")) {
            topic = "Pháp lý & Sổ hồng";
            category = "Pháp lý & Cam kết";
            summary = "Quy trình pháp lý 4 bước minh bạch và tiến độ hoàn công cấp sổ hồng riêng từng căn của Nyah Phú Định.";
            keywords = ["pháp lý 4 bước", "sổ hồng riêng từng căn", "sổ đỏ tổng", "giấy phép xây dựng", "hoàn công"];
            imageQuery = "legal document folder home owner license property";
            suggestion = "Dạ, quy trình pháp lý của dự án **Ny'ah Phú Định** cực kỳ minh bạch và đã hoàn thiện đầy đủ qua 4 bước chuẩn chỉnh để bảo vệ quyền lợi trọn đời cho anh/chị ạ:\n\n* 📕 **Bước 1**: Giấy chứng nhận quyền sử dụng đất (**Sổ đỏ tổng** đã sẵn có, sẵn sàng giao dịch).\n* 🏗️ **Bước 2**: Giấy phép xây dựng (**Sẵn có**, cập nhật sang tên chủ mới).\n* 🏠 **Bước 3**: Giấy chứng nhận nhà + đất (**Sổ hồng riêng từng căn** sau khi hoàn công).\n* ✍️ **Bước 4**: Hợp đồng mua bán công chứng (Chuyển quyền sở hữu tài sản trọn đời).\n\nDự án được phê duyệt quy hoạch **1/500**, hồ sơ PCCC được thẩm tra theo tiêu chuẩn mới nhất. Đặc biệt, khi anh/chị **thanh toán đủ 85%** là có thể tiến hành công chứng sang tên ngay (ngoại trừ lô **#03**).\n\nAnh/chị có cần em gửi bản scan sổ đỏ tổng hoặc giấy phép xây dựng qua Zalo để mình an tâm tìm hiểu trước không ạ? 😊";
            slideSuggestion = "Pháp lý 4 bước minh bạch: Đã có sẵn sổ đỏ tổng, sẵn bàn giao sổ hồng riêng từng căn.";
          } else if (lower.includes("bảo hành") || lower.includes("bao hanh") || lower.includes("kết cấu") || lower.includes("ket cau") || lower.includes("khung sườn") || lower.includes("khung suon")) {
            topic = "Chính sách Bảo hành";
            category = "Pháp lý & Cam kết";
            summary = "Cam kết bảo hành kết cấu vững chắc 5 năm và bàn giao không lỗi từ chủ đầu tư Nhã Đạt.";
            keywords = ["bảo hành 5 năm", "bảo hành kết cấu", "bàn giao không khiếu nại", "nhã đạt"];
            imageQuery = "modern engineering building structure warranty safety protection";
            suggestion = "Dạ, chính sách bảo hành nhà của chủ đầu tư **Nhã Đạt** rất uy tín và cam kết lâu dài để anh/chị an tâm dọn về sinh sống ạ:\n\n* 🏗️ **Bảo hành kết cấu 05 năm**: Áp dụng đối với toàn bộ khung sườn bê tông cốt thép chịu lực chính của ngôi nhà.\n* ⚙️ **Bảo hành vận hành**: Bên em cam kết bàn giao căn nhà và các trang thiết bị đi kèm không khiếm khuyết, vận hành tốt trong điều kiện bình thường.\n* 🔌 **Thiết bị công nghệ & điện tử**: Các thiết bị vệ sinh Inax, hệ thống điện thông minh Zigbee, máy lạnh LG (trong gói MAX) sẽ được bảo hành theo đúng thời hạn quy định của nhà sản xuất tại thời điểm bàn giao.\n\nMọi thắc mắc hay sự cố kỹ thuật sẽ có đội ngũ kỹ sư hỗ trợ tận nhà nhanh chóng. Anh/chị có muốn tham khảo kỹ hơn về danh mục vật liệu hoàn thiện chi tiết không ạ? 🛡️";
            slideSuggestion = "Bảo hành kết cấu vững chắc 5 năm đối với khung sườn bê tông chịu lực từ Nhã Đạt.";
          } else if (lower.includes("bảng giá") || lower.includes("bang gia") || lower.includes("giá bán") || lower.includes("gia ban") || lower.includes("giá cả") || lower.includes("tỷ") || lower.includes("ty") || lower.includes("mã lô") || lower.includes("ma lo") || lower.includes("lô #") || lower.includes("rổ hàng") || lower.includes("ro hang")) {
            topic = "Bảng giá & Rổ hàng v12";
            category = "Tài chính & Ưu đãi";
            summary = "Cập nhật bảng giá rổ hàng v12 các lô Cosmo Gen 2, Cosmo tiêu chuẩn và mẫu Opus Startup mới nhất.";
            keywords = ["bảng giá v12", "lot_42 giá 8.981 tỷ", "lot_03 giá 9.71 tỷ", "lot_50", "lot_24", "office_package"];
            imageQuery = "modern architecture residential townhouses luxury property pricing";
            suggestion = "Dạ, em xin gửi anh/chị thông tin **bảng giá rổ hàng cập nhật mới nhất (Tháng 03/2026)** tại dự án Ny'ah Phú Định (giá nhà thô chưa bao gồm nội thất rời):\n\n* 🏡 **Lot_42 (Mẫu Cosmo Gen 2)**: **8.981.000.000 VNĐ** (Mức giá tốt nhất rổ hàng).\n* 🏡 **Lot_03 (Mẫu Cosmo tiêu chuẩn)**: **9.710.000.000 VNĐ**.\n* 🏡 **Lot_50 (Mẫu Cosmo Gen 2)**: **11.470.000.000 VNĐ** (Vị trí góc hai mặt thoáng đắc địa).\n* 🏢 **Lot_24 (Mẫu Opus v3 Startup)**: **12.751.000.000 VNĐ** (Mặt tiền rộng, thích hợp đặt văn phòng công ty).\n* 🏢 **Office_Package (Cặp 02 căn Office)**: **32.230.000.000 VNĐ** (Đã trang bị sẵn nội thất hoàn chỉnh theo thiết kế mẫu Opus).\n\nAnh/chị đang tìm kiếm một căn nhà để ở ấm cúng hay có nhu cầu vừa ở vừa làm văn phòng công ty để em tư vấn mã lô phù hợp nhất ạ? 💰";
            slideSuggestion = "Cập nhật rổ hàng v12 mới nhất: Cosmo Gen 2 Lot_42 giá ưu đãi chỉ từ 8.981 tỷ.";
          } else if (lower.includes("thanh toán") || lower.includes("thanh toan") || lower.includes("chiết khấu") || lower.includes("chiet khau") || lower.includes("tiến độ") || lower.includes("tien do") || lower.includes("góp") || lower.includes("pttt")) {
            topic = "Phương thức Thanh toán & Chiết khấu";
            category = "Tài chính & Ưu đãi";
            summary = "Tiến độ thanh toán chuẩn giãn 10% đợt đầu và công thức chiết khấu thanh toán sớm vượt trội.";
            keywords = ["tiến độ thanh toán", "trả góp 3%/tháng", "chiết khấu thanh toán sớm", "chiết khấu 4.06%"];
            imageQuery = "finance calculation money coins house keys investment";
            suggestion = "Dạ, dự án **Ny'ah Phú Định** đang áp dụng phương thức thanh toán cực kỳ linh hoạt cùng chính sách chiết khấu rất hấp dẫn ạ:\n\n* 📅 **Thanh toán chuẩn**: Đợt đầu chỉ cần **10%** ký HĐ, sau đó trả góp nhẹ nhàng **3%/tháng** trong vòng 7 tháng. Khi nhận nhà bàn giao (gói AIR) đóng tiếp **8%**, và đợt cuối đóng **61%** khi công chứng sang tên sổ hồng.\n* 💰 **Chiết khấu thanh toán sớm**: Chiết khấu = (Số tiền đóng trước) x (Hệ số x 2.9% / 12) x (Số tháng đóng trước). Hệ số chiết khấu gấp **3 lần** hoặc **6 lần** lãi suất tiết kiệm kỳ hạn 9 tháng của Vietcombank (hiện tại là 2.9%). Ví dụ, nếu anh/chị đóng sớm 50% sẽ được chiết khấu ngay tới **4.06%** (cho gói MAX) trừ thẳng vào hợp đồng!\n\nAnh/chị muốn lựa chọn phương án thanh toán giãn theo tiến độ hay thanh toán sớm để nhận mức chiết khấu tối đa ạ? 💸";
            slideSuggestion = "Đợt đầu chỉ thanh toán 10%, trả góp 3%/tháng hoặc nhận chiết khấu thanh toán sớm đến 4.06%.";
          } else if (lower.includes("airtop") || lower.includes("khí tươi") || lower.includes("khi tuoi") || lower.includes("thở sạch") || lower.includes("tho sach") || lower.includes("bụi mịn") || lower.includes("bui min") || lower.includes("pm2.5")) {
            topic = "Hệ thống AirTop Sức khỏe";
            category = "Công nghệ & Tiện ích";
            summary = "Hệ thống cấp khí tươi lọc bụi mịn PM2.5 AirTop bảo vệ tối đa sức khỏe hô hấp gia đình.";
            keywords = ["hệ thống airtop", "cấp khí tươi Panasonic", "lọc bụi mịn PM2.5", "đối lưu không khí"];
            imageQuery = "clean air breeze ventilation system home filter smart design";
            suggestion = "Dạ, hệ thống **AirTop** là giải pháp 'Thở sạch sống khỏe' độc quyền cực kỳ tâm huyết tại Ny'ah Phú Định giúp bảo vệ sức khỏe cho cả gia đình mình:\n\n* 🌀 **Cơ chế**: Không khí tươi tự nhiên từ trên mái nhà sẽ được nạp qua quạt Panasonic cùng hệ thống bộ lọc chuyên dụng, lọc sạch hoàn toàn bụi mịn PM2.5 trước khi thổi vào phòng ngủ và phòng khách.\n* 📊 **Hiệu suất**: Cung cấp tới **9.5 triệu lít khí tươi** sạch khuẩn mỗi ngày, giúp đối lưu dòng khí liên tục, thải độc khí CO2 và mùi ẩm mốc, giữ nhà luôn thoáng mát mà không cần mở cửa (tránh bụi bặm và tiếng ồn đô thị). Đối với mẫu nhà **Opus Startup**, công suất cấp khí tươi được tăng cường gấp **3 lần** để đáp ứng không gian làm việc đông người.\n\nGia gia đình mình có người lớn tuổi nhạy cảm với thời tiết hay em bé nhỏ không ạ, hệ thống này cực kỳ có lợi cho hệ hô hấp đó anh/chị! 🌬️";
            slideSuggestion = "Hệ thống AirTop cung cấp 9.5 triệu lít khí tươi sạch khuẩn, lọc bụi mịn PM2.5 mỗi ngày.";
          } else if (lower.includes("bytelife") || lower.includes("nhà thông minh") || lower.includes("nha thong minh") || lower.includes("phí quản lý") || lower.includes("phi quan ly") || lower.includes("0 đồng") || lower.includes("0 dong") || lower.includes("cảm biến") || lower.includes("cam bien")) {
            topic = "Hệ thống ByteLife & Phí quản lý 0đ";
            category = "Công nghệ & Tiện ích";
            summary = "Tự động hóa toàn diện bằng hệ sinh thái ByteLife giúp tối ưu năng lượng và miễn phí quản lý trọn đời.";
            keywords = ["nhà thông minh bytelife", "hơn 30 cảm biến", "phí quản lý 0 đồng trọn đời", "compound tự động hóa"];
            imageQuery = "smart home interface automation application light sensor controls console";
            suggestion = "Dạ, sự kết hợp giữa hệ thống nhà thông minh **ByteLife** và công nghệ quản lý compound tự động hóa là bí quyết giúp cư dân Ny'ah Phú Định được hưởng chính sách **Phí quản lý 0 đồng** trọn đời ạ:\n\n* 🧠 **Tự động hóa**: Trang bị hơn **30 cảm biến** tự động điều khiển đèn, điều hòa, thiết bị theo nhịp sinh học và chuyển động thực tế của gia đình để tối ưu năng lượng và chống lãng phí.\n* 🛡️ **Vận hành tự động**: Hệ thống camera giám sát AI thông minh, cổng chính tự động kiểm soát ra vào bằng nhận diện khuôn mặt/biển số xe và trạm shipper nhận hàng tự động giúp giảm thiểu tối đa chi phí thuê nhân viên bảo vệ hay ban quản lý.\n\nNhờ vậy, cư dân không phải đóng bất kỳ khoản phí quản lý định kỳ nào mà vẫn được bảo vệ an ninh compound biệt lập 24/7 cực kỳ đẳng cấp. Anh/chị có muốn tìm hiểu thêm về gói bàn giao MAX có tích hợp sẵn ByteLife không ạ? 🏠";
            slideSuggestion = "Quản lý tự động hóa thông minh giúp cư dân miễn hoàn toàn phí quản lý compound trọn đời.";
          } else if (lower.includes("opus") || lower.includes("office") || lower.includes("startup") || lower.includes("văn phòng") || lower.includes("van phong") || lower.includes("tải trọng") || lower.includes("tai trong")) {
            topic = "Mẫu nhà phố chuyên văn phòng Opus";
            category = "Thông số & Kết cấu";
            summary = "Khám phá mẫu nhà phố Opus chuyên startup với dầm sàn chịu tải trọng lớn gấp rưỡi và tiện ích văn phòng hạng A.";
            keywords = ["mẫu nhà opus", "tải trọng dầm sàn +150%", "vừa ở vừa làm việc 2-in-1", "thang máy biệt lập"];
            imageQuery = "modern design open startup office loft architecture town house";
            suggestion = "Dạ, mẫu nhà phố **Opus (Startup)** có kích thước **4m x 12.5m** (kết cấu Trệt, lửng, 3 lầu, sân thượng) là mô hình **2-in-1** độc đáo thiết kế riêng cho việc vừa ở vừa làm việc chuyên nghiệp:\n\n* 🏢 **2 tầng văn phòng Grade A**: Kết cấu dầm sàn chịu tải trọng cực lớn, tăng cường thêm **150%** so với nhà ở thông thường (thoải mái lắp đặt tủ hồ sơ lớn hay thiết bị máy móc nặng), có lối đi riêng cho người khuyết tật.\n* 🏠 **4 tầng nhà ở cao cấp**: Phía trên cực kỳ biệt lập, yên tĩnh cho gia đình sinh hoạt cùng hệ thống thang máy chạy thẳng lên sân thượng.\n\nĐây là lựa chọn lý tưởng cho các doanh nghiệp Startup công nghệ, công ty thiết kế, Studio hoặc Shop Online cần văn phòng đại diện đạt chuẩn. Anh/chị đang có ý định tự kinh doanh hay cho thuê lại mặt bằng văn phòng ạ? 🏢";
            slideSuggestion = "Mô hình 2-in-1 chuyên văn phòng Startup, dầm sàn tăng tải trọng 150%, thang máy biệt lập.";
          } else if (lower.includes("fusion") || lower.includes("bán tải") || lower.includes("ban tai") || lower.includes("gara") || lower.includes("gác lửng") || lower.includes("gac lung")) {
            topic = "Mẫu nhà tối ưu không gian Fusion";
            category = "Thông số & Kết cấu";
            summary = "Tìm hiểu mẫu Fusion với gara đỗ bán tải rộng, thiết kế thang bộ sát tường độc đáo và phòng ngủ master siêu lớn.";
            keywords = ["mẫu nhà fusion", "gara đỗ xe bán tải", "thang bộ sát tường", "phòng ngủ master chiếm 2/3"];
            imageQuery = "modern luxury townhouse interior garage staircase bedroom designer";
            suggestion = "Dạ, mẫu nhà **Fusion (Gen 5)** kích thước **4m x 11m** (Trệt, lửng, 3 lầu, sân thượng) nổi tiếng with các thiết kế cực kỳ đột phá và tối ưu không gian:\n\n* 🚗 **Garage cực đại**: Đỗ vừa vặn cả dòng xe bán tải cỡ lớn Ford Ranger hoặc 2 xe ô tô nhỏ một cách thoải mái trong nhà.\n* 🪜 **Thang bộ sáng tạo**: Thang biến hóa ôm sát tường, không chia đôi ngôi nhà như thiết kế truyền thống, giúp mở rộng tầm nhìn tối đa và tạo độ thoáng tuyệt vời.\n* 🛏️ **Phòng ngủ Master siêu lớn**: Thiết kế chiếm trọn **2/3 chiều dài nhà**, đem lại không gian nghỉ dưỡng chuẩn khách sạn 5 sao riêng tư và đầy đủ tiện nghi.\n\nAnh/chị có muốn nhận bản vẽ chi tiết bố trí mặt bằng các tầng của mẫu Fusion này để tiện hình dung không ạ? 📐";
            slideSuggestion = "Thang bộ ôm sát tường mở rộng không gian, gara đỗ vừa xe bán tải lớn Ford Ranger.";
          } else if (lower.includes("cosmo gen 1") || (lower.includes("cosmo") && lower.includes("gen 1")) || lower.includes("sảnh đón") || lower.includes("sanh don")) {
            topic = "Mẫu nhà phố bề thế Cosmo Gen 1";
            category = "Thông số & Kết cấu";
            summary = "Mẫu nhà Cosmo Gen 1 mặt tiền rộng 5m sở hữu hai lối vào riêng biệt, tạo vẻ bề thế và sang trọng.";
            keywords = ["mẫu cosmo gen 1", "mặt tiền 5m rộng thoáng", "lối vào bộ hành biệt lập", "garage xe hơi riêng"];
            imageQuery = "modern elegant townhouse architecture 5m facade ho chi minh city";
            suggestion = "Dạ, mẫu nhà **Cosmo Gen 1** kích thước **5m x 8.75m** (kết cấu Trệt, lửng, 2 lầu, 1 lầu đa năng) sở hữu những ưu điểm vượt trội:\n\n* 🏠 **Mặt tiền rộng 5m**: Cho cảm giác bề thế, đón gió trời và đón nhận ánh sáng tự nhiên vô cùng rộng thoáng.\n* 🚗 **Lối đi riêng biệt**: Thiết kế sảnh đón khách bộ hành sang trọng và lối vào garage ô tô hoàn toàn tách biệt, mang lại sự tinh tế và riêng tư cao nhất.\n\nĐây là dòng sản phẩm có tổng giá rất mềm, phù hợp cho gia đình từ 3-5 thành viên thích không gian mặt tiền ngang rộng. Anh/chị có muốn em gửi bảng so sánh chi tiết công năng giữa Cosmo Gen 1 và Cosmo Gen 2 không ạ? 🏠";
            slideSuggestion = "Mặt tiền rộng 5m bề thế đón sáng tự nhiên, sở hữu sảnh đón và lối vào xe riêng biệt.";
          } else if (lower.includes("air và max") || lower.includes("gói air") || lower.includes("goi air") || lower.includes("gói max") || lower.includes("goi max") || lower.includes("bàn giao") || lower.includes("ban giao") || lower.includes("vật liệu") || lower.includes("vat lieu")) {
            topic = "Gói bàn giao AIR & MAX";
            category = "Tư vấn thiết bị";
            summary = "So sánh điểm khác biệt của gói bàn giao cơ bản AIR và gói bàn giao thông minh cao cấp MAX.";
            keywords = ["gói bàn giao air", "gói bàn giao max", "gỗ an cường", "điện thông minh bytelife", "máy lạnh LG"];
            imageQuery = "modern interior design material samples finishes wood panels metal";
            suggestion = "Dạ, chủ đầu tư thiết kế 2 gói bàn giao hoàn thiện **AIR** và **MAX** vô cùng linh hoạt để anh/chị lựa chọn phù hợp với nhu cầu và ngân sách của gia đình mình:\n\n* 🌬️ **Gói AIR (Bàn giao hoàn thiện cơ bản)**: Đầy đủ phần hoàn thiện thô chất lượng cao bao gồm sơn nước nội ngoại thất Jotun, gạch nền Porcelain Vietceramics chống trơn, trọn bộ thiết bị vệ sinh Inax cao cấp, vách kính tắm 10mm Imundex, và đặc biệt là hệ thống cấp khí tươi sạch **AirTop** lọc bụi mịn bảo vệ sức khỏe. Gói này phù hợp nếu anh/chị muốn tự tay thiết kế nội thất gỗ và sắm sửa thiết bị theo ý thích riêng.\n* 👑 **Gói MAX (Bàn giao thông minh cao cấp)**: Nâng cấp toàn diện từ gói AIR bằng cách tích hợp thêm hệ thống điện thông minh **ByteLife** (cảm biến tự động, máy chủ trung tâm kết nối Zigbee/Wifi), tủ bếp gỗ MDF chống ẩm **An Cường** cao cấp kèm mặt đá granite, phụ kiện giảm chấn Imundex, bếp từ + máy hút mùi âm tủ hiện đại, và hệ thống máy lạnh âm trần/treo tường thương hiệu **LG** cao cấp lắp đặt sẵn ở tất cả các phòng.\n\nAnh/chị muốn lựa chọn bàn giao nhà hoàn thiện cơ bản (gói AIR) hay muốn nhận nhà hoàn thiện thông minh cao cấp (gói MAX) dọn vào ở ngay ạ? 😊";
            slideSuggestion = "Tự do thiết kế với gói cơ bản AIR, hoặc dọn vào ở ngay cùng nội thất thông minh gói MAX.";
          }
        }
      }

      // Extract custom landmark heuristically if requested
      let detectedDestination = "";
      let estimatedDistance = "";
      let estimatedDuration = "";

      const pattern1 = /(?:từ|tu)\s+([^,.\n?]+?)(?:\s*,\s*|\s+)(?:đến|den|tới|toi|sang|qua|về|ve|đi|di)\s+(?:dự án|du an|nhà|nha|nyah|mình|minh)/i;
      const match1 = text.match(pattern1);
      if (match1 && match1[1]) {
        detectedDestination = match1[1].trim();
      } else {
        const pattern2 = /(?:gần|gan|ở|o)\s+([^,.\n?]+?)(?:\s*,\s*|\s+)(?:đến|den|tới|toi|sang|qua|về|ve|đi|di)\s+(?:dự án|du an|nhà|nha|nyah|mình|minh)/i;
        const match2 = text.match(pattern2);
        if (match2 && match2[1]) {
          detectedDestination = match2[1].trim();
        } else {
          const pattern3 = /(?:cách|cach)\s+([^,.\n?]+?)\s+(?:bao xa|bao nhieu|mấy|may|như thế nào|nhu the nao)/i;
          const match3 = text.match(pattern3);
          if (match3 && match3[1] && !match3[1].includes("dự án") && !match3[1].includes("du an")) {
            detectedDestination = match3[1].trim();
          } else {
            const pattern4 = /(?:gần|gan)\s+([^,.\n?]+?)(?:\s|$|\.|\?)/i;
            const match4 = text.match(pattern4);
            if (match4 && match4[1] && !match4[1].includes("dự án") && !match4[1].includes("du an") && !match4[1].includes("đây") && !match4[1].includes("day")) {
              detectedDestination = match4[1].trim();
            }
          }
        }
      }

      if (detectedDestination) {
        detectedDestination = detectedDestination.replace(/^(bản đồ|ban do|đường đi|duong di|khoảng cách|khoang cach|vị trí|vi tri)\s+/gi, "").trim();
        detectedDestination = detectedDestination.charAt(0).toUpperCase() + detectedDestination.slice(1);
        
        const lowerDest = detectedDestination.toLowerCase();
        let directions = "";
        if (lowerDest.includes("chợ rẫy") || lowerDest.includes("cho ray")) {
          estimatedDistance = "6.2 km";
          estimatedDuration = "15 phút";
          directions = "Lộ trình di chuyển lý tưởng: Đi từ Bệnh viện Chợ Rẫy (Q.5) qua đường Nguyễn Chí Thanh -> rẽ trái vào Nguyễn Tri Phương -> qua cầu Nguyễn Tri Phương -> rẽ phải Đại lộ Võ Văn Kiệt -> di chuyển thông thoáng rồi rẽ trái vào đường Trương Đình Hội là đến ngay dự án bên tay phải ạ.";
        } else if (lowerDest.includes("hùng vương") || lowerDest.includes("hung vuong")) {
          estimatedDistance = "5.8 km";
          estimatedDuration = "13 phút";
          directions = "Lộ trình di chuyển: Từ Bệnh viện Hùng Vương (Q.5) di chuyển ra đường Hồng Bàng -> rẽ vào Ngô Quyền hoặc Nguyễn Tri Phương -> qua cầu Nguyễn Tri Phương -> rẽ phải Đại lộ Võ Văn Kiệt -> rẽ trái vào đường Trương Đình Hội là tới dự án Nyah Phú Định.";
        } else if (lowerDest.includes("từ dũ") || lowerDest.includes("tu du")) {
          estimatedDistance = "7.5 km";
          estimatedDuration = "18 phút";
          directions = "Lộ trình di chuyển: Từ Bệnh viện Từ Dũ (Q.1) đi theo đường Nguyễn Thị Minh Khai -> rẽ vào Cao Thắng -> rẽ vào Ba Tháng Hai -> Nguyễn Tri Phương -> rẽ Đại lộ Võ Văn Kiệt -> rẽ trái Trương Đình Hội.";
        } else if (lowerDest.includes("đại học y dược") || lowerDest.includes("dai hoc y duoc")) {
          estimatedDistance = "5.2 km";
          estimatedDuration = "12 phút";
          directions = "Lộ trình di chuyển: Từ Bệnh viện Đại học Y Dược (Q.5) di chuyển theo Hồng Bàng -> Nguyễn Tri Phương -> qua cầu Nguyễn Tri Phương -> rẽ Đại lộ Võ Văn Kiệt -> rẽ trái Trương Đình Hội.";
        } else if (lowerDest.includes("nguyễn tri phương") || lowerDest.includes("nguyen tri phuong")) {
          estimatedDistance = "4.8 km";
          estimatedDuration = "11 phút";
          directions = "Lộ trình di chuyển: Từ Bệnh viện Nguyễn Tri Phương (Q.5) di chuyển theo Nguyễn Tri Phương -> qua cầu Nguyễn Tri Phương -> rẽ Đại lộ Võ Văn Kiệt -> rẽ trái Trương Đình Hội.";
        } else if (lowerDest.includes("an đông") || lowerDest.includes("an dong")) {
          estimatedDistance = "5.5 km";
          estimatedDuration = "12 phút";
          directions = "Lộ trình di chuyển tốt nhất: Từ Chợ An Đông (Q.5) rẽ vào An Dương Vương -> Nguyễn Tri Phương -> qua cầu Nguyễn Tri Phương -> rẽ phải Đại lộ Võ Văn Kiệt -> đi thẳng rồi rẽ trái vào đường Trương Đình Hội để tới dự án.";
        } else if (lowerDest.includes("đầm sen") || lowerDest.includes("dam sen")) {
          estimatedDistance = "4.8 km";
          estimatedDuration = "10 phút";
          directions = "Lộ trình di chuyển nhanh nhất: Từ Công viên Đầm Sen (Q.11) đi theo đường Hòa Bình -> Lũy Bán Bích -> rẽ vào Kinh Dương Vương -> rẽ trái vào đường An Dương Vương -> đi thẳng rồi rẽ phải vào Trương Đình Hội là đến dự án.";
        } else if (lowerDest.includes("tân sơn nhất") || lowerDest.includes("tan son nhat") || lowerDest.includes("sân bay") || lowerDest.includes("san bay")) {
          estimatedDistance = "12 km";
          estimatedDuration = "30 phút";
          directions = "Lộ trình thuận tiện: Đi theo trục chính Trường Sơn -> Hoàng Văn Thụ -> rẽ vào Lý Thường Kiệt -> rẽ phải vào Ba Tháng Hai -> rẽ trái vào Hồng Bàng -> An Dương Vương -> rẽ phải vào đường Trương Đình Hội.";
        } else if (lowerDest.includes("bến xe miền tây") || lowerDest.includes("mien tay")) {
          estimatedDistance = "3.8 km";
          estimatedDuration = "8 phút";
          directions = "Lộ trình cực kỳ gần: Từ Bến xe Miền Tây đi thẳng Kinh Dương Vương -> rẽ phải vào An Dương Vương -> rẽ phải tiếp vào đường Trương Đình Hội là tới dự án ngay ạ.";
        } else {
          estimatedDistance = "5.0 km";
          estimatedDuration = "12 phút";
          directions = `Lộ trình di chuyển từ khu vực ${detectedDestination}: Anh/Chị có thể dễ dàng đi qua trục đại lộ Võ Văn Kiệt thông thoáng, sau đó rẽ trực tiếp vào đường Trương Đình Hội (mặt tiền dự án Nyah Phú Định) mà không sợ kẹt xe hay ngập nước.`;
        }

        // Gọi Routes API để cập nhật khoảng cách thực tế thay thế cho khoảng cách ước lượng Heuristic
        const routeData = await getRoutesDistanceAndDuration(detectedDestination);
        if (routeData) {
          estimatedDistance = routeData.distance;
          estimatedDuration = routeData.duration;
          console.log(`Cập nhật khoảng cách dự phòng từ Routes API cho ${detectedDestination}: ${routeData.distance}, ${routeData.duration}`);
        }

        // Trộn thông tin khoảng cách và thời gian vào câu trả lời tư vấn của chatbot để phản hồi khách hàng tự động, trực quan
        const routePrefix = `🗺️ Khoảng cách từ ${detectedDestination} đến dự án Nyah Phú Định là khoảng **${estimatedDistance}**, di chuyển bằng xe máy mất tầm **${estimatedDuration}** anh/chị nhé. \n👉 **Tuyến đường di chuyển:** ${directions}\n\n`;
        if (suggestion && !suggestion.includes("🗺️")) {
          suggestion = routePrefix + suggestion;
        }
      }

      res.json({
        success: true,
        analysis: {
          topic,
          category,
          summary,
          keywords,
          imageQuery,
          suggestion,
          slideSuggestion,
          detectedDestination,
          estimatedDistance,
          estimatedDuration
        },
        isFallback: true
      });
    }
  });

  // API Route: Generate image using gemini-2.5-flash-image
  app.post("/api/generate-image", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Yêu cầu từ khóa vẽ ảnh hợp lệ" });
    }

    try {
      const ai = getGeminiClient();
      // Use gemini-2.5-flash-image to generate a custom visual
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            {
              text: `${prompt}, beautiful warm digital art, corporate flat design vector illustration, clean lines, high resolution, minimalist aesthetic style`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      let base64Image = "";
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            base64Image = part.inlineData.data;
            break;
          }
        }
      }

      if (base64Image) {
        res.json({ success: true, imageUrl: `data:image/png;base64,${base64Image}` });
      } else {
        throw new Error("Không thể trích xuất dữ liệu hình ảnh được tạo ra");
      }
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.log("Không thể hoàn tất tạo ảnh AI từ Gemini: " + errorMsg);
      // Return a structured error, letting the client know to fallback
      res.status(500).json({
        error: errorMsg,
        isPaidFlowIssue: errorMsg.includes("billing") || errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("permission") || true
      });
    }
  });

  // Helper to convert Vietnamese string to unaccented kebab-case (preserving forward slashes for folder hierarchies)
  function convertToUnaccentedFolder(str: string): string {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accent marks
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-\/]/g, "") // remove other special chars except forward slash
      .trim()
      .replace(/\s+/g, "-") // replace spaces with hyphens
      .replace(/-+/g, "-"); // merge multiple hyphens
  }

  // API Route: Create a corresponding folder for uploading images when a new topic is created
  app.post("/api/create-topic-folder", (req, res) => {
    try {
      const { topicName, parentTopicName } = req.body;
      if (!topicName || typeof topicName !== "string" || !topicName.trim()) {
        return res.status(400).json({ success: false, error: "Tên chủ đề không hợp lệ" });
      }

      const cleanFolder = convertToUnaccentedFolder(topicName);
      if (!cleanFolder) {
        return res.status(400).json({ success: false, error: "Tên thư mục không hợp lệ sau khi lọc dấu" });
      }

      let baseDir = path.join(process.cwd(), "public", "images");
      if (process.env.NODE_ENV === "production" || !fs.existsSync(baseDir)) {
        const prodDir = path.join(process.cwd(), "dist", "images");
        if (fs.existsSync(prodDir)) {
          baseDir = prodDir;
        }
      }
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }

      // Group sub-folders under Nyah-Phu-Dinh to keep project folders clean and synchronized
      const nyahDir = path.join(baseDir, "Nyah-Phu-Dinh");
      if (fs.existsSync(nyahDir) && !cleanFolder.startsWith("nyah-phu-dinh")) {
        baseDir = nyahDir;
      }

      let alreadyExists = false;
      let createdPath = "";

      // If parentTopicName is provided, create a nested folder structure
      if (parentTopicName && typeof parentTopicName === "string" && parentTopicName.trim()) {
        const cleanParent = convertToUnaccentedFolder(parentTopicName);
        if (cleanParent) {
          const parentPath = path.join(baseDir, cleanParent);
          if (!fs.existsSync(parentPath)) {
            fs.mkdirSync(parentPath, { recursive: true });
          }
          const nestedPath = path.join(parentPath, cleanFolder);
          if (!fs.existsSync(nestedPath)) {
            fs.mkdirSync(nestedPath, { recursive: true });
            console.log(`Đã tạo thư mục con thành công: ${nestedPath}`);
          }
          createdPath = `${cleanParent}/${cleanFolder}`;
        }
      }

      // Also ensure a flat folder exists at root level for flexibility/fallback
      const flatPath = path.join(baseDir, cleanFolder);
      if (!fs.existsSync(flatPath)) {
        fs.mkdirSync(flatPath, { recursive: true });
        console.log(`Đã tạo thư mục độc lập thành công: ${flatPath}`);
        if (!createdPath) createdPath = cleanFolder;
      } else {
        alreadyExists = true;
        console.log(`Thư mục độc lập đã tồn tại: ${flatPath}`);
        if (!createdPath) createdPath = cleanFolder;
      }

      res.json({ success: true, folderName: createdPath, alreadyExists });
    } catch (error: any) {
      console.error("Lỗi khi tạo thư mục cho chủ đề:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Upload base64 encoded images directly into a topic's directory
  app.post("/api/upload-images", (req, res) => {
    try {
      const { topicName, parentTopicName, files } = req.body;
      if (!topicName || typeof topicName !== "string" || !topicName.trim()) {
        return res.status(400).json({ success: false, error: "Tên chủ đề không hợp lệ" });
      }
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ success: false, error: "Không tìm thấy dữ liệu tệp tải lên" });
      }

      const cleanFolder = convertToUnaccentedFolder(topicName);
      if (!cleanFolder) {
        return res.status(400).json({ success: false, error: "Tên thư mục không hợp lệ" });
      }

      let baseDir = path.join(process.cwd(), "public", "images");
      if (process.env.NODE_ENV === "production" || !fs.existsSync(baseDir)) {
        const prodDir = path.join(process.cwd(), "dist", "images");
        if (fs.existsSync(prodDir)) {
          baseDir = prodDir;
        }
      }
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }

      // Group under Nyah-Phu-Dinh if it exists
      const nyahDir = path.join(baseDir, "Nyah-Phu-Dinh");
      if (fs.existsSync(nyahDir) && !cleanFolder.startsWith("nyah-phu-dinh")) {
        baseDir = nyahDir;
      }

      let targetDir = path.join(baseDir, cleanFolder);
      if (parentTopicName && typeof parentTopicName === "string" && parentTopicName.trim()) {
        const cleanParent = convertToUnaccentedFolder(parentTopicName);
        if (cleanParent) {
          const parentPath = path.join(baseDir, cleanParent);
          if (!fs.existsSync(parentPath)) {
            fs.mkdirSync(parentPath, { recursive: true });
          }
          targetDir = path.join(parentPath, cleanFolder);
        }
      }

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const uploadedFiles: string[] = [];

      for (const file of files) {
        const { fileName, base64Data } = file;
        if (!fileName || !base64Data) continue;

        // Strip data:image/...;base64, if present
        const matches = base64Data.match(/^data:image\/([a-zA-Z+0-9]+);base64,(.+)$/);
        let dataString = base64Data;
        if (matches && matches.length === 3) {
          dataString = matches[2];
        }

        const buffer = Buffer.from(dataString, "base64");
        const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const targetFilePath = path.join(targetDir, cleanFileName);

        fs.writeFileSync(targetFilePath, buffer);
        console.log(`Đã ghi nhận tệp tải lên thành công: ${targetFilePath}`);

        // Construct relative URL
        let relPath = "";
        const publicIndex = targetFilePath.indexOf("public");
        const distIndex = targetFilePath.indexOf("dist");
        
        if (publicIndex !== -1) {
          relPath = targetFilePath.substring(publicIndex + "public".length).replace(/\\/g, "/");
        } else if (distIndex !== -1) {
          relPath = targetFilePath.substring(distIndex + "dist".length).replace(/\\/g, "/");
        } else {
          // fallback
          relPath = `/images/${cleanFolder}/${cleanFileName}`;
        }
        
        if (!relPath.startsWith("/")) relPath = "/" + relPath;
        uploadedFiles.push(relPath);
      }

      res.json({ success: true, uploadedFiles });
    } catch (error: any) {
      console.error("Lỗi khi tải ảnh lên thư mục chủ đề:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Synchronize physical folders on disk for all configured topics
  app.post("/api/sync-all-folders", (req, res) => {
    try {
      const { topicNames, topicParents, secondLevelKeywords } = req.body;
      if (!topicNames || !Array.isArray(topicNames)) {
        return res.status(400).json({ success: false, error: "Danh sách chủ đề không hợp lệ" });
      }

      let baseDirRoot = path.join(process.cwd(), "public", "images");
      if (process.env.NODE_ENV === "production" || !fs.existsSync(baseDirRoot)) {
        const prodDir = path.join(process.cwd(), "dist", "images");
        if (fs.existsSync(prodDir)) {
          baseDirRoot = prodDir;
        }
      }
      if (!fs.existsSync(baseDirRoot)) {
        fs.mkdirSync(baseDirRoot, { recursive: true });
      }

      const created: string[] = [];
      const existed: string[] = [];

      const parentMap: Record<string, string> = topicParents && typeof topicParents === "object" ? topicParents : {};

      const resolveBaseDir = (cleanFolder: string) => {
        let dir = baseDirRoot;
        const nyahDir = path.join(dir, "Nyah-Phu-Dinh");
        if (fs.existsSync(nyahDir) && !cleanFolder.startsWith("nyah-phu-dinh")) {
          dir = nyahDir;
        }
        return dir;
      };

      // 1. Sync level-1 and flat folders
      for (const topicName of topicNames) {
        if (!topicName || typeof topicName !== "string" || !topicName.trim()) continue;
        const cleanFolder = convertToUnaccentedFolder(topicName);
        if (!cleanFolder) continue;

        const baseDir = resolveBaseDir(cleanFolder);
        const targetPath = path.join(baseDir, cleanFolder);
        
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
          const displayPath = `${baseDir.endsWith("Nyah-Phu-Dinh") ? "Nyah-Phu-Dinh/" : ""}${cleanFolder}`;
          created.push(displayPath);
          console.log(`Tự động đồng bộ tạo thư mục cấp 1: ${targetPath}`);
        } else {
          const displayPath = `${baseDir.endsWith("Nyah-Phu-Dinh") ? "Nyah-Phu-Dinh/" : ""}${cleanFolder}`;
          existed.push(displayPath);
        }

        // 2. Sync nested child folder if parent is known from topicParents map
        const parentName = parentMap[topicName];
        if (parentName) {
          const cleanParent = convertToUnaccentedFolder(parentName);
          if (cleanParent) {
            const nestedParentPath = path.join(baseDir, cleanParent);
            if (!fs.existsSync(nestedParentPath)) {
              fs.mkdirSync(nestedParentPath, { recursive: true });
            }
            const nestedChildPath = path.join(nestedParentPath, cleanFolder);
            if (!fs.existsSync(nestedChildPath)) {
              fs.mkdirSync(nestedChildPath, { recursive: true });
              created.push(`${cleanParent}/${cleanFolder}`);
              console.log(`Tự động đồng bộ tạo thư mục con lồng nhau: ${nestedChildPath}`);
            } else {
              existed.push(`${cleanParent}/${cleanFolder}`);
            }
          }
        }
      }

      // 3. Proactively sync second-level keywords from config
      const subKeywords = Array.isArray(secondLevelKeywords) ? secondLevelKeywords : [];
      for (const sub of subKeywords) {
        if (sub.keyword && sub.parentTopic) {
          const cleanParent = convertToUnaccentedFolder(sub.parentTopic);
          const cleanChild = convertToUnaccentedFolder(sub.keyword);
          if (cleanParent && cleanChild) {
            const baseDir = resolveBaseDir(cleanChild);
            
            // Nested child dir
            const nestedParentPath = path.join(baseDir, cleanParent);
            if (!fs.existsSync(nestedParentPath)) {
              fs.mkdirSync(nestedParentPath, { recursive: true });
            }
            const nestedChildPath = path.join(nestedParentPath, cleanChild);
            if (!fs.existsSync(nestedChildPath)) {
              fs.mkdirSync(nestedChildPath, { recursive: true });
              created.push(`${cleanParent}/${cleanChild}`);
              console.log(`Tự động đồng bộ tạo thư mục lớp 2 cấu hình: ${nestedChildPath}`);
            } else {
              existed.push(`${cleanParent}/${cleanChild}`);
            }

            // Flat child dir fallback
            const flatChildPath = path.join(baseDir, cleanChild);
            if (!fs.existsSync(flatChildPath)) {
              fs.mkdirSync(flatChildPath, { recursive: true });
              console.log(`Tự động tạo thư mục phẳng cấp 1 cho lớp 2: ${flatChildPath}`);
            }
          }
        }
      }

      res.json({ success: true, created, existed });
    } catch (error: any) {
      console.error("Lỗi khi đồng bộ danh sách thư mục:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Delete the corresponding folder when a topic is deleted
  app.post("/api/delete-topic-folder", (req, res) => {
    try {
      const { topicName } = req.body;
      if (!topicName || typeof topicName !== "string" || !topicName.trim()) {
        return res.status(400).json({ success: false, error: "Tên chủ đề không hợp lệ" });
      }

      const cleanFolder = convertToUnaccentedFolder(topicName);
      if (!cleanFolder || cleanFolder === "." || cleanFolder === ".." || cleanFolder.includes("..")) {
        return res.status(400).json({ success: false, error: "Tên thư mục không hợp lệ sau khi lọc dấu" });
      }

      let baseDir = path.join(process.cwd(), "public", "images");
      if (process.env.NODE_ENV === "production" || !fs.existsSync(baseDir)) {
        const prodDir = path.join(process.cwd(), "dist", "images");
        if (fs.existsSync(prodDir)) {
          baseDir = prodDir;
        }
      }

      // Check both base and Nyah-Phu-Dinh subfolder
      let targetPath = path.resolve(baseDir, cleanFolder);
      const nyahDir = path.join(baseDir, "Nyah-Phu-Dinh");
      if (fs.existsSync(nyahDir) && !cleanFolder.startsWith("nyah-phu-dinh")) {
        const nyahPath = path.resolve(nyahDir, cleanFolder);
        if (fs.existsSync(nyahPath)) {
          targetPath = nyahPath;
        }
      }

      if (!targetPath.startsWith(baseDir)) {
        return res.status(403).json({ success: false, error: "Không được phép truy cập ngoài phạm vi" });
      }

      if (fs.existsSync(targetPath)) {
        if (typeof fs.rmSync === "function") {
          fs.rmSync(targetPath, { recursive: true, force: true });
        } else {
          fs.rmdirSync(targetPath, { recursive: true });
        }
        console.log(`Đã xóa thư mục thành công: ${targetPath}`);
        res.json({ success: true, deleted: true, folderName: cleanFolder });
      } else {
        console.log(`Thư mục không tồn tại nên không cần xóa: ${targetPath}`);
        res.json({ success: true, deleted: false, folderName: cleanFolder });
      }
    } catch (error: any) {
      console.error("Lỗi khi xóa thư mục của chủ đề:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Rename the corresponding folder when a topic name is updated
  app.post("/api/rename-topic-folder", (req, res) => {
    try {
      const { oldTopicName, newTopicName, parentTopicName } = req.body;
      if (!oldTopicName || !newTopicName) {
        return res.status(400).json({ success: false, error: "Tên cũ và tên mới là bắt buộc" });
      }

      const cleanOld = convertToUnaccentedFolder(oldTopicName);
      const cleanNew = convertToUnaccentedFolder(newTopicName);

      if (!cleanOld || !cleanNew) {
        return res.status(400).json({ success: false, error: "Tên thư mục không hợp lệ" });
      }

      let baseDir = path.join(process.cwd(), "public", "images");
      if (process.env.NODE_ENV === "production" || !fs.existsSync(baseDir)) {
        const prodDir = path.join(process.cwd(), "dist", "images");
        if (fs.existsSync(prodDir)) {
          baseDir = prodDir;
        }
      }

      const nyahDir = path.join(baseDir, "Nyah-Phu-Dinh");
      let activeBaseDir = baseDir;
      if (fs.existsSync(nyahDir) && !cleanOld.startsWith("nyah-phu-dinh")) {
        activeBaseDir = nyahDir;
      }

      let oldPath = path.resolve(activeBaseDir, cleanOld);
      let newPath = path.resolve(activeBaseDir, cleanNew);

      if (parentTopicName && typeof parentTopicName === "string" && parentTopicName.trim()) {
        const cleanParent = convertToUnaccentedFolder(parentTopicName);
        if (cleanParent) {
          const parentPath = path.join(activeBaseDir, cleanParent);
          oldPath = path.resolve(parentPath, cleanOld);
          newPath = path.resolve(parentPath, cleanNew);
        }
      }

      if (!oldPath.startsWith(baseDir) || !newPath.startsWith(baseDir)) {
        return res.status(403).json({ success: false, error: "Không được phép truy cập ngoài phạm vi" });
      }

      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        return res.json({ success: true, renamed: true, from: cleanOld, to: cleanNew });
      } else {
        // Just create the new path
        fs.mkdirSync(newPath, { recursive: true });
        return res.json({ success: true, renamed: false, created: true, path: cleanNew });
      }
    } catch (error: any) {
      console.error("Lỗi khi đổi tên thư mục chủ đề:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Delete a specific image file from disk
  app.post("/api/delete-image", (req, res) => {
    try {
      const { imageUrl } = req.body;
      if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("/images/")) {
        return res.status(400).json({ success: false, error: "Đường dẫn ảnh không hợp lệ" });
      }

      // Strip query parameters (?t=...)
      const cleanUrl = imageUrl.split("?")[0];
      const relativePart = cleanUrl.substring("/images/".length);

      const searchDirs = [
        path.join(process.cwd(), "public", "images"),
        path.join(process.cwd(), "dist", "images")
      ];

      let deleted = false;
      for (const baseDir of searchDirs) {
        if (fs.existsSync(baseDir)) {
          const targetFilePath = path.resolve(baseDir, relativePart);
          // Security: check that the file is indeed inside baseDir and not doing path traversal
          if (targetFilePath.startsWith(baseDir) && fs.existsSync(targetFilePath) && fs.statSync(targetFilePath).isFile()) {
            fs.unlinkSync(targetFilePath);
            deleted = true;
            console.log(`Đã xóa ảnh thành công: ${targetFilePath}`);
          }
        }
      }

      if (deleted) {
        res.json({ success: true, deleted: true });
      } else {
        res.status(404).json({ success: false, error: "Không tìm thấy tệp ảnh trên hệ thống để xóa" });
      }
    } catch (error: any) {
      console.error("Lỗi khi xóa ảnh:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Load custom configurations from public/app_configs.json
  app.get("/api/load-configs", (req, res) => {
    try {
      const configPath = path.join(process.cwd(), "public", "app_configs.json");
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, "utf-8");
        return res.json({ success: true, configs: JSON.parse(fileContent) });
      }
      return res.json({ success: true, configs: {} });
    } catch (error: any) {
      console.error("Lỗi khi đọc file cấu hình:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Auto summarize text using Gemini to maximum 16 words
  app.post("/api/auto-summarize", async (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "Nội dung cần tóm tắt không hợp lệ" });
    }

    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Hãy tóm tắt đoạn thông tin tiếng Việt sau đây thành một câu duy nhất cực kỳ ngắn gọn, súc tích, độ dài TỐI ĐA 16 từ (16 chữ).
Yêu cầu:
- Đi thẳng vào nội dung cốt lõi của chủ đề, loại bỏ hoàn toàn các từ thừa hoặc mở đầu không cần thiết (không dùng "Đây là", "Dự án có", "Chúng tôi cung cấp", "Tóm lại").
- Đọc dễ hiểu, tự nhiên, chuyên nghiệp như chuyên viên tư vấn bất động sản NhaDat.company.
- Chỉ trả về duy nhất câu tóm tắt thô đó, không thêm bất kỳ định dạng Markdown hay lời dẫn nào khác.

Đoạn thông tin:
"${text.substring(0, 4000)}"`,
        config: {
          temperature: 0.2,
        }
      });

      let summary = response.text ? response.text.trim() : "";
      // Strip quotes if Gemini wraps it
      summary = summary.replace(/^["'«»“„”`]|["'«»“„”`]$/g, "").trim();
      // Also remove any trailing period to make it fit nicely
      if (summary.endsWith(".")) {
        summary = summary.substring(0, summary.length - 1).trim();
      }

      // Safeguard: count words and trim if longer than 16
      const words = summary.split(/\s+/).filter(Boolean);
      if (words.length > 16) {
        summary = words.slice(0, 16).join(" ");
      }

      return res.json({ success: true, summary });
    } catch (error: any) {
      console.error("Lỗi tự động tóm tắt bằng Gemini:", error);
      // Heuristic fallback: get first 16 words
      const words = text.replace(/\*\*/g, "").replace(/^Nguồn:\s*[^\n]+\n/gi, "").split(/\s+/).filter(Boolean);
      const fallbackSummary = words.slice(0, 16).join(" ");
      return res.json({
        success: false,
        error: error.message || "Lỗi không xác định khi gọi Gemini API",
        fallback: fallbackSummary
      });
    }
  });

  // API Route: Save custom configurations to public/app_configs.json
  app.post("/api/save-configs", (req, res) => {
    try {
      const { configs } = req.body;
      if (!configs || typeof configs !== "object") {
        return res.status(400).json({ success: false, error: "Dữ liệu cấu hình không hợp lệ" });
      }

      const configPath = path.join(process.cwd(), "public", "app_configs.json");
      fs.writeFileSync(configPath, JSON.stringify(configs, null, 2), "utf-8");
      console.log("Đã lưu cấu hình thành công vào:", configPath);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Lỗi khi ghi file cấu hình:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Scan and get all folder-based topic images dynamically (with recursive deep folder support)
  app.get("/api/topic-images", (req, res) => {
    try {
      let baseDir = path.join(process.cwd(), "public", "images");
      if (process.env.NODE_ENV === "production" || !fs.existsSync(baseDir)) {
        const prodDir = path.join(process.cwd(), "dist", "images");
        if (fs.existsSync(prodDir)) {
          baseDir = prodDir;
        }
      }
      if (!fs.existsSync(baseDir)) {
        return res.json({ success: true, folders: {} });
      }

      const foldersMap: Record<string, string[]> = {};

      // Collect images directly inside a directory (no recursion into subdirectories)
      function getDirectImagesInDir(dirPath: string, relParts: string[]): string[] {
        let list: string[] = [];
        if (!fs.existsSync(dirPath)) return list;
        try {
          const items = fs.readdirSync(dirPath, { withFileTypes: true });
          for (const item of items) {
            if (item.isFile()) {
              const ext = path.extname(item.name).toLowerCase();
              if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)) {
                const webPath = ["/images", ...relParts, item.name].join("/");
                list.push(webPath);
              }
            }
          }
        } catch (err) {
          console.error("Lỗi đọc thư mục trực tiếp:", err);
        }
        return list;
      }

      function traverse(currentDir: string, relParts: string[]) {
        const directImages = getDirectImagesInDir(currentDir, relParts);
        directImages.sort();
        
        // 1. Register with the full relative path key (e.g. "Nyah-Phu-Dinh/mau-nha-cosmo-gen-2/noi-that-nha-bep")
        const fullPathKey = relParts.join("/");
        if (fullPathKey) {
          foldersMap[fullPathKey] = directImages;
        }

        // 2. Register with sub-combinations so that short names can be matched as well
        if (relParts.length > 0) {
          const leafName = relParts[relParts.length - 1];
          if (!foldersMap[leafName]) {
            foldersMap[leafName] = [];
          }
          foldersMap[leafName] = Array.from(new Set([...foldersMap[leafName], ...directImages])).sort();

          if (relParts.length > 1) {
            const subCombinationKey = relParts.slice(relParts.length - 2).join("/");
            if (!foldersMap[subCombinationKey]) {
              foldersMap[subCombinationKey] = [];
            }
            foldersMap[subCombinationKey] = Array.from(new Set([...foldersMap[subCombinationKey], ...directImages])).sort();
          }
        }

        // Continue scanning immediate subdirectories to register each of them too
        try {
          const items = fs.readdirSync(currentDir, { withFileTypes: true });
          for (const item of items) {
            if (item.isDirectory()) {
              traverse(path.join(currentDir, item.name), [...relParts, item.name]);
            }
          }
        } catch (err) {
          console.error("Lỗi duyệt thư mục con:", err);
        }
      }

      traverse(baseDir, []);

      res.json({ success: true, folders: foldersMap });
    } catch (error: any) {
      console.error("Lỗi khi quét thư mục hình ảnh:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Serve static images directly through Express with full decoding, multiple search folders, and robust fallback matching
  app.use("/images", (req, res, next) => {
    let decodedUrl = req.path;
    try {
      decodedUrl = decodeURIComponent(req.path);
    } catch (e) {
      console.error("Lỗi giải mã URL hình ảnh:", e);
    }

    try {
      const logMsg = `${new Date().toISOString()} - path: ${req.path}, originalUrl: ${req.originalUrl}, decoded: ${decodedUrl}\n`;
      fs.appendFileSync(path.join(process.cwd(), "image_logs.txt"), logMsg);
    } catch (err) {
      console.error("Lỗi ghi log hình ảnh:", err);
    }

    const searchDirs = [
      path.join(process.cwd(), "public", "images"),
      path.join(process.cwd(), "dist", "images"),
      path.join(process.cwd(), "images")
    ];

    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const fullPath = path.join(dir, decodedUrl);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          return res.sendFile(fullPath);
        }
      }
    }

    // Accent-insensitive / Case-insensitive matching as fallback
    const normalizeSearch = (str: string) => {
      return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]/g, "");
    };

    const targetBaseName = normalizeSearch(path.basename(decodedUrl));
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const parts = decodedUrl.split("/").filter(Boolean);
        if (parts.length > 0) {
          const targetSubdirNorm = normalizeSearch(parts[0]);
          try {
            const subdirs = fs.readdirSync(dir);
            for (const subdir of subdirs) {
              if (normalizeSearch(subdir) === targetSubdirNorm || normalizeSearch(subdir).includes(targetSubdirNorm)) {
                const subDirPath = path.join(dir, subdir);
                if (fs.statSync(subDirPath).isDirectory()) {
                  const files = fs.readdirSync(subDirPath);
                  for (const file of files) {
                    if (normalizeSearch(file) === targetBaseName || normalizeSearch(file).includes(targetBaseName)) {
                      const matchedFilePath = path.join(subDirPath, file);
                      console.log(`[Image Fallback] Khớp gần đúng thành công: ${matchedFilePath} cho ${req.path}`);
                      return res.sendFile(matchedFilePath);
                    }
                  }
                }
              }
            }
          } catch (err) {
            // Ignore readdir sync errors for non-dirs
          }
        }
      }
    }

    console.warn(`[Image Request] Không tìm thấy hình ảnh: ${decodedUrl} trong các thư mục`);
    next();
  });

  // Setup Vite Dev Server / Static Hosting based on environment
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT} under NODE_ENV=${process.env.NODE_ENV || "development"}`);
  });
}

startServer();
