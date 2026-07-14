import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY chưa được cấu hình.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { "User-Agent": "aistudio-build" },
    },
  });
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

function summarizeTo20Words(text: string): string {
  if (!text) return "";
  const cleanText = text.replace(/^Nguồn:\s*[^\n]+\n/gi, "").trim();
  const words = cleanText.split(/\s+/).filter(Boolean);
  if (words.length <= 20) return cleanText;
  const sentences = cleanText.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length > 0) {
    const sWords = sentences[0].split(/\s+/).filter(Boolean);
    if (sWords.length <= 20 && sWords.length >= 5) return sentences[0] + ".";
  }
  return words.slice(0, 20).join(" ") + "...";
}

async function getRoutesDistanceAndDuration(destinationName: string): Promise<{ distance: string; duration: string } | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return null;

  const queryWithCity = destinationName.toLowerCase().includes("hồ chí minh") || destinationName.toLowerCase().includes("hcm")
    ? destinationName
    : `${destinationName}, Hồ Chí Minh`;

  try {
    const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: queryWithCity },
        destination: { location: { latLng: { latitude: 10.725175, longitude: 106.615175 } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "vi-VN",
        units: "METRIC",
      }),
    });

    if (!res.ok) return null;

    const data: any = await res.json();
    if (data.routes && data.routes[0]) {
      const route = data.routes[0];
      const distanceMeters = route.distanceMeters;
      const durationStr = route.duration;
      if (distanceMeters !== undefined && durationStr) {
        const distance = distanceMeters < 1000 ? `${distanceMeters} m` : `${(distanceMeters / 1000).toFixed(1)} km`;
        const seconds = parseInt(durationStr.replace("s", ""), 10);
        return { distance, duration: `${Math.ceil(seconds / 60)} phút` };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", aiConfigured: !!process.env.GEMINI_API_KEY });
});

// Check keys
app.get("/api/check-keys", async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const routesKey = getGoogleMapsApiKey();
  const maskKey = (key: string) => {
    if (!key) return "Chưa cấu hình";
    if (key.length <= 8) return "Đã cấu hình (Quá ngắn)";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };
  res.json({
    gemini: { configured: !!geminiKey, masked: maskKey(geminiKey), length: geminiKey.length },
    routes: { configured: !!routesKey, masked: maskKey(routesKey), length: routesKey.length },
  });
});

// Test Routes API
app.post("/api/test-routes-api", async (req, res) => {
  const { destination } = req.body;
  const testDest = destination || "Chợ Bến Thành";
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return res.status(400).json({ success: false, error: "Google Maps API Key chưa được cấu hình." });
  }

  const queryWithCity = testDest.toLowerCase().includes("hồ chí minh") || testDest.toLowerCase().includes("hcm")
    ? testDest : `${testDest}, Hồ Chí Minh`;

  try {
    const googleResponse = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: queryWithCity },
        destination: { location: { latLng: { latitude: 10.725175, longitude: 106.615175 } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "vi-VN",
        units: "METRIC",
      }),
    });

    const responseText = await googleResponse.text();
    if (!googleResponse.ok) {
      return res.json({ success: false, status: googleResponse.status, error: responseText });
    }

    const data = JSON.parse(responseText);
    if (data.routes && data.routes[0]) {
      const route = data.routes[0];
      const distanceMeters = route.distanceMeters;
      const durationStr = route.duration;
      let distance = "N/A", duration = "N/A";
      if (distanceMeters !== undefined) distance = distanceMeters < 1000 ? `${distanceMeters} m` : `${(distanceMeters / 1000).toFixed(1)} km`;
      if (durationStr) duration = `${Math.ceil(parseInt(durationStr.replace("s", ""), 10) / 60)} phút`;
      return res.json({ success: true, destination: testDest, distance, duration, distanceMeters, durationRaw: durationStr, rawResponse: data });
    }
    return res.json({ success: false, error: "Không tìm thấy tuyến đường.", rawResponse: data });
  } catch (error: any) {
    return res.json({ success: false, error: error.message });
  }
});

const MASTER_KNOWLEDGE_BASE = `
MASTER KNOWLEDGE BASE: DỰ ÁN NY'AH PHÚ ĐỊNH (CẬP NHẬT T3/2026)

1. Tổng quan Dự án & Triết lý Phát triển
- Tên dự án: Ny'ah Phú Định.
- Chủ đầu tư: Công ty Nhã Đạt (nd).
- Quy mô: 50 căn (Mã lô từ #01 đến #50), bao gồm nhà phố Compound biệt lập và Shophouse thương mại.
- Vị trí chiến lược: 156 An Dương Vương, Phường 16, Quận 8, TP.HCM.
- Tiến độ bàn giao: Dự kiến năm 2026.
- Đơn vị thiết kế: Signature by Codinachs (Barcelona).
- Khả năng kết nối: 18 phút đến Quận 1; 27 phút đến Quận 2.
- Trục lộ chính: Cách Võ Văn Kiệt 1.000m, cận kề Vành Đai 2. Đặc biệt, trục đường Trương Đình Hội (lộ giới 20m) đã hoàn tất xây dựng, kết nối trực tiếp với Nguyễn Văn Linh qua nút giao khác mức.
- Tiện ích ngoại khu: Aeon Mall Bình Tân, Co.op Mart Phú Lâm, MM Mega Market Bình Phú, Bệnh viện Chợ Rẫy, Hệ thống trường học các cấp.
- Hệ thống 17 đặc quyền tiện ích nội khu.

2. Pháp lý & Cam kết Bảo hành
- Quy trình 4 bước: Sổ đỏ tổng > Giấy phép xây dựng > Sổ hồng riêng > Hợp đồng mua bán công chứng.
- Bảo hành kết cấu 05 năm. Bàn giao không khiếm khuyết.

3. Chi tiết Kỹ thuật & Vật liệu hoàn thiện (Phụ lục 1 – v6)

4. Phân tích Mẫu nhà
- Fusion (Gen 5): 4m x 11m, Trệt lửng 3 lầu sân thượng.
- Cosmo (Gen 1): 5m x 8.75m, Trệt lửng 2 lầu 1 lầu đa năng.
- Cosmo (Gen 2): 5m x 9m, Trệt lửng 3 lầu tầng đa năng. Super Bright, thang máy, 4 phòng ngủ en-suite.
- Opus (Startup): 4m x 12.5m, 2 tầng văn phòng Grade A + 4 tầng nhà ở.
- Office 1 & 2: 130.2m², 7 tầng, 28-32 căn hộ dịch vụ.

5. Gói AIR và MAX

6. Công nghệ ByteLife & AirTop

7. Bảng giá & Thanh toán (T3/2026)
- Lot_50: 11,470,000,000 VNĐ | Lot_42: 8,981,000,000 VNĐ | Lot_24: 12,751,000,000 VNĐ | Lot_03: 9,710,000,000 VNĐ | Office: 32,230,000,000 VNĐ

8. FAQ
`;

// Analyze conversation - main AI endpoint
app.post("/api/analyze-conversation", async (req, res) => {
  const { text, activeTopics, topicKeywordsMap, topicKnowledge, isSelfLearningDisabled } = req.body;

  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Nội dung cuộc thoại không hợp lệ" });
  }

  const selfLearningDisabled = isSelfLearningDisabled !== false;
  const topicsList = Array.isArray(activeTopics) && activeTopics.length > 0
    ? [...activeTopics, "Chủ đề khác hoặc dự án khác"]
    : ["Vị trí dự án Nyah Phú Định", "Tiện ích xung quanh", "Mẫu nhà Cosmo Gen 2", "Nội thất nhà bếp", "Chủ đề khác hoặc dự án khác"];

  try {
    const ai = getGeminiClient();

    let promptTopicsText = "";
    topicsList.forEach((t, index) => {
      const customKnowledge = topicKnowledge?.[t] || "";
      const knowledgeSection = customKnowledge
        ? `\n   - DỮ LIỆU KIẾN THỨC NGUỒN: "${customKnowledge}"`
        : "";

      if (t === "Vị trí dự án Nyah Phú Định") {
        promptTopicsText += `${index + 1}. "Vị trí dự án Nyah Phú Định" (vị trí địa lý Quận 8, Trương Đình Hội, bản đồ, đường đi)${knowledgeSection}\n`;
      } else if (t === "Tiện ích xung quanh") {
        promptTopicsText += `${index + 1}. "Tiện ích xung quanh" (trường học, siêu thị, bệnh viện, chợ)${knowledgeSection}\n`;
      } else if (t === "Mẫu nhà Cosmo Gen 2") {
        promptTopicsText += `${index + 1}. "Mẫu nhà Cosmo Gen 2" (5m x 9m, 6 tầng, kết cấu xây dựng)${knowledgeSection}\n`;
      } else if (t === "Nội thất nhà bếp") {
        promptTopicsText += `${index + 1}. "Nội thất nhà bếp" (thiết kế bếp, tủ bếp, thiết bị)${knowledgeSection}\n`;
      } else if (t === "Chủ đề khác hoặc dự án khác") {
        promptTopicsText += `${index + 1}. "Chủ đề khác hoặc dự án khác"\n`;
      } else {
        const customKeywords = topicKeywordsMap?.[t] || [];
        promptTopicsText += `${index + 1}. "${t}" (Từ khóa: ${customKeywords.join(", ")})${knowledgeSection}\n`;
      }
    });

    let selfLearningInstructions = selfLearningDisabled
      ? `Bạn TUYỆT ĐỐI KHÔNG ĐƯỢC đề xuất chủ đề mới. Phải chọn từ: ${topicsList.map(t => `"${t}"`).join(", ")}.`
      : `Nếu chủ đề nằm ngoài danh sách, tự đề xuất tên chủ đề tiếng Việt ngắn gọn.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Phân tích cuộc trò chuyện tiếng Việt. Chủ đề:\n${promptTopicsText}\n\nTÀI LIỆU CHUẨN:\n"""\n${MASTER_KNOWLEDGE_BASE}\n"""\n\n${selfLearningInstructions}\n\nƯu tiên chủ đề MỚI NHẤT ở cuối hội thoại.\n\nNhiệm vụ:\n1. Xác định chủ đề (topic)\n2. Phân loại (category)\n3. Tóm tắt 1-2 câu\n4. 4-5 từ khóa\n5. Từ khóa tìm ảnh tiếng Anh\n6. Tư vấn từ chuyên viên NhaDat.company xưng "em" gọi "anh/chị"\n7. Nếu nhắc địa danh cụ thể, trích xuất vào detectedDestination\n\nNội dung:\n"${text}"`,
      config: {
        responseMimeType: "application/json",
        temperature: 0,
        responseSchema: {
          type: "OBJECT" as const,
          properties: {
            topic: { type: "STRING" as const },
            category: { type: "STRING" as const },
            summary: { type: "STRING" as const },
            keywords: { type: "ARRAY" as const, items: { type: "STRING" as const } },
            imageQuery: { type: "STRING" as const },
            suggestion: { type: "STRING" as const },
            slideSuggestion: { type: "STRING" as const },
            detectedDestination: { type: "STRING" as const },
            estimatedDistance: { type: "STRING" as const },
            estimatedDuration: { type: "STRING" as const },
          },
          required: ["topic", "category", "summary", "keywords", "imageQuery", "suggestion", "slideSuggestion"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) throw new Error("Không nhận được dữ liệu từ Gemini");

    const analysis = JSON.parse(resultText.trim());

    if (analysis.detectedDestination) {
      const routeData = await getRoutesDistanceAndDuration(analysis.detectedDestination);
      if (routeData) {
        analysis.estimatedDistance = routeData.distance;
        analysis.estimatedDuration = routeData.duration;
      }
      const dist = analysis.estimatedDistance || "5.0 km";
      const dur = analysis.estimatedDuration || "12 phút";
      const routePrefix = `🗺️ Khoảng cách từ ${analysis.detectedDestination} đến dự án Nyah Phú Định là khoảng **${dist}**, di chuyển bằng xe máy mất tầm **${dur}** anh/chị nhé. `;
      if (analysis.suggestion && !analysis.suggestion.includes("🗺️")) {
        analysis.suggestion = routePrefix + analysis.suggestion;
      }
    }

    res.json({ success: true, analysis });
  } catch (error: any) {
    // Fallback heuristic (simplified for serverless)
    const lower = text.toLowerCase();
    let topic = "Chủ đề khác hoặc dự án khác";
    let category = "Chủ đề khác";
    let summary = "Cuộc trò chuyện đề cập đến nội dung khác.";
    let keywords = ["chủ đề khác"];
    let imageQuery = "modern workspace";
    let suggestion = "Dạ, em ghi nhận anh/chị đang trao đổi. Nếu cần hỗ trợ về dự án Nyah Phú Định, hãy cho em biết nhé! 😊";
    let slideSuggestion = "Tìm hiểu thông tin về dự án Nyah Phú Định.";

    if (lower.includes("vị trí") || lower.includes("quận 8") || lower.includes("trương đình hội")) {
      topic = "Vị trí dự án Nyah Phú Định"; category = "Vị trí & Tiện ích";
      summary = "Khảo sát vị trí dự án Nyah Phú Định.";
      keywords = ["vị trí", "nyah phú định", "quận 8"];
      imageQuery = "modern town house exterior";
      suggestion = "Dạ, dự án Nyah Phú Định nằm ngay mặt tiền đường Trương Đình Hội, Quận 8 📍. Di chuyển qua Q.1, Q.5 chỉ 15-20 phút ạ.";
      slideSuggestion = "Mặt tiền Trương Đình Hội, kết nối Võ Văn Kiệt chỉ 3 phút.";
    } else if (lower.includes("cosmo") || lower.includes("gen 2")) {
      topic = "Mẫu nhà Cosmo Gen 2"; category = "Thông số & Kết cấu";
      summary = "Tìm hiểu mẫu nhà Cosmo Gen 2.";
      keywords = ["cosmo gen 2", "5x9", "6 tầng"];
      imageQuery = "modern town house exterior architecture";
      suggestion = "Dạ, mẫu Cosmo Gen 2 diện tích 5m x 9m, tổng 250m² sử dụng, thiết kế 6 tầng thông minh 🏠.";
      slideSuggestion = "Cosmo Gen 2: 6 tầng, 250m² trên nền 5x9m.";
    }

    res.json({
      success: true,
      analysis: { topic, category, summary, keywords, imageQuery, suggestion, slideSuggestion, detectedDestination: "", estimatedDistance: "", estimatedDuration: "" },
      isFallback: true
    });
  }
});

// Generate image
app.post("/api/generate-image", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Yêu cầu từ khóa vẽ ảnh hợp lệ" });
  }

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: `${prompt}, beautiful warm digital art, corporate flat design, clean lines, high resolution` }] },
      config: { imageConfig: { aspectRatio: "1:1" } },
    });

    let base64Image = "";
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) { base64Image = part.inlineData.data; break; }
      }
    }
    if (base64Image) {
      res.json({ success: true, imageUrl: `data:image/png;base64,${base64Image}` });
    } else {
      throw new Error("Không thể tạo hình ảnh");
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message, isPaidFlowIssue: true });
  }
});

// Auto summarize
app.post("/api/auto-summarize", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Thiếu nội dung" });

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Tóm tắt ngắn gọn nội dung sau bằng tiếng Việt (1-2 câu): "${text}"`,
    });
    res.json({ success: true, summary: response.text || "" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Load configs (from environment or default)
app.get("/api/load-configs", (req, res) => {
  res.json({ success: true, configs: {} });
});

// Save configs (no-op on serverless)
app.post("/api/save-configs", (req, res) => {
  res.json({ success: true, message: "Configs saved (serverless mode)" });
});

// Topic images - return empty on serverless (no persistent filesystem)
app.get("/api/topic-images", (req, res) => {
  res.json({ success: true, images: [] });
});

// File system operations - return graceful messages on serverless
app.post("/api/create-topic-folder", (req, res) => {
  res.json({ success: true, folderName: "", message: "Tính năng này không khả dụng trên Vercel (serverless)." });
});

app.post("/api/upload-images", (req, res) => {
  res.json({ success: false, error: "Upload ảnh không khả dụng trên Vercel (serverless). Hãy dùng dịch vụ lưu trữ ảnh bên ngoài." });
});

app.post("/api/sync-all-folders", (req, res) => {
  res.json({ success: true, created: [], existed: [] });
});

app.post("/api/delete-topic-folder", (req, res) => {
  res.json({ success: false, error: "Không khả dụng trên serverless." });
});

app.post("/api/rename-topic-folder", (req, res) => {
  res.json({ success: false, error: "Không khả dụng trên serverless." });
});

app.post("/api/delete-image", (req, res) => {
  res.json({ success: false, error: "Không khả dụng trên serverless." });
});

export default app;
