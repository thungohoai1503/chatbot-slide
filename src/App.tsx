import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Mic,
  MicOff,
  Play,
  Volume2,
  RefreshCw,
  Sparkles,
  Image as ImageIcon,
  Search,
  MessageSquare,
  Settings,
  AlertCircle,
  AlertTriangle,
  X,
  History,
  Clock,
  ArrowRight,
  Home,
  MapPin,
  Cpu,
  BadgeAlert,
  Compass,
  CheckCircle2,
  Bookmark,
  Download,
  FileText,
  Trash2,
  Hash,
  Eye,
  EyeOff,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Tv,
  Pause,
  Maximize2,
  Edit,
  Plus,
  PlusCircle,
  Save,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import AdminPage from "./AdminPage";
// Google Maps rendering has been removed at user request.
import { SCENARIOS, ConversationScenario } from "./scenarios";

// Constants for interactive routing and distance measurement
const SURROUNDING_PLACES = [
  {
    name: "Chợ Phú Định",
    distance: "600m",
    time: "2 phút đi xe / 8 phút bộ",
    query: "Chợ Phú Định, Trương Đình Hội, Phường 16, Quận 8, Hồ Chí Minh"
  },
  {
    name: "Trường THCS Phú Định",
    distance: "800m",
    time: "3 phút đi xe / 10 phút bộ",
    query: "Trường THCS Phú Định, Trương Đình Hội, Phường 16, Quận 8, Hồ Chí Minh"
  },
  {
    name: "Đại lộ Võ Văn Kiệt",
    distance: "1.2 km",
    time: "3 phút di chuyển",
    query: "Đại lộ Võ Văn Kiệt, Phường 16, Quận 8, Hồ Chí Minh"
  },
  {
    name: "Mega Market Bình Phú (Q.6)",
    distance: "3.5 km",
    time: "8 phút di chuyển",
    query: "Mega Market Bình Phú, Đường Song Hành, Phường 11, Quận 6, Hồ Chí Minh"
  },
  {
    name: "Bệnh viện Quận 8",
    distance: "4.2 km",
    time: "10 phút di chuyển",
    query: "Bệnh viện Quận 8, Cao Lỗ, Phường 4, Quận 8, Hồ Chí Minh"
  },
  {
    name: "Aeon Mall Bình Tân",
    distance: "5.2 km",
    time: "12 phút di chuyển",
    query: "Aeon Mall Bình Tân, Đường Số 17A, Bình Trị Đông B, Bình Tân, Hồ Chí Minh"
  },
  {
    name: "Chợ Bến Thành (Quận 1)",
    distance: "11 km",
    time: "22 phút di chuyển",
    query: "Chợ Bến Thành, Lê Lợi, Phường Bến Thành, Quận 1, Hồ Chí Minh"
  },
  {
    name: "Phú Mỹ Hưng (Quận 7)",
    distance: "12 km",
    time: "25 phút di chuyển",
    query: "Phú Mỹ Hưng, Tân Phong, Quận 7, Hồ Chí Minh"
  }
];

// Robust helper function to prevent and handle localStorage quota exceeded exceptions
function safeSaveToLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    console.warn(`[safeSaveToLocalStorage] QuotaExceededError for key "${key}". Retrying with trimmed size...`, e);
    // Handle quota exceptions by trimming history / removing large base64 data strings
    try {
      if (key === "saved_conversation_sessions") {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          // Trim to only the 10 most recent sessions and remove heavy base64 strings if any
          const trimmed = parsed.slice(0, 10).map((item: any) => {
            if (item.customAiImageUrl && item.customAiImageUrl.startsWith("data:")) {
              return { ...item, customAiImageUrl: null };
            }
            return item;
          });
          localStorage.setItem(key, JSON.stringify(trimmed));
          return true;
        }
      } else if (key === "chatbot_messages_list") {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          // Keep only the last 15 messages to free up space
          const trimmed = parsed.slice(-15);
          localStorage.setItem(key, JSON.stringify(trimmed));
          return true;
        }
      } else if (key === "custom_topic_images" || key === "custom_topic_images_v2") {
        // If custom images are too big, we can strip old folders or clear base64s
        const parsed = JSON.parse(value);
        if (typeof parsed === "object" && parsed !== null) {
          const cleaned: Record<string, string[]> = {};
          // Strip base64 image strings to recover space, keep only absolute/relative URLs
          Object.entries(parsed).forEach(([folder, urls]: [string, any]) => {
            if (Array.isArray(urls)) {
              cleaned[folder] = urls.filter(url => !url.startsWith("data:"));
            }
          });
          localStorage.setItem(key, JSON.stringify(cleaned));
          return true;
        }
      } else {
        // Fallback: if we still can't save, try clearing some of the massive keys
        localStorage.removeItem("saved_conversation_sessions");
        localStorage.removeItem("chatbot_messages_list");
        localStorage.setItem(key, value);
        return true;
      }
    } catch (innerErr) {
      console.error("[safeSaveToLocalStorage] Critical error during automatic quota resolution:", innerErr);
    }
    return false;
  }
}

// Directions helper removed since Google Map rendering is disabled.

// Helper to extract custom landmark from Vietnamese queries
function extractLandmarkFromQuery(text: string): string | null {
  const trimmed = text.trim();
  const lowerText = trimmed.toLowerCase();
  
  // High-priority direct matching for key landmarks
  if (lowerText.includes("chợ rẫy") || lowerText.includes("cho ray")) {
    return "Bệnh viện Chợ Rẫy";
  }
  if (lowerText.includes("hùng vương") || lowerText.includes("hung vuong")) {
    return "Bệnh viện Hùng Vương";
  }
  if (lowerText.includes("từ dũ") || lowerText.includes("tu du")) {
    return "Bệnh viện Từ Dũ";
  }
  if (lowerText.includes("đại học y dược") || lowerText.includes("dai hoc y duoc")) {
    return "Bệnh viện Đại học Y Dược";
  }
  if (lowerText.includes("nguyễn tri phương") || lowerText.includes("nguyen tri phuong")) {
    return "Bệnh viện Nguyễn Tri Phương";
  }
  if (lowerText.includes("an đông") || lowerText.includes("an dong")) {
    return "Chợ An Đông";
  }
  if (lowerText.includes("đầm sen") || lowerText.includes("dam sen")) {
    return "Công viên Đầm Sen";
  }
  if (lowerText.includes("tân sơn nhất") || lowerText.includes("tan son nhat") || (lowerText.includes("sân bay") && !lowerText.includes("long thành"))) {
    return "Sân bay Tân Sơn Nhất";
  }
  if (lowerText.includes("bến xe miền tây") || lowerText.includes("ben xe mien tay")) {
    return "Bến xe Miền Tây";
  }

  // Clean punctuation
  const cleanPunctuation = (str: string) => str.replace(/[.,?\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();

  // Pattern 1: "từ [X] đến/tới/sang/qua/về dự án/nhà mình"
  const pattern1 = /(?:từ|tu)\s+([^,.\n?]+?)(?:\s*,\s*|\s+)(?:đến|den|tới|toi|sang|qua|về|ve|đi|di)\s+(?:dự án|du an|nhà|nha|nyah|mình|minh|bên mình|ben minh)/i;
  const match1 = trimmed.match(pattern1);
  if (match1 && match1[1]) {
    const val = cleanPunctuation(match1[1]);
    if (val.length > 2 && val.length < 50) return val;
  }

  // Pattern 1.5: "từ [X]" or "tu [X]" (when no specific destination word is needed, e.g. "khoảng cách từ bến xe miền tây")
  const pattern1_5 = /(?:từ|tu)\s+([^,.\n?]+?)(?:\s+(?:bao xa|bao nhieu|mấy|may|di chuyển|di chuyen|mất bao lâu|mat bao lau)|$|\.|\?)/i;
  const match1_5 = trimmed.match(pattern1_5);
  if (match1_5 && match1_5[1]) {
    const val = cleanPunctuation(match1_5[1]);
    if (val.length > 2 && val.length < 50 && !val.includes("dự án") && !val.includes("du an") && !val.includes("nhà") && !val.includes("nha")) return val;
  }

  // Pattern 2: "nhà tôi gần [X], đến dự án bao xa" hoặc "gần [X] đến dự án bao xa"
  const pattern2 = /(?:gần|gan|ở|o)\s+([^,.\n?]+?)(?:\s*,\s*|\s+)(?:đến|den|tới|toi|sang|qua|về|ve|đi|di)\s+(?:dự án|du an|nhà|nha|nyah|mình|minh)/i;
  const match2 = trimmed.match(pattern2);
  if (match2 && match2[1]) {
    const val = cleanPunctuation(match2[1]);
    if (val.length > 2 && val.length < 50) return val;
  }

  // Pattern 3: "cách [X] bao xa"
  const pattern3 = /(?:cách|cach)\s+([^,.\n?]+?)\s+(?:bao xa|bao nhieu|mấy|may|như thế nào|nhu the nao)/i;
  const match3 = trimmed.match(pattern3);
  if (match3 && match3[1]) {
    const val = cleanPunctuation(match3[1]);
    if (val.length > 2 && val.length < 50 && !val.includes("dự án") && !val.includes("du an")) {
      return val;
    }
  }

  // Pattern 4: "[X] đến dự án bao xa"
  const pattern4 = /([^,.\n?]+?)(?:\s*,\s*|\s+)(?:đến|den|tới|toi|sang|qua|về|ve|đi|di)\s+(?:dự án|du an|nhà|nha|nyah|mình|minh)\s+(?:bao xa|bao nhieu|mấy|may)/i;
  const match4 = trimmed.match(pattern4);
  if (match4 && match4[1]) {
    const val = cleanPunctuation(match4[1]);
    if (val.length > 2 && val.length < 50) return val;
  }

  // Pattern 5: "nhà tôi gần [X]"
  const pattern5 = /(?:gần|gan)\s+([^,.\n?]+?)(?:\s|$|\.|\?)/i;
  const match5 = trimmed.match(pattern5);
  if (match5 && match5[1]) {
    const val = cleanPunctuation(match5[1]);
    if (val.length > 2 && val.length < 50 && !val.includes("dự án") && !val.includes("du an") && !val.includes("đây") && !val.includes("day")) {
      return val;
    }
  }

  return null;
}

// Check if Speech Recognition is supported by the browser
const SpeechRecognition =
  typeof window !== "undefined"
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;

// Google Maps API key removed as Google Maps features are disabled.

interface AnalysisResult {
  topic: string;
  category: string;
  summary: string;
  keywords: string[];
  imageQuery: string;
  suggestion: string;
  slideSuggestion?: string;
  detectedDestination?: string;
  estimatedDistance?: string;
  estimatedDuration?: string;
}

interface SavedTopicSession {
  id: string;
  timestamp: string;
  transcript: string;
  analysis: AnalysisResult;
  customAiImageUrl: string | null;
}

const LOCAL_TOPIC_IMAGES: Record<string, string[]> = {
  "Dự án Nyah Phú Định": [
    "/images/Nyah-Phu-Dinh/tien-ich-noi-khu/tien-ich-noi-khu.jpg"
  ],
  "Tổng quan Dự án": [
    "/images/Nyah-Phu-Dinh/tien-ich-noi-khu/tien-ich-noi-khu.jpg"
  ],
  "Tổng quan Dự án Nyah Phú Định": [
    "/images/Nyah-Phu-Dinh/tien-ich-noi-khu/tien-ich-noi-khu.jpg"
  ],
  "Vị trí dự án Nyah Phú Định": [
    "/images/Nyah-Phu-Dinh/vi-tri-nyah-phu-dinh/vi-tri-nyah-phu-dinh.jpg",
    "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=50"
  ],
  "Tiện ích xung quanh": [
    "/images/Nyah-Phu-Dinh/tien-ich-xung-quanh/tien-ich-ngoai-khu.jpg",
    "https://images.unsplash.com/photo-1545231027-63b3f16260cd?auto=format&fit=crop&w=600&q=50"
  ],
  "Mẫu nhà Cosmo Gen 2": [
    "/images/Nyah-Phu-Dinh/mau-nha-cosmo-gen-2/mau-nha-cosmo-gen-2.png",
    "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=600&q=50"
  ],
  "Nội thất nhà bếp": [
    "/images/Nyah-Phu-Dinh/mau-nha-cosmo-gen-2/noi-that-nha-bep/noi-that-nha-bep.png",
    "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=50"
  ],
  "Nội thất phòng ngủ": [
    "/images/Nyah-Phu-Dinh/mau-nha-cosmo-gen-2/noi-that-phong-ngu/noi-that-phong-ngu.png",
    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=600&q=50"
  ],
  "Nội thất phòng khách": [
    "/images/Nyah-Phu-Dinh/mau-nha-cosmo-gen-2/noi-that-phong-khach/noi-that-phong-khach.png",
    "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=600&q=50"
  ],
  "Nội thất phòng tắm": [
    "/images/Nyah-Phu-Dinh/mau-nha-cosmo-gen-2/noi-that-phong-tam/noi-that-phong-tam.png",
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=50"
  ],
  "Pháp lý & Sổ hồng": [
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=50"
  ],
  "Chính sách Bảo hành": [
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=50"
  ],
  "Bảng giá & Rổ hàng v12": [
    "https://images.unsplash.com/photo-1512403754473-278556139b00?auto=format&fit=crop&w=600&q=50"
  ],
  "Phương thức Thanh toán & Chiết khấu": [
    "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=50"
  ],
  "Hệ thống AirTop Sức khỏe": [
    "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?auto=format&fit=crop&w=600&q=50"
  ],
  "Hệ thống ByteLife & Phí quản lý 0đ": [
    "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&q=50"
  ],
  "Mẫu nhà phố chuyên văn phòng Opus": [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=50"
  ],
  "Mẫu nhà tối ưu không gian Fusion": [
    "/images/Nyah-Phu-Dinh/mau-nha-fusion-gen-5/fusion-gen-5_mat-tien.jpg"
  ],
  "Mẫu nhà phố bề thế Cosmo Gen 1": [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=50"
  ],
  "Gói bàn giao AIR & MAX": [
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=50"
  ],
  "Tiện ích nội khu": [
    "/images/Nyah-Phu-Dinh/tien-ich-noi-khu/tien-ich-noi-khu.jpg"
  ],
  "mẫu nhà fusion gen 5": [
    "/images/Nyah-Phu-Dinh/mau-nha-fusion-gen-5/fusion-gen-5_mat-tien.jpg"
  ],
  "Mẫu nhà Fusion Gen 5": [
    "/images/Nyah-Phu-Dinh/mau-nha-fusion-gen-5/fusion-gen-5_mat-tien.jpg"
  ],
};

export const getTopicDisplayName = (key: string): string => {
  if (!key) return "";
  const parts = key.split(" > ");
  return parts[parts.length - 1];
};

export const getTopicSelectLabel = (key: string, topicParents: Record<string, string>): string => {
  const disp = getTopicDisplayName(key);
  const parent = topicParents[key];
  if (parent) {
    return `${disp} (${getTopicDisplayName(parent)})`;
  }
  return disp;
};

const lookupDefaultAnalysis = (topicName: string): AnalysisResult => {
  if (!topicName) {
    return {
      topic: "Chủ đề khác",
      category: "Chủ đề tự học",
      summary: "Chưa có thông tin chi tiết.",
      keywords: [],
      imageQuery: "",
      suggestion: "Vui lòng thêm thông tin chi tiết cho chủ đề này."
    };
  }
  if (DEFAULT_ANALYSES[topicName]) return DEFAULT_ANALYSES[topicName];
  const disp = getTopicDisplayName(topicName);
  if (DEFAULT_ANALYSES[disp]) {
    return {
      ...DEFAULT_ANALYSES[disp],
      topic: topicName
    };
  }
  return {
    topic: topicName,
    category: "Chủ đề tự học",
    summary: "Chưa có thông tin chi tiết.",
    keywords: [],
    imageQuery: "",
    suggestion: "Hệ thống tự học đã phát hiện chủ đề mới này. Quản trị viên có thể xem xét để lưu giữ cấu hình chính thức hoặc xóa bỏ."
  };
};

const DEFAULT_ANALYSES: Record<string, AnalysisResult> = {
  "Dự án Nyah Phú Định": {
    topic: "Dự án Nyah Phú Định",
    category: "Tổng quan Dự án",
    summary: "Dự án Ny’ah Phú Định gồm 50 căn nhà phố và shophouse biệt lập compound thương mại cao cấp với phí quản lý 0 đồng nhờ hệ thống vận hành tự động thông minh ByteLife.",
    keywords: ["dự án", "nyah", "nyah phú định", "nhã đạt", "nhadat", "phú định", "compound", "biệt lập", "shophouse"],
    imageQuery: "luxurious modern compound townhouse community ho chi minh city gate entrance green street architecture",
    suggestion: "Tư vấn tổng quan: Dự án Compound biệt lập an ninh 24/7 với 17 đặc quyền tiện ích nội khu đẳng cấp như sảnh chờ Landmark Coffee, bồn hoa công viên, sân thể thao ngoài trời. Thiết kế kiến trúc bởi Signature by Codinachs từ Barcelona mang phong cách châu Âu tinh tế và sang trọng.",
    slideSuggestion: "Quy mô 50 căn biệt lập compound, 17 tiện ích đặc quyền nội khu, phí quản lý 0 đồng."
  },
  "Mẫu nhà Fusion Gen 5": {
    topic: "Mẫu nhà Fusion Gen 5",
    category: "Thông số & Kết cấu",
    summary: "Mẫu nhà Fusion Gen 5 có kích thước đất 4m x 11m, kết cấu 4.5 lầu tối ưu với garage cực đại cho xe bán tải, thiết kế cầu thang biến hóa không chia đôi nhà và phòng Master siêu rộng.",
    keywords: ["fusion", "gen 5", "bán tải", "master", "sân thượng", "phòng master", "thang biến hóa", "fusion gen 5"],
    imageQuery: "modern clean townhouse garage for suv truck smart staircase design ho chi minh city",
    suggestion: "Gợi ý tư vấn: Mẫu nhà Fusion Gen 5 là dòng sản phẩm cực kỳ được ưa chuộng nhờ cải tiến thông minh. Thiết kế cầu thang độc đáo giúp luồng giao thông luôn liền mạch mà không cắt ngang chia đôi căn nhà. Tầng lửng và khoảng thông tầng khoáng đạt làm nổi bật vẻ sang trọng của phòng khách.",
    slideSuggestion: "Đất 4x11m, 4.5 lầu, garage xe bán tải cực đại, cầu thang biến hóa thông minh & phòng ngủ Master chiếm 2/3 nhà."
  },
  "Vị trí dự án Nyah Phú Định": {
    topic: "Vị trí dự án Nyah Phú Định",
    category: "Vị trí & Tiện ích",
    summary: "Dự án Nyah Phú Định tọa lạc tại vị trí chiến lược phường 16, Quận 8, nằm trên đường Trương Đình Hội sầm uất, giúp kết nối nhanh chóng tới các quận trung tâm.",
    keywords: ["vị trí", "địa chỉ", "quận 8", "trương đình hội", "phú định", "nyah"],
    imageQuery: "modern townhouse apartment block ho chi minh city district 8 vietnam outside location",
    suggestion: "Tư vấn điểm cộng vị trí: Nằm gần bến Phú Định, kết nối thẳng ra Đại lộ Võ Văn Kiệt chỉ 3 phút di chuyển. Quy hoạch tương lai sẽ xây dựng cầu Phú Định nối liền Quận 8 với Quận 6 và khu đô thị Tây Nam. Khu vực Trương Đình Hội có cốt nền cao ráo, ít bị ảnh hưởng bởi triều cường hơn các vùng trũng khác tại Quận 8.",
    slideSuggestion: "Mặt tiền Trương Đình Hội, kết nối thẳng Võ Văn Kiệt chỉ 3 phút, cốt nền cao ráo không ngập úng."
  },
  "Tiện ích xung quanh": {
    topic: "Tiện ích xung quanh",
    category: "Vị trí & Tiện ích",
    summary: "Dự án Nyah Phú Định thừa hưởng hệ thống tiện ích ngoại khu phong phú của khu Tây Sài Gòn: gần chợ Phú Định, trường học các cấp, siêu thị Mega Market và bệnh viện Quận 8.",
    keywords: ["tiện ích", "xung quanh", "chợ phú định", "trường học", "bệnh viện", "siêu thị"],
    imageQuery: "modern clean neighborhood park shopping center school street ho chi minh city",
    suggestion: "Tư vấn tiện ích ngoại khu vượt trội: Trong bán kính 1-2km, cư dân dễ dàng tiếp cận Chợ Phú Định, Coop Mart Võ Văn Kiệt, Trường THCS Phú Định, UBND Phường 16. Chỉ mất 10 phút để di chuyển tới đại siêu thị Aeon Mall Bình Tân hoặc Mega Market Bình Phú cực kỳ sầm uất và đầy đủ dịch vụ ạ! 🛍️🏫",
    slideSuggestion: "Tiếp cận Chợ Phú Định, CoopMart trong 2 phút; cách Aeon Mall Bình Tân và Mega Market chỉ 10 phút."
  },
  "Mẫu nhà Cosmo Gen 2": {
    topic: "Mẫu nhà Cosmo Gen 2",
    category: "Thông số & Kết cấu",
    summary: "Dòng nhà phố thông minh Cosmo Gen 2 với thiết kế 6 tầng tối ưu, mặt tiền 5m x chiều sâu 9m đem lại tổng diện tích sàn sử dụng 250m² lý tưởng cho gia đình đa thế hệ.",
    keywords: ["cosmo", "gen 2", "diện tích", "5m", "9m", "5x9", "250m", "6 tầng"],
    imageQuery: "modern minimalist 6 floor town house architecture design 5x9 cozy warm interior lighting luxury facade",
    suggestion: "Lời khuyên từ tư vấn viên: Nhờ thiết kế lửng ngược và tầng đa năng linh hoạt ở tầng thượng, gia chủ có thể kết hợp vừa ở vừa làm văn phòng công ty. Kết cấu móng băng vững chãi cùng hệ thống giếng trời lấy sáng tự nhiên giúp căn nhà phố diện tích vừa phải luôn ngập tràn ánh sáng và thông gió đối lưu tự nhiên.",
    slideSuggestion: "Thiết kế 6 tầng tối ưu thông minh trên nền đất 5x9m, tổng diện tích sử dụng 250m² lý tưởng."
  },
  "Nội thất nhà bếp": {
    topic: "Nội thất nhà bếp",
    category: "Thiết kế Nội thất",
    summary: "Giải pháp thiết kế phòng bếp hiện đại kịch trần dạng chữ L giúp nhân đôi không gian lưu trữ và đảm bảo thẩm mỹ hài hòa cho căn hộ có diện tích tối giản.",
    keywords: ["bếp", "nhà bếp", "tủ bếp", "mdf", "acrylic", "melamine", "tủ lạnh"],
    imageQuery: "modern clean L-shaped kitchen cabinet design warm lighting built in appliances luxury cozy interior design",
    suggestion: "Gợi ý thiết kế chuyên sâu: Hãy bố trí tam giác công năng (Bồn rửa - Bếp nấu - Tủ lạnh) with khoảng cách tối thiểu 1.2m để thuận tiện thao tác. Đối với căn hộ diện tích nhỏ, sử dụng chất liệu cánh tủ Acrylic bóng gương màu sáng phía trên kết hợp Melamine chống trầy xước màu gỗ phía dưới sẽ mang lại cảm giác không gian rộng rãi hơn rất nhiều.",
    slideSuggestion: "Tủ bếp chữ L kịch trần gỗ MDF cao cấp, kết hợp Acrylic bóng gương hiện đại sang trọng."
  },
  "Nội thất phòng ngủ": {
    topic: "Nội thất phòng ngủ",
    category: "Thiết kế Nội thất",
    summary: "Giải pháp thiết kế phòng ngủ ấm cúng, tối ưu ánh sáng tự nhiên và bố trí tủ quần áo kịch trần kết hợp bàn làm việc thông minh.",
    keywords: ["phòng ngủ", "giường", "nệm", "tủ áo", "đầu giường", "rèm cửa", "bàn trang điểm"],
    imageQuery: "modern cozy bedroom interior design warm lighting wardrobe minimalist bed style",
    suggestion: "Tư vấn thiết kế phòng ngủ: Nên chọn tông màu trung tính ấm áp (như màu ghi, beige hoặc nâu vân gỗ nhẹ) để đem lại cảm giác thư thái. Hệ tủ quần áo thiết kế kịch trần kết hợp cánh kính lùa giúp tăng tối đa diện tích trữ đồ mà không làm căn phòng bị chật chội.",
    slideSuggestion: "Không gian ngủ ấm cúng tông màu pastel nhã nhặn, tối ưu ánh sáng tự nhiên từ giếng trời."
  },
  "Nội thất phòng khách": {
    topic: "Nội thất phòng khách",
    category: "Thiết kế Nội thất",
    summary: "Thiết kế phòng khách hiện đại với sofa chữ I, bàn trà thông minh và vách tivi ốp đá/gỗ tạo điểm nhấn sang trọng cho toàn bộ ngôi nhà.",
    keywords: ["phòng khách", "sofa", "bàn trà", "kệ tivi", "vách ốp", "thảm", "đèn chùm", "tranh treo tường"],
    imageQuery: "modern luxurious living room interior design cozy sofa coffee table TV wall luxury",
    suggestion: "Tư vấn phòng khách: Bố trí ghế sofa tựa sát tường để tạo điểm tựa vững chãi theo phong thủy và giải phóng không gian di chuyển. Việc sử dụng vách ốp PVC giả đá kết hợp các dải led chạy dọc phía sau tivi sẽ tạo chiều sâu nghệ thuật cực kỳ bắt mắt.",
    slideSuggestion: "Sofa chữ I hiện đại, vách tivi ốp đá tạo chiều sâu sang trọng, tinh tế cho phòng khách."
  },
  "Nội thất phòng tắm": {
    topic: "Nội thất phòng tắm",
    category: "Thiết kế Nội thất",
    summary: "Phòng tắm tối giản tích hợp vách kính ngăn nước, bồn cầu thông minh và tủ lavabo treo hiện đại chống ẩm tuyệt đối.",
    keywords: ["phòng tắm", "nhà vệ sinh", "lavabo", "vòi sen", "bồn tắm", "vách kính", "gạch ốp", "toilet"],
    imageQuery: "modern minimalist bathroom design glass shower cabinet toilet luxury neutral tile styling",
    suggestion: "Tư vấn phòng tắm: Sử dụng gạch ốp lát granite nhám chống trơn trượt khổ lớn (60x60 hoặc 60x120) tạo cảm giác liền mạch, dễ lau chùi. Vách kính cường lực ngăn khu vực khô - ướt là tiêu chuẩn không thể thiếu để giữ phòng tắm luôn sạch sẽ, thông thoáng.",
    slideSuggestion: "Vách kính cường lực ngăn nước khô ráo, lavabo treo hiện đại cùng thiết bị vệ sinh Inax."
  }
};

interface SmoothImageProps {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  onError?: () => void;
  onLoadComplete?: (isPortrait: boolean) => void;
}

const SmoothImage: React.FC<SmoothImageProps> = ({ 
  src, 
  alt, 
  className = "", 
  wrapperClassName = "relative w-full h-full overflow-hidden",
  onError, 
  onLoadComplete 
}) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(true);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Keep a stable ref of onLoadComplete to avoid infinite loops when inline functions are passed
  const onLoadCompleteRef = useRef(onLoadComplete);
  useEffect(() => {
    onLoadCompleteRef.current = onLoadComplete;
  }, [onLoadComplete]);

  // Sync state instantly during render pass! This avoids the 1-frame/render lag entirely.
  if (src !== currentSrc) {
    setPrevSrc(currentSrc);
    setCurrentSrc(src);
    setIsLoaded(false);
  }

  // Handle cached or instantly-loaded local images where onLoad won't fire in React
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setIsLoaded(true);
      if (onLoadCompleteRef.current) {
        onLoadCompleteRef.current(imgRef.current.naturalHeight > imgRef.current.naturalWidth);
      }
    }
  }, [currentSrc]);

  return (
    <div className={wrapperClassName}>
      {/* Previous Image - stays visible but dimmed until new one loads */}
      {prevSrc && (
        <motion.div
          key={prevSrc}
          className="absolute inset-0 pointer-events-none"
          style={{ willChange: "opacity" }}
          initial={{ opacity: 1 }}
          animate={{ 
            opacity: isLoaded ? 0 : 1
          }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <img
            src={prevSrc}
            alt={alt}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${className}`}
            referrerPolicy="no-referrer"
          />
        </motion.div>
      )}

      {/* Modern responsive loading indicator inside the image container itself */}
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/15 backdrop-blur-[2px] z-10 pointer-events-none transition-all duration-300">
          <div className="w-8 h-8 border-2 border-white/25 border-t-white/90 rounded-full animate-spin" />
          <span className="text-[10px] mt-2 font-mono tracking-widest text-white/60 select-none uppercase">LOADING IMAGE</span>
        </div>
      )}

      {/* Current Image with high-end cross dissolve */}
      <motion.div
        key={currentSrc}
        className="absolute inset-0 pointer-events-none"
        style={{ willChange: "opacity" }}
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: isLoaded ? 1 : 0
        }}
        transition={{ duration: 0.7, ease: "easeInOut" }}
      >
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${className}`}
          onLoad={(e) => {
            setIsLoaded(true);
            const img = e.currentTarget;
            if (onLoadCompleteRef.current) {
              onLoadCompleteRef.current(img.naturalHeight > img.naturalWidth);
            }
          }}
          onError={onError}
          referrerPolicy="no-referrer"
        />
      </motion.div>
    </div>
  );
};

const SmoothBackdropImage: React.FC<{ src: string }> = ({ src }) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(true);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Sync state instantly during render pass! This avoids the 1-frame/render lag entirely.
  if (src !== currentSrc) {
    setPrevSrc(currentSrc);
    setCurrentSrc(src);
    setIsLoaded(false);
  }

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setIsLoaded(true);
    }
  }, [currentSrc]);

  const backdropClass = "absolute inset-0 w-full h-full object-cover filter blur-[5px] scale-110";

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden select-none pointer-events-none z-0">
      {prevSrc && (
        <motion.img
          key={prevSrc}
          src={prevSrc}
          alt=""
          className={backdropClass}
          style={{ willChange: "opacity" }}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: isLoaded ? 0 : 0.4 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          referrerPolicy="no-referrer"
        />
      )}

      <motion.img
        ref={imgRef}
        key={currentSrc}
        src={currentSrc}
        alt=""
        className={backdropClass}
        style={{ willChange: "opacity" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 0.4 : 0 }}
        transition={{ duration: 0.7, ease: "easeInOut" }}
        onLoad={() => setIsLoaded(true)}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

// Helper function to format any slogan/caption into exactly 2 lines, each having a maximum of 8 words.
const formatToTwoLinesOfMaxEightWords = (text: string): string[] => {
  if (!text) return ["", ""];
  
  // Clean text: strip markdown bold and leading hyphens/bullets
  let cleanText = text.replace(/\*\*/g, "").trim();
  if (cleanText.startsWith("- ")) {
    cleanText = cleanText.substring(2).trim();
  } else if (cleanText.startsWith("-")) {
    cleanText = cleanText.substring(1).trim();
  }
  
  let words = cleanText.replace(/\s+/g, " ").split(" ").filter(Boolean);
  
  // To make it concise (under 16 words is better), check if there is a natural punctuation break (comma, semicolon, period) 
  // between index 6 and 14, and truncate there if so.
  if (words.length > 10) {
    for (let i = 6; i < Math.min(words.length, 14); i++) {
      const lastChar = words[i].slice(-1);
      if (lastChar === "." || lastChar === "," || lastChar === ";" || lastChar === "!") {
        const wordWithNoPunc = words[i].slice(0, -1);
        words = [...words.slice(0, i), wordWithNoPunc];
        break;
      }
    }
  }
  
  // Hard limit to exactly 16 words maximum
  if (words.length > 16) {
    words = words.slice(0, 16);
  }
  
  // Split words perfectly evenly into two lines
  const mid = Math.ceil(words.length / 2);
  const line1Words = words.slice(0, mid);
  const line2Words = words.slice(mid);
  
  return [line1Words.join(" "), line2Words.join(" ")].filter(line => line.length > 0);
};

// Interface for 2nd-level keyword configurations
interface SecondLevelKeyword {
  id: string;
  parentTopic: string;
  keyword: string;
  caption: string;
  imageUrl: string;
}

interface TopicKeywordFormProps {
  topicName: string;
  learnNewKeywords: (topic: string, newKws: string[]) => void;
}

export const TopicKeywordForm: React.FC<TopicKeywordFormProps> = ({ topicName, learnNewKeywords }) => {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    if (inputValue.trim()) {
      const parts = inputValue.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
      learnNewKeywords(topicName, parts);
      setInputValue("");
    }
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-850 flex gap-1.5">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
          }
        }}
        placeholder="Thêm từ khóa mới (ví dụ: bồn tắm, sân thượng)..."
        className="flex-1 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-rose-500/60 focus:outline-none rounded-lg px-2 py-1 text-[10px] text-slate-200 placeholder:text-slate-600 transition"
      />
      <button
        type="button"
        onClick={handleAdd}
        className="px-2 py-1 bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-300 rounded-lg text-[10px] font-semibold transition flex items-center gap-1 shrink-0 cursor-pointer"
      >
        Thêm
      </button>
    </div>
  );
};

interface TopicSloganConfigProps {
  topicName: string;
  topicConciseSummaries: Record<string, string>;
  setTopicConciseSummaries: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setSyncNotification: (notif: { type: "success" | "error"; message: string } | null) => void;
}

export const TopicSloganConfig: React.FC<TopicSloganConfigProps> = ({
  topicName,
  topicConciseSummaries,
  setTopicConciseSummaries,
  setSyncNotification,
}) => {
  const currentSlogan = topicConciseSummaries[topicName] || "";
  const [sloganText, setSloganText] = useState(currentSlogan);
  const [inputText, setInputText] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    setSloganText(topicConciseSummaries[topicName] || "");
  }, [topicName, topicConciseSummaries]);

  const handleSloganChange = (val: string) => {
    setSloganText(val);
    setTopicConciseSummaries((prev) => ({
      ...prev,
      [topicName]: val,
    }));
  };

  const handleSaveSlogan = () => {
    setTopicConciseSummaries((prev) => ({
      ...prev,
      [topicName]: sloganText,
    }));
    setSyncNotification({
      type: "success",
      message: `Đã lưu câu slogan cho chủ đề "${getTopicDisplayName(topicName)}" thành công! 🎉`,
    });
    setTimeout(() => setSyncNotification(null), 3500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setInputText(text);
        setSyncNotification({
          type: "success",
          message: `Đã đọc từ file: ${file.name}`,
        });
        setTimeout(() => setSyncNotification(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === "string") {
          setInputText(text);
          setSyncNotification({
            type: "success",
            message: `Đã đọc từ file: ${file.name}`,
          });
          setTimeout(() => setSyncNotification(null), 3000);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSummarize = async () => {
    if (!inputText.trim()) {
      setSyncNotification({
        type: "error",
        message: "Vui lòng nhập văn bản hoặc kéo thả file để tự động tổng hợp!",
      });
      setTimeout(() => setSyncNotification(null), 3000);
      return;
    }

    setIsSynthesizing(true);
    try {
      const response = await fetch("/api/auto-summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await response.json();
      if (data.success && data.summary) {
        setSloganText(data.summary);
        setTopicConciseSummaries((prev) => ({
          ...prev,
          [topicName]: data.summary,
        }));
        setSyncNotification({
          type: "success",
          message: "AI Gemini đã tổng hợp câu slogan thành công!",
        });
        setTimeout(() => setSyncNotification(null), 3000);
      } else {
        throw new Error(data.error || "Không thể tổng hợp");
      }
    } catch (err: any) {
      const words = inputText.replace(/\s+/g, " ").split(" ").filter(Boolean);
      const fallbackSlogan = words.slice(0, 10).join(" ") + (words.length > 10 ? "..." : "");
      setSloganText(fallbackSlogan);
      setTopicConciseSummaries((prev) => ({
        ...prev,
        [topicName]: fallbackSlogan,
      }));
      setSyncNotification({
        type: "success",
        message: "Đã sử dụng giải thuật tóm gọn thay thế.",
      });
      setTimeout(() => setSyncNotification(null), 3000);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-850 space-y-2">
      <span className="text-[9px] uppercase font-bold text-slate-400 block">Cấu hình Câu Slogan hiển thị (TV)</span>
      
      <div className="flex flex-col gap-1">
        <label className="text-[8px] text-slate-500 uppercase font-semibold">Câu slogan hiện tại:</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={sloganText}
            onChange={(e) => handleSloganChange(e.target.value)}
            placeholder="Nhập câu slogan tự chọn hoặc để AI tự tổng hợp..."
            className="flex-1 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-rose-500/60 focus:outline-none rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 transition"
          />
          <button
            type="button"
            onClick={handleSaveSlogan}
            className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[10px] px-3.5 py-1.5 rounded-lg border border-rose-500/20 cursor-pointer shadow-md hover:shadow-rose-950/20 transition duration-200 flex items-center gap-1 shrink-0"
            title="Bấm để lưu câu slogan này"
          >
            <Save className="w-3.5 h-3.5 text-white" />
            <span>Lưu Slogan</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-900/60 space-y-1.5">
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Tổng hợp tự động bằng AI Gemini:</span>
        
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`relative border border-dashed rounded-lg p-2 flex flex-col items-center justify-center transition-all ${
            isDragActive 
              ? "border-rose-500/50 bg-rose-950/10" 
              : "border-slate-850 hover:border-slate-750 bg-slate-950/35"
          }`}
        >
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={3}
            placeholder="Dán văn bản chi tiết dự án tại đây..."
            className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none text-[9.5px] text-slate-300 placeholder:text-slate-600 resize-none"
          />
          
          <div className="w-full flex items-center justify-between border-t border-slate-900/60 pt-1 mt-1">
            <label className="flex items-center gap-1 text-[8px] text-slate-500 hover:text-rose-400 transition cursor-pointer select-none">
              <Upload className="w-2.5 h-2.5" />
              <span>Đính kèm file text (.txt)</span>
              <input 
                type="file" 
                accept=".txt,.md,.json,.csv,.xml" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>
            
            {inputText && (
              <button
                type="button"
                onClick={() => setInputText("")}
                className="text-[8px] text-slate-500 hover:text-rose-400 transition flex items-center gap-0.5"
              >
                <Trash2 className="w-2.5 h-2.5" />
                Xóa nội dung
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={isSynthesizing}
          onClick={handleSummarize}
          className="w-full py-1 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white rounded-md text-[9px] font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
        >
          {isSynthesizing ? (
            <>
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              Đang phân tích & tổng hợp...
            </>
          ) : (
            <>
              <Sparkles className="w-2.5 h-2.5 animate-pulse" />
              Tổng hợp thành slogan dưới 16 từ
            </>
          )}
        </button>
      </div>
    </div>
  );
};

interface TopicImageUploaderProps {
  topicName: string;
  topicParents: Record<string, string>;
  scannedFolderImages: Record<string, string[]>;
  fetchScannedFolderImages: () => Promise<void>;
  setSyncNotification: (notif: { type: "success" | "error"; message: string } | null) => void;
  imageVersion: number;
  setImageVersion: React.Dispatch<React.SetStateAction<number>>;
}

export const TopicImageUploader: React.FC<TopicImageUploaderProps> = ({
  topicName,
  topicParents,
  scannedFolderImages,
  fetchScannedFolderImages,
  setSyncNotification,
  imageVersion,
  setImageVersion,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Helper to convert Vietnamese string to unaccented kebab-case
  const convertToUnaccentedFolderLocal = (str: string): string => {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-\/]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  };

  // Find the matching folder key for display and uploading
  const getTopicBestFolderKey = (topic: string): string => {
    const normTopic = convertToUnaccentedFolderLocal(topic);
    let bestKey = "";
    let bestScore = -1;
    for (const key of Object.keys(scannedFolderImages)) {
      const normKey = convertToUnaccentedFolderLocal(key);
      if (normKey === normTopic) return key;
      if (normKey.includes(normTopic) || normTopic.includes(normKey)) {
        const score = normKey.length;
        if (score > bestScore) {
          bestScore = score;
          bestKey = key;
        }
      }
    }
    return bestKey || normTopic;
  };

  const folderKey = getTopicBestFolderKey(topicName);
  const images = scannedFolderImages[folderKey] || [];
  const parentTopicName = topicParents[topicName] || "";

  const handleDeleteImage = async (imgUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const res = await fetch("/api/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imgUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncNotification({
          type: "success",
          message: "Đã xóa hình ảnh thành công!",
        });
        setTimeout(() => setSyncNotification(null), 3000);
        setImageVersion(Date.now());
        await fetchScannedFolderImages();
      } else {
        throw new Error(data.error || "Không thể xóa hình ảnh");
      }
    } catch (err: any) {
      console.error(err);
      setSyncNotification({
        type: "error",
        message: `Lỗi khi xóa ảnh: ${err.message || err}`,
      });
      setTimeout(() => setSyncNotification(null), 3000);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async (fileList: File[]) => {
    const imageFiles = fileList.filter((f) => 
      /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name)
    );

    if (imageFiles.length === 0) {
      setSyncNotification({
        type: "error",
        message: "Chỉ hỗ trợ các tệp tin hình ảnh (.jpg, .png, .webp, .gif, .svg)!",
      });
      setTimeout(() => setSyncNotification(null), 4000);
      return;
    }

    setIsUploading(true);
    try {
      const filesPayload: { fileName: string; base64Data: string }[] = [];

      for (const file of imageFiles) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        filesPayload.push({
          fileName: file.name,
          base64Data: base64,
        });
      }

      const res = await fetch("/api/upload-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicName,
          parentTopicName,
          files: filesPayload,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSyncNotification({
          type: "success",
          message: `Đã tải lên thành công ${data.uploadedFiles.length} hình ảnh vào thư mục chủ đề!`,
        });
        setTimeout(() => setSyncNotification(null), 4000);
        setImageVersion(Date.now());
        await fetchScannedFolderImages();
      } else {
        throw new Error(data.error || "Không thể tải lên hình ảnh");
      }
    } catch (err: any) {
      console.error(err);
      setSyncNotification({
        type: "error",
        message: `Lỗi khi tải ảnh: ${err.message || err}`,
      });
      setTimeout(() => setSyncNotification(null), 4000);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-850 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase font-bold text-slate-400 block">
          Tải ảnh vào Thư mục Chủ đề
        </span>
        <span className="text-[8px] font-mono text-slate-500 max-w-[150px] truncate" title={folderKey}>
          📂 /images/{folderKey}
        </span>
      </div>

      {/* Thumbnails of current images inside this folder */}
      {images.length > 0 ? (
        <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-slate-950/55 rounded-lg border border-slate-900/60 max-h-36 overflow-y-auto">
          {images.map((imgUrl, idx) => {
            const cleanImgUrl = imgUrl.split("?")[0];
            const fileName = cleanImgUrl.substring(cleanImgUrl.lastIndexOf("/") + 1);
            return (
              <div key={idx} className="relative aspect-video bg-slate-900 border border-slate-800/80 rounded-md overflow-hidden group/thumb">
                <img 
                  src={`${imgUrl}?v=${imageVersion}`} 
                  alt={fileName} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
                
                {/* Always visible Delete Button */}
                <div className="absolute top-1 right-1 z-10">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteImage(imgUrl, e)}
                    className="p-1 bg-slate-950/80 hover:bg-rose-600 hover:text-white text-rose-400 rounded transition duration-150 shadow-sm"
                    title="Xóa hình ảnh này"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>

                {/* Subtitle / Filename bar always visible or slightly dimmed at the bottom */}
                <div className="absolute bottom-0 inset-x-0 bg-slate-950/70 py-0.5 px-1">
                  <span className="text-[6px] text-slate-300 font-mono truncate block leading-none">
                    {fileName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[8px] text-slate-500 bg-slate-950/30 py-2.5 px-2 rounded-lg border border-slate-900/40 text-center italic">
          Thư mục này hiện chưa có hình ảnh nào.
        </div>
      )}

      {/* Drop zone / Upload Button */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative border border-dashed rounded-lg p-3 flex flex-col items-center justify-center transition-all ${
          dragActive 
            ? "border-emerald-500 bg-emerald-950/10" 
            : "border-slate-800 hover:border-slate-700 bg-slate-950/40"
        }`}
      >
        <Upload className={`w-4 h-4 mb-1 transition-colors ${dragActive ? "text-emerald-400" : "text-slate-500"}`} />
        <span className="text-[8.5px] text-slate-400 font-medium text-center leading-normal">
          {dragActive ? "Kéo thả ảnh tại đây..." : "Kéo & Thả ảnh (.png, .jpg, .webp) vào đây hoặc"}
        </span>
        
        <label className="mt-1.5 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 rounded text-[8px] font-bold transition cursor-pointer select-none">
          {isUploading ? (
            <span className="flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              Đang tải lên...
            </span>
          ) : (
            "Chọn tệp ảnh"
          )}
          <input 
            type="file" 
            accept="image/*" 
            multiple 
            onChange={handleFileChange} 
            className="hidden" 
            disabled={isUploading}
          />
        </label>
      </div>
    </div>
  );
};

interface TopicRenameInputProps {
  topicName: string;
  renameCustomTopic: (oldName: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  setEditingTopic: (topic: string | null) => void;
  setSyncNotification: (notif: { type: "success" | "error"; message: string } | null) => void;
}

export const TopicRenameInput: React.FC<TopicRenameInputProps> = ({
  topicName,
  renameCustomTopic,
  setEditingTopic,
  setSyncNotification,
}) => {
  const [newName, setNewName] = useState(topicName);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNewName(topicName);
  }, [topicName]);

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setSyncNotification({ type: "error", message: "Tên chủ đề không được để trống!" });
      setTimeout(() => setSyncNotification(null), 3000);
      return;
    }
    if (trimmed === topicName) {
      return;
    }
    setIsSaving(true);
    try {
      const res = await renameCustomTopic(topicName, trimmed);
      if (res.success) {
        setSyncNotification({ type: "success", message: `Đã đổi tên chủ đề thành: "${trimmed}"` });
        setTimeout(() => setSyncNotification(null), 3000);
        setEditingTopic(trimmed); // switch editing to new name
      } else {
        setSyncNotification({ type: "error", message: res.error || "Không thể đổi tên chủ đề" });
        setTimeout(() => setSyncNotification(null), 3000);
      }
    } catch (err: any) {
      setSyncNotification({ type: "error", message: err.message || "Lỗi xảy ra" });
      setTimeout(() => setSyncNotification(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 pb-2 border-b border-slate-900">
      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Đổi tên chủ đề:</label>
      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nhập tên chủ đề mới..."
          className="bg-slate-900 border border-slate-850 hover:border-slate-750 focus:border-rose-500/60 focus:outline-none rounded px-2 py-0.5 text-[10px] text-slate-200 placeholder:text-slate-600 transition flex-1"
        />
        <button
          type="button"
          disabled={isSaving || newName.trim() === topicName}
          onClick={handleRename}
          className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[9.5px] font-bold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 shrink-0"
        >
          {isSaving ? "Lưu..." : "Lưu"}
        </button>
      </div>
    </div>
  );
};

interface AddSecondLevelFormProps {
  topicKeywords: Record<string, string[]>;
  topicParents: Record<string, string>;
  getFlattenedScannedImages: () => string[];
  addSecondLevelKeyword: (parentTopic: string, keyword: string, caption: string, imageUrl: string) => boolean;
  setSyncNotification: (notif: { type: "success" | "error"; message: string } | null) => void;
  fixedTopicName?: string;
}

export const AddSecondLevelForm: React.FC<AddSecondLevelFormProps> = ({
  topicKeywords,
  topicParents,
  getFlattenedScannedImages,
  addSecondLevelKeyword,
  setSyncNotification,
  fixedTopicName
}) => {
  const [newSubParentTopic, setNewSubParentTopic] = useState(fixedTopicName || "Nội thất nhà bếp");
  const [newSubKeyword, setNewSubKeyword] = useState("");
  const [newSubCaption, setNewSubCaption] = useState("");
  const [newSubImageUrl, setNewSubImageUrl] = useState("");

  useEffect(() => {
    if (fixedTopicName) {
      setNewSubParentTopic(fixedTopicName);
    }
  }, [fixedTopicName]);

  const handleAdd = () => {
    if (newSubParentTopic.trim() && newSubKeyword.trim() && newSubCaption.trim()) {
      const success = addSecondLevelKeyword(newSubParentTopic, newSubKeyword, newSubCaption, newSubImageUrl);
      if (success) {
        setNewSubKeyword("");
        setNewSubCaption("");
        setNewSubImageUrl("");
        setSyncNotification({
          type: "success",
          message: "Đã thêm cấu hình lớp 2 thành công!"
        });
        setTimeout(() => setSyncNotification(null), 3000);
      }
    } else {
      setSyncNotification({
        type: "error",
        message: "Vui lòng nhập đầy đủ Chủ đề chính, Từ khóa lớp 2 và Phụ đề."
      });
      setTimeout(() => setSyncNotification(null), 3000);
    }
  };

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-850 space-y-2">
      <span className="text-[9px] uppercase font-bold text-slate-400 block">Thêm cấu hình lớp 2 mới</span>
      
      <div className="flex flex-col gap-1.5">
        {!fixedTopicName && (
          <div className="flex flex-col gap-1">
            <label className="text-[8px] text-slate-500 uppercase font-semibold">Chủ đề chính:</label>
            <select
              value={newSubParentTopic}
              onChange={(e) => setNewSubParentTopic(e.target.value)}
              className="bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-rose-500/60 focus:outline-none rounded-lg px-2 py-1.5 text-[10px] text-slate-200 transition"
            >
              {Object.keys(topicKeywords).map((topicName) => (
                <option key={topicName} value={topicName}>
                  {getTopicSelectLabel(topicName, topicParents)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          <div className="flex flex-col gap-1">
            <label className="text-[8px] text-slate-500 uppercase font-semibold">Từ khóa Lớp 2:</label>
            <input
              type="text"
              value={newSubKeyword}
              onChange={(e) => setNewSubKeyword(e.target.value)}
              placeholder="vd: giặt sấy, bàn ăn nhanh..."
              className="bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-rose-500/60 focus:outline-none rounded-lg px-2 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 transition"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[8px] text-slate-500 uppercase font-semibold">Chọn hình ảnh có sẵn:</label>
            <select
              value={newSubImageUrl}
              onChange={(e) => setNewSubImageUrl(e.target.value)}
              className="bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-rose-500/60 focus:outline-none rounded-lg px-2 py-1.5 text-[10px] text-slate-200 transition"
            >
              <option value="">-- Chọn ảnh quét từ server --</option>
              {getFlattenedScannedImages().map((img) => {
                const parts = img.split("/");
                const displayName = parts.slice(-3).join("/");
                return (
                  <option key={img} value={img}>
                    {displayName}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[8px] text-slate-500 uppercase font-semibold">Đường dẫn ảnh tùy chỉnh (nếu tự gõ):</label>
          <input
            type="text"
            value={newSubImageUrl}
            onChange={(e) => setNewSubImageUrl(e.target.value)}
            placeholder="vd: /images/... hoặc URL Unsplash..."
            className="bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-rose-500/60 focus:outline-none rounded-lg px-2 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 transition"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[8px] text-slate-500 uppercase font-semibold">Dòng chữ hiển thị dưới ảnh:</label>
          <textarea
            value={newSubCaption}
            onChange={(e) => setNewSubCaption(e.target.value)}
            rows={2}
            placeholder="vd: Câu nói tâm đắc của chủ đầu tư về khu vực này..."
            className="bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-rose-500/60 focus:outline-none rounded-lg px-2 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 transition resize-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-md"
      >
        Thêm cấu hình Lớp 2
      </button>
    </div>
  );
};

interface EditSecondLevelFormProps {
  item: SecondLevelKeyword;
  topicKeywords: Record<string, string[]>;
  topicParents: Record<string, string>;
  getFlattenedScannedImages: () => string[];
  updateSecondLevelKeyword: (id: string, parentTopic: string, keyword: string, caption: string, imageUrl: string) => boolean;
  setEditingSubId: (id: string | null) => void;
  setSyncNotification: (notif: { type: "success" | "error"; message: string } | null) => void;
}

export const EditSecondLevelForm: React.FC<EditSecondLevelFormProps> = ({
  item,
  topicKeywords,
  topicParents,
  getFlattenedScannedImages,
  updateSecondLevelKeyword,
  setEditingSubId,
  setSyncNotification
}) => {
  const [parentTopic, setParentTopic] = useState(item.parentTopic);
  const [keyword, setKeyword] = useState(item.keyword);
  const [caption, setCaption] = useState(item.caption);
  const [imageUrl, setImageUrl] = useState(item.imageUrl);

  const handleSave = () => {
    const success = updateSecondLevelKeyword(item.id, parentTopic, keyword, caption, imageUrl);
    if (success) {
      setEditingSubId(null);
      setSyncNotification({
        type: "success",
        message: "Cập nhật cấu hình lớp 2 thành công!"
      });
      setTimeout(() => setSyncNotification(null), 3000);
    } else {
      setSyncNotification({
        type: "error",
        message: "Vui lòng nhập đầy đủ Chủ đề chính, Từ khóa lớp 2 và Phụ đề."
      });
      setTimeout(() => setSyncNotification(null), 3000);
    }
  };

  return (
    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-rose-500/30 flex flex-col gap-1.5 transition text-left w-full">
      <div className="flex items-center justify-between border-b border-slate-850 pb-1 mb-1">
        <span className="text-[8px] uppercase font-bold text-rose-400">Đang sửa cấu hình</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleSave}
            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[8px] font-bold transition cursor-pointer"
          >
            Lưu
          </button>
          <button
            type="button"
            onClick={() => setEditingSubId(null)}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[8px] font-bold transition cursor-pointer"
          >
            Hủy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        <div className="flex flex-col gap-0.5">
          <label className="text-[7px] text-slate-500 uppercase font-semibold">Chủ đề chính:</label>
          <select
            value={parentTopic}
            onChange={(e) => setParentTopic(e.target.value)}
            className="bg-slate-950 border border-slate-850 focus:border-rose-500/60 focus:outline-none rounded px-1.5 py-1 text-[9px] text-slate-200 transition"
          >
            {Object.keys(topicKeywords).map((topicName) => (
              <option key={topicName} value={topicName}>
                {getTopicSelectLabel(topicName, topicParents)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[7px] text-slate-500 uppercase font-semibold">Từ khóa Lớp 2:</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="bg-slate-950 border border-slate-850 focus:border-rose-500/60 focus:outline-none rounded px-1.5 py-1 text-[9px] text-slate-200 placeholder:text-slate-600 transition"
            placeholder="vd: giặt sấy, bàn ăn nhanh..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        <div className="flex flex-col gap-0.5">
          <label className="text-[7px] text-slate-500 uppercase font-semibold">Ảnh từ server:</label>
          <select
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="bg-slate-950 border border-slate-850 focus:border-rose-500/60 focus:outline-none rounded px-1.5 py-1 text-[9px] text-slate-200 transition"
          >
            <option value="">-- Chọn ảnh quét từ server --</option>
            {getFlattenedScannedImages().map((img) => {
              const parts = img.split("/");
              const displayName = parts.slice(-3).join("/");
              return (
                <option key={img} value={img}>
                  {displayName}
                </option>
              );
            })}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[7px] text-slate-500 uppercase font-semibold">Ảnh tùy chỉnh:</label>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="bg-slate-950 border border-slate-850 focus:border-rose-500/60 focus:outline-none rounded px-1.5 py-1 text-[9px] text-slate-200 placeholder:text-slate-600 transition"
            placeholder="Tự nhập URL ảnh..."
          />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <label className="text-[7px] text-slate-500 uppercase font-semibold">Dòng chữ hiển thị dưới ảnh:</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          className="bg-slate-950 border border-slate-850 focus:border-rose-500/60 focus:outline-none rounded px-1.5 py-1 text-[9px] text-slate-200 placeholder:text-slate-600 transition resize-none"
          placeholder="Câu mô tả..."
        />
      </div>
    </div>
  );
};

interface ChatManualInputFormProps {
  onSubmit: (text: string) => void;
}

const ChatManualInputForm: React.FC<ChatManualInputFormProps> = ({ onSubmit }) => {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 border-t border-slate-800/80 pt-2.5 flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Nhập nội dung hội thoại khác bằng tay..."
        className="flex-1 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-rose-500 focus:outline-none rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-500 transition"
      />
      <button
        type="submit"
        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-300 rounded-lg text-xs font-semibold transition flex items-center gap-1 shrink-0"
      >
        Gửi đi
      </button>
    </form>
  );
};

interface AddManualTopicFormProps {
  topicKeywords: Record<string, string[]>;
  topicParents: Record<string, string>;
  addNewTopic: (
    topicName: string,
    keywords: string[],
    initialKnowledge?: string,
    parentTopicName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  setSyncNotification: (notif: { type: "success" | "error" | "info"; message: string } | null) => void;
}

export const AddManualTopicForm: React.FC<AddManualTopicFormProps> = ({
  topicKeywords,
  topicParents,
  addNewTopic,
  setSyncNotification,
}) => {
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicKeywords, setNewTopicKeywords] = useState("");
  const [newTopicImage, setNewTopicImage] = useState("");
  const [newTopicParent, setNewTopicParent] = useState("");
  const [topicError, setTopicError] = useState<string | null>(null);

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2.5 mt-1 relative">
      <div className="flex items-center gap-1.5 border-b border-slate-800/60 pb-1.5">
        <PlusCircle className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span className="text-[11px] font-bold text-slate-200">THÊM CHỦ ĐỀ THỦ CÔNG</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Tên chủ đề:</label>
          <input
            type="text"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            placeholder="Ví dụ: Mẫu nhà Fusion Gen 5"
            className="bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-emerald-500 focus:outline-none rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 transition"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Từ khóa nhận diện:</label>
          <input
            type="text"
            value={newTopicKeywords}
            onChange={(e) => setNewTopicKeywords(e.target.value)}
            placeholder="fusion, gen 5..."
            className="bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-emerald-500 focus:outline-none rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 transition"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Chủ đề cha (Tùy chọn):</label>
          <select
            value={newTopicParent}
            onChange={(e) => setNewTopicParent(e.target.value)}
            className="bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-emerald-500 focus:outline-none rounded-lg px-2.5 py-1 text-xs text-emerald-400 placeholder:text-slate-600 transition cursor-pointer"
          >
            <option value="">-- Không có (Chủ đề gốc) --</option>
            {Object.keys(topicKeywords).map((tn) => (
              <option key={tn} value={tn}>
                {getTopicSelectLabel(tn, topicParents)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Tài liệu tư vấn / Kiến thức cơ sở (Tùy chọn):</label>
        <textarea
          value={newTopicImage}
          onChange={(e) => setNewTopicImage(e.target.value)}
          placeholder="Nhập tài liệu tư vấn chi tiết về chủ đề này để trợ lý AI tư vấn chuẩn xác..."
          rows={2}
          className="bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-emerald-500 focus:outline-none rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 transition resize-none"
        />
      </div>

      {topicError && (
        <p className="text-[10px] text-rose-400 font-medium bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">{topicError}</p>
      )}

      <button
        type="button"
        onClick={async () => {
          if (!newTopicName.trim()) {
            setTopicError("Vui lòng điền tên chủ đề.");
            return;
          }
          const kws = newTopicKeywords.split(/[,;]+/).map(k => k.trim().toLowerCase()).filter(Boolean);
          if (kws.length === 0) {
            setTopicError("Vui lòng nhập ít nhất một từ khóa nhận diện.");
            return;
          }
          const res = await addNewTopic(newTopicName, kws, newTopicImage, newTopicParent);
          if (res.success) {
            setNewTopicName("");
            setNewTopicKeywords("");
            setNewTopicImage("");
            setNewTopicParent("");
            setTopicError(null);
            setSyncNotification({ type: "success", message: `Đã thêm thành công chủ đề "${newTopicName}"!` });
            setTimeout(() => setSyncNotification(null), 4000);
          } else {
            setTopicError(res.error || "Có lỗi xảy ra khi thêm chủ đề.");
          }
        }}
        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-1.5 px-3 rounded-lg self-end active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Xác nhận thêm chủ đề</span>
      </button>
    </div>
  );
};

interface TopicSummarizerPanelProps {
  topicKeywords: Record<string, string[]>;
  topicParents: Record<string, string>;
  topicKnowledge: Record<string, string>;
  setTopicKnowledge: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  topicConciseSummaries: Record<string, string>;
  setTopicConciseSummaries: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isConfigsLoaded: boolean;
}

export const TopicSummarizerPanel: React.FC<TopicSummarizerPanelProps> = ({
  topicKeywords,
  topicParents,
  topicKnowledge,
  setTopicKnowledge,
  topicConciseSummaries,
  setTopicConciseSummaries,
  isConfigsLoaded
}) => {
  const [selectedTopic, setSelectedTopic] = useState("Vị trí dự án Nyah Phú Định");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isAutoSummarizing, setIsAutoSummarizing] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info" | null; message: string }>({ type: null, message: "" });

  // Sync with prop when selectedTopic or configs load changes
  useEffect(() => {
    if (topicKnowledge[selectedTopic]) {
      setInputText(topicKnowledge[selectedTopic]);
    } else {
      setInputText("");
    }
    
    if (topicConciseSummaries[selectedTopic]) {
      setOutputText(topicConciseSummaries[selectedTopic]);
    } else {
      setOutputText("");
    }
    setStatus({ type: null, message: "" });
  }, [selectedTopic, isConfigsLoaded]);

  // Debounce sync of inputText back to parent topicKnowledge
  useEffect(() => {
    const timer = setTimeout(() => {
      setTopicKnowledge(prev => {
        if (prev[selectedTopic] === inputText) return prev;
        return {
          ...prev,
          [selectedTopic]: inputText
        };
      });
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [inputText, selectedTopic, setTopicKnowledge]);

  // Debounce sync of outputText back to parent topicConciseSummaries
  useEffect(() => {
    const timer = setTimeout(() => {
      setTopicConciseSummaries(prev => {
        if (prev[selectedTopic] === outputText) return prev;
        return {
          ...prev,
          [selectedTopic]: outputText
        };
      });
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [outputText, selectedTopic, setTopicConciseSummaries]);

  const handleAutoSummarize = async () => {
    if (!inputText.trim()) {
      setStatus({ type: "error", message: "Vui lòng nhập thông tin chi tiết cần tóm tắt." });
      return;
    }

    setIsAutoSummarizing(true);
    setStatus({ type: "info", message: "Đang gọi AI Gemini tóm tắt..." });

    try {
      const response = await fetch("/api/auto-summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText })
      });

      const data = await response.json();
      if (data.success && data.summary) {
        setOutputText(data.summary);
        setStatus({ type: "success", message: "Tóm tắt thành công! Đã lưu." });
      } else if (data.fallback) {
        setOutputText(data.fallback);
        setStatus({
          type: "success",
          message: "Đã sử dụng giải thuật tóm gọn thay thế. Đã lưu."
        });
      } else {
        const words = inputText.replace(/\*\*/g, "").replace(/^Nguồn:\s*[^\n]+\n/gi, "").split(/\s+/).filter(Boolean);
        const fallbackSummary = words.slice(0, 16).join(" ") + (words.length > 16 ? "..." : "");
        setOutputText(fallbackSummary);
        setStatus({
          type: "success",
          message: "Đã sử dụng giải thuật tóm gọn thay thế. Đã lưu."
        });
      }
    } catch (e) {
      console.error(e);
      const words = inputText.replace(/\*\*/g, "").replace(/^Nguồn:\s*[^\n]+\n/gi, "").split(/\s+/).filter(Boolean);
      const fallbackSummary = words.slice(0, 16).join(" ") + (words.length > 16 ? "..." : "");
      setOutputText(fallbackSummary);
      setStatus({
        type: "success",
        message: "Lỗi kết nối AI, sử dụng tóm gọn tự động thay thế. Đã lưu."
      });
    } finally {
      setIsAutoSummarizing(false);
    }
  };

  return (
    <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 backdrop-blur shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1.5 tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          <span>Bộ tóm tắt chủ đề (Dưới 16 từ)</span>
        </span>
        <span className="text-[9px] text-slate-500 font-mono">AI SUMMARIZER</span>
      </div>

      {/* Topic Selector */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-slate-400">Chọn chủ đề dự án:</label>
        <select
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-rose-500 transition cursor-pointer"
        >
          {Object.keys(topicKeywords).map((topicName) => (
            <option key={topicName} value={topicName} className="bg-slate-950">
              {getTopicSelectLabel(topicName, topicParents)}
            </option>
          ))}
        </select>
      </div>

      {/* Input Detailed Knowledge */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-slate-400 flex justify-between items-center">
          <span>Nội dung chi tiết của chủ đề:</span>
          <span className="text-[9px] text-slate-500 font-mono">({inputText.length} ký tự)</span>
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Nhập hoặc dán thông tin chi tiết về chủ đề này vào đây để AI tự động tóm gọn lại..."
          rows={4}
          className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-2 text-[11px] text-white/90 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition resize-none font-sans leading-relaxed"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAutoSummarize}
          disabled={isAutoSummarizing || !inputText.trim()}
          className="flex-1 py-1.5 px-2.5 rounded-xl text-[10px] font-semibold bg-rose-600 hover:bg-rose-500 disabled:bg-slate-900/40 disabled:text-slate-600 border border-transparent disabled:border-slate-800 text-white transition flex items-center justify-center gap-1 cursor-pointer"
        >
          {isAutoSummarizing ? (
            <>
              <span className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Đang tóm gọn...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 text-rose-200" />
              <span>Tóm tắt bằng AI Gemini</span>
            </>
          )}
        </button>
      </div>

      {/* Summary Result Box */}
      <div className="flex flex-col gap-1 border-t border-slate-900/80 pt-2.5">
        <label className="text-[10px] font-semibold text-slate-400 flex justify-between items-center">
          <span>Kết quả tóm tắt (Tối đa 16 từ):</span>
          <span className={`text-[9px] font-mono ${outputText.split(/\s+/).filter(Boolean).length > 16 ? "text-rose-400 font-bold" : "text-slate-500"}`}>
            {outputText.split(/\s+/).filter(Boolean).length} từ
          </span>
        </label>
        <input
          type="text"
          value={outputText}
          onChange={(e) => setOutputText(e.target.value)}
          placeholder="Kết quả tóm tắt tự động xuất hiện ở đây. Anh/chị có thể chỉnh sửa trực tiếp..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-emerald-400 focus:outline-none focus:border-emerald-500 font-medium transition"
        />
      </div>

      {/* Status alerts */}
      {status.message && (
        <div className={`text-[10px] py-1 px-2 rounded-lg flex items-center gap-1.5 ${
          status.type === "success"
            ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50"
            : status.type === "error"
            ? "bg-rose-950/40 text-rose-400 border border-rose-900/50"
            : "bg-blue-950/40 text-blue-400 border border-blue-900/50"
        }`}>
          <span>{status.type === "success" ? "✓" : status.type === "error" ? "⚠" : "ℹ"}</span>
          <span className="font-medium leading-tight">{status.message}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [currentPath, setCurrentPath] = useState<"admin" | "test">(() => {
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    if (hash.includes("admin") || path.includes("admin")) {
      return "admin";
    }
    return "test";
  });

  // Speech Recognition States
  const [isListening, setIsListening] = useState(() => {
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    if (hash.includes("admin") || path.includes("admin")) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    const handleLocationChange = () => {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      if (hash.includes("admin") || path.includes("admin")) {
        setCurrentPath("admin");
      } else {
        setCurrentPath("test");
      }
    };
    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  useEffect(() => {
    if (currentPath === "admin" && isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
      setIsListening(false);
    }
  }, [currentPath, isListening]);

  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [language, setLanguage] = useState("vi-VN");
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  // Image load fallbacks
  const [failedLocalUrls, setFailedLocalUrls] = useState<Record<string, boolean>>({});
  const [imageVersion, setImageVersion] = useState<number>(() => Date.now());

  // Custom topic images state
  const [customTopicImages, setCustomTopicImages] = useState<Record<string, string[]>>(() => {
    try {
      const stored = localStorage.getItem("custom_topic_images");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  // Dynamic scanned folder images from express backend
  const [scannedFolderImages, setScannedFolderImages] = useState<Record<string, string[]>>({});
  const [isConfigsLoaded, setIsConfigsLoaded] = useState<boolean>(false);

  const normalizeName = (str: string): string => {
    if (!str) return "";
    let s = str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accent marks
      .replace(/đ/g, "d");

    // Sửa lỗi chính tả/nhận diện âm tiết tiếng Việt phổ biến (hội thất -> nội thất)
    s = s.replace(/hoi\s*that/g, "noi that")
         .replace(/hoithat/g, "noithat")
         .replace(/doi\s*that/g, "noi that")
         .replace(/doithat/g, "noithat")
         .replace(/nhon\s*that/g, "noi that")
         .replace(/nhonthat/g, "noithat");

    return s
      .replace(/[^a-z0-9]/g, "") // keep only alphanumeric
      .trim();
  };

  const normalizePhrase = (str: string): string => {
    if (!str) return "";
    let s = str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accent marks
      .replace(/đ/g, "d");

    // Sửa lỗi chính tả/nhận diện âm tiết tiếng Việt phổ biến
    s = s.replace(/hoi\s*that/g, "noi that")
         .replace(/hoithat/g, "noithat")
         .replace(/doi\s*that/g, "noi that")
         .replace(/doithat/g, "noithat")
         .replace(/nhon\s*that/g, "noi that")
         .replace(/nhonthat/g, "noithat");

    // Thay thế tất cả các ký tự không phải chữ và số thành khoảng trắng, nhưng giữ khoảng trắng
    s = s.replace(/[^a-z0-9\s]/g, " ");

    // Thu gọn nhiều khoảng trắng thành một khoảng trắng duy nhất
    return s.replace(/\s+/g, " ").trim();
  };

  const lastIndexOfPhrase = (normText: string, normKw: string): number => {
    if (!normText || !normKw) return -1;
    let startPos = 0;
    let lastIdx = -1;
    while (true) {
      const pos = normText.indexOf(normKw, startPos);
      if (pos === -1) break;
      
      const leftOk = pos === 0 || normText[pos - 1] === " ";
      const rightOk = (pos + normKw.length) === normText.length || normText[pos + normKw.length] === " ";
      
      if (leftOk && rightOk) {
        lastIdx = pos;
      }
      startPos = pos + 1;
    }
    return lastIdx;
  };

  const fetchScannedFolderImages = async () => {
    try {
      const response = await fetch("/api/topic-images");
      const data = await response.json();
      if (data.success && data.folders) {
        setScannedFolderImages(data.folders);
        // Khi tải hoặc quét lại thư mục thành công, hãy reset lại danh sách lỗi tải để tệp tin mới nhất có thể hiển thị
        setFailedLocalUrls({});
      }
    } catch (e) {
      console.error("Lỗi khi quét thư mục hình ảnh:", e);
    }
  };

  const updateTopicImages = (topic: string, images: string[]) => {
    setCustomTopicImages((prev) => {
      const updated = { ...prev, [topic]: images };
      try {
        localStorage.setItem("custom_topic_images", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const [activeImageIndexes, setActiveImageIndexes] = useState<Record<string, number>>({});
  const [lastActiveHouseModel, setLastActiveHouseModel] = useState<string>("Mẫu nhà Cosmo Gen 2");

  const getValidTopicImages = (topic: string): string[] => {
    const cleanTopicNoise = (str: string): string => {
      let s = normalizeName(str);
      s = s.replace(/duan/g, "")
           .replace(/maunha/g, "")
           .replace(/chude/g, "")
           .replace(/hinhanh/g, "")
           .replace(/hinh/g, "")
           .replace(/anh/g, "");
      return s;
    };

    const normTopic = normalizeName(topic);
    const cleanTopic = cleanTopicNoise(topic);

    let bestFolderKey = "";
    let highestScore = -1;

    const normTopicLower = normTopic.toLowerCase();

    // Score all available folder keys dynamically
    for (const folderKey of Object.keys(scannedFolderImages)) {
      // Skip empty folders in scannedFolderImages so they don't steal the match from a folder with actual images!
      if (!scannedFolderImages[folderKey] || scannedFolderImages[folderKey].length === 0) {
        continue;
      }

      const normKey = normalizeName(folderKey);
      const cleanKey = cleanTopicNoise(folderKey);
      
      const segments = folderKey.split("/");
      const leafSegment = segments[segments.length - 1];
      const normLeaf = normalizeName(leafSegment);
      const cleanLeaf = cleanTopicNoise(leafSegment);
      
      // Check if there is a match at all
      const hasDirectRelation = normKey.includes(normTopic) || normTopic.includes(normKey) ||
                                cleanKey.includes(cleanTopic) || cleanTopic.includes(cleanKey) ||
                                cleanLeaf.includes(cleanTopic) || cleanTopic.includes(cleanLeaf);
      if (!hasDirectRelation) continue;

      let score = 100;

      // 1. Exact match bonus
      if (normKey === normTopic || cleanKey === cleanTopic) {
        score += 200;
      }

      // 2. Leaf segment match bonus (e.g. "01_NyAh-PhuDinh/Vị trí" -> leaf is "Vị trí")
      if (normLeaf === normTopic || normLeaf.includes(normTopic) || normTopic.includes(normLeaf) ||
          cleanLeaf === cleanTopic || cleanLeaf.includes(cleanTopic) || cleanTopic.includes(cleanLeaf)) {
        score += 300;
      }

      const normKeyLower = normKey.toLowerCase();

      // 3. Smart Category / Keyword Boosting and Penalties
      // 3a. Position (Vị trí)
      if (normTopicLower.includes("vitri") || normTopicLower.includes("bando") || normTopicLower.includes("duongdi")) {
        if (normKeyLower.includes("vitri")) {
          score += 2000; // Tăng cực mạnh để thắng tất cả
        } else {
          score -= 1500; // Phạt cực mạnh các folder không phải vị trí
        }
      }

      // 3b. Inner vs Outer Amenities / Amenities in General
      if (normTopicLower.includes("tienich") || normTopicLower.includes("ngoaikhu") || normTopicLower.includes("xungquanh") || normTopicLower.includes("noikhu")) {
        if (normKeyLower.includes("tienich") || normKeyLower.includes("xungquanh") || normKeyLower.includes("ngoaikhu") || normKeyLower.includes("noikhu")) {
          score += 2000;
        } else {
          score -= 1500;
        }
      }

      // 3c. Specific House Models matching
      if (normTopicLower.includes("cosmogen2") || normTopicLower.includes("cosmo2")) {
        if (normKeyLower.includes("cosmogen2") || normKeyLower.includes("cosmo2") || (normKeyLower.includes("cosmo") && normKeyLower.includes("gen2"))) {
          score += 800;
        } else if (normKeyLower.includes("fusion") || normKeyLower.includes("opus") || normKeyLower.includes("signature")) {
          score -= 1000;
        }
      } else if (normTopicLower.includes("fusion")) {
        if (normKeyLower.includes("fusion")) {
          score += 800;
        } else if (normKeyLower.includes("cosmo") || normKeyLower.includes("opus") || normKeyLower.includes("signature")) {
          score -= 1000;
        }
      } else if (normTopicLower.includes("opus")) {
        if (normKeyLower.includes("opus")) {
          score += 800;
        } else if (normKeyLower.includes("cosmo") || normKeyLower.includes("fusion") || normKeyLower.includes("signature")) {
          score -= 1000;
        }
      }

      // 3d. Active house model context check from user chat!
      // Tuyệt đối KHÔNG cộng điểm này cho chủ đề chung (vị trí, tiện ích, pháp lý, tổng quan dự án) để tránh bị kéo sang phòng bếp/phòng ngủ!
      const isGeneralTopic = normTopicLower.includes("vitri") || 
                             normTopicLower.includes("bando") || 
                             normTopicLower.includes("tienich") || 
                             normTopicLower.includes("ngoaikhu") || 
                             normTopicLower.includes("xungquanh") || 
                             normTopicLower.includes("noikhu") || 
                             normTopicLower.includes("phaply") || 
                             normTopicLower.includes("sohong") ||
                             normTopicLower.includes("banggia") ||
                             normTopicLower.includes("duannyahphudinh") ||
                             normTopicLower === "nyahphudinh";

      if (lastActiveHouseModel && !isGeneralTopic) {
        const normModel = normalizeName(lastActiveHouseModel);
        
        let modelKeywords: string[] = [];
        if (normModel.includes("cosmogen2") || normModel.includes("cosmo2")) {
          modelKeywords = ["cosmogen2", "cosmo", "gen2"];
        } else if (normModel.includes("cosmogen1") || normModel.includes("cosmo1")) {
          modelKeywords = ["cosmogen1", "cosmo", "gen1"];
        } else if (normModel.includes("fusion")) {
          modelKeywords = ["fusion"];
        } else if (normModel.includes("cosmo")) {
          modelKeywords = ["cosmo"];
        }

        const folderHasModelKeywords = modelKeywords.some(kw => normKey.includes(kw));
        if (folderHasModelKeywords) {
          score += 1000; // HUGE bonus to prioritize the correct model's subfolder!
        }
      }

      // 4. Prefer deeper, more descriptive paths
      score += segments.length * 10;

      if (score > highestScore) {
        highestScore = score;
        bestFolderKey = folderKey;
      }
    }

    const matchedFolderKey = bestFolderKey;

    let candidates: string[] = [];
    let isFromFolder = false;

    // ƯU TIÊN 1 TUYỆT ĐỐI: Ảnh trong thư mục quét cục bộ (do người dùng tải lên)
    if (matchedFolderKey && scannedFolderImages[matchedFolderKey] && scannedFolderImages[matchedFolderKey].length > 0) {
      const validScanned = scannedFolderImages[matchedFolderKey].filter(url => {
        const cleanUrl = url.split("?")[0];
        return !failedLocalUrls[cleanUrl];
      });
      
      if (validScanned.length > 0) {
        candidates = validScanned;
        isFromFolder = true;
      }
    }

    // Ưu tiên 2: Ảnh tùy chỉnh thủ công (nếu có - đối chiếu không phân biệt hoa thường và dấu)
    if (candidates.length === 0) {
      const normTopic = normalizeName(topic);
      const matchedKey = Object.keys(customTopicImages).find(k => normalizeName(k) === normTopic);
      if (matchedKey && customTopicImages[matchedKey] && customTopicImages[matchedKey].length > 0) {
        candidates = customTopicImages[matchedKey];
      }
    } 

    // Ưu tiên 3: Fallback về ảnh khai báo sẵn trong LOCAL_TOPIC_IMAGES (đối chiếu không phân biệt hoa thường và dấu)
    if (candidates.length === 0) {
      const normTopic = normalizeName(topic);
      const matchedKey = Object.keys(LOCAL_TOPIC_IMAGES).find(k => normalizeName(k) === normTopic);
      if (matchedKey && LOCAL_TOPIC_IMAGES[matchedKey] && LOCAL_TOPIC_IMAGES[matchedKey].length > 0) {
        candidates = LOCAL_TOPIC_IMAGES[matchedKey];
      }
    }

    // Lọc thông minh cho chủ đề Tổng quan Dự án
    if (cleanTopic === "nyahphudinh" && candidates.length > 0) {
      candidates = candidates.filter(url => {
        const urlLower = url.toLowerCase();
        return !urlLower.includes("noi-that-nha-bep") &&
               !urlLower.includes("noi-that-phong-ngu") &&
               !urlLower.includes("noi-that-phong-khach") &&
               !urlLower.includes("noi-that-phong-tam") &&
               !urlLower.includes("mau-nha-cosmo-gen-2") &&
               !urlLower.includes("mau-nha-fusion-gen-5") &&
               !urlLower.includes("goi-ban-giao-air-max") &&
               !urlLower.includes("phuong-thuc-thanh-toan") &&
               !urlLower.includes("bang-gia-ro-hang") &&
               !urlLower.includes("phap-ly-so-hong");
      });
      if (candidates.length === 0) {
        candidates = ["/images/Nyah-Phu-Dinh/tien-ich-noi-khu/tien-ich-noi-khu.jpg"];
      }
    }

    if (!candidates || candidates.length === 0) return [];

    // CHỈ CHẤP NHẬN HÌNH ẢNH TRONG THƯ MỤC CUNG CẤP HOẶC CÁC HÌNH ẢNH DO NGƯỜI DÙNG TỰ ĐƯA LÊN (data:image/ hoặc blob:)
    // Tuyệt đối không sử dụng Unsplash hay tự ý vẽ hình mới bằng AI
    const localCandidates = candidates.filter(url => 
      url.startsWith("/images/") || 
      url.startsWith("images/") || 
      url.startsWith("data:image/") ||
      url.startsWith("blob:")
    );
    
    const uniqueList: string[] = [];
    const seenBases = new Set<string>();
    
    for (const url of localCandidates) {
      const cleanUrl = url.split("?")[0];
      // Bỏ qua nếu là tệp cục bộ và đã từng bị lỗi tải
      if (failedLocalUrls[cleanUrl]) {
        continue;
      }

      const lastDot = url.lastIndexOf(".");
      const base = lastDot !== -1 ? url.substring(0, lastDot) : url;
      if (!seenBases.has(base)) {
        seenBases.add(base);
        uniqueList.push(url);
      }
    }

    return uniqueList;
  };

  const hasTopicImage = (topic: string): boolean => {
    return getValidTopicImages(topic).length > 0;
  };

  // Helper to find the working local image candidate at the active index for the topic
  const getLocalTopicImage = (topic: string): string | null => {
    const validImages = getValidTopicImages(topic);
    if (validImages.length === 0) return null;
    const activeIdx = activeImageIndexes[topic] || 0;
    const safeIndex = (activeIdx % validImages.length + validImages.length) % validImages.length;
    const found = validImages[safeIndex];
    if (found) {
      if (found.startsWith("/")) {
        return `${found}?v=${imageVersion}`;
      }
      return found;
    }
    return null;
  };

  const handlePrevImage = (topic: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const validImages = getValidTopicImages(topic);
    if (validImages.length <= 1) return;
    setActiveImageIndexes((prev) => {
      const currentIdx = prev[topic] || 0;
      const nextIdx = (currentIdx - 1 + validImages.length) % validImages.length;
      return { ...prev, [topic]: nextIdx };
    });
  };

  const handleNextImage = (topic: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const validImages = getValidTopicImages(topic);
    if (validImages.length <= 1) return;
    setActiveImageIndexes((prev) => {
      const currentIdx = prev[topic] || 0;
      const nextIdx = (currentIdx + 1) % validImages.length;
      return { ...prev, [topic]: nextIdx };
    });
  };

  const handleSelectImageIndex = (topic: string, index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveImageIndexes((prev) => ({
      ...prev,
      [topic]: index
    }));
  };

  // Application logic States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [customAiImage, setCustomAiImage] = useState<string | null>(null);
  const [aiImageLoading, setAiImageLoading] = useState(false);
  const [aiImageError, setAiImageError] = useState<string | null>(null);

  // API Key Check States & Functions
  const [apiKeysStatus, setApiKeysStatus] = useState<{
    gemini?: { configured: boolean; masked: string; length: number };
    routes?: { configured: boolean; masked: string; length: number };
  } | null>(null);
  const [isCheckingKeys, setIsCheckingKeys] = useState(false);
  const [routesTestAddress, setRoutesTestAddress] = useState("Chợ Bến Thành");
  const [routesTestResult, setRoutesTestResult] = useState<{
    success: boolean;
    distance?: string;
    duration?: string;
    error?: string;
    rawResponse?: any;
  } | null>(null);
  const [isTestingRoutes, setIsTestingRoutes] = useState(false);
  const [showApiPanel, setShowApiPanel] = useState(false);

  const checkApiKeys = async () => {
    setIsCheckingKeys(true);
    try {
      const response = await fetch("/api/check-keys");
      const data = await response.json();
      setApiKeysStatus(data);
    } catch (e) {
      console.error("Lỗi khi kiểm tra API keys:", e);
    } finally {
      setIsCheckingKeys(false);
    }
  };

  const testRoutesApi = async (destination: string) => {
    setIsTestingRoutes(true);
    setRoutesTestResult(null);
    try {
      const response = await fetch("/api/test-routes-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination }),
      });
      const data = await response.json();
      setRoutesTestResult(data);
    } catch (e: any) {
      setRoutesTestResult({
        success: false,
        error: e.message || "Gặp sự cố khi kết nối mạng đến máy chủ.",
      });
    } finally {
      setIsTestingRoutes(false);
    }
  };

  // Auto-polling folder structure every 4 seconds to instantly pick up manual disk changes (images, folders)
  useEffect(() => {
    checkApiKeys();
    fetchScannedFolderImages();

    const folderPollingInterval = setInterval(() => {
      fetchScannedFolderImages();
    }, 4000);

    return () => clearInterval(folderPollingInterval);
  }, []);

  // States for seamless image preloading (to prevent flickering)
  const [displayedTopic, setDisplayedTopic] = useState<string>("Vị trí dự án Nyah Phú Định");
  const [displayedAnalysis, setDisplayedAnalysis] = useState<AnalysisResult | null>(() => lookupDefaultAnalysis("Vị trí dự án Nyah Phú Định"));
  const [isPreloading, setIsPreloading] = useState<boolean>(false);
  const [isRegularAutoPlay, setIsRegularAutoPlay] = useState<boolean>(true);
  const [isCurrentImageLoaded, setIsCurrentImageLoaded] = useState<boolean>(true);

  // Interactive routing and distance measuring states (using text-based Route API logic overlay)
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [searchDestination, setSearchDestination] = useState<string>("");
  const [travelMode, setTravelMode] = useState<"DRIVING" | "WALKING">("DRIVING");
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isMapPanelExpanded, setIsMapPanelExpanded] = useState<boolean>(true);
  const [customDestinationsHistory, setCustomDestinationsHistory] = useState<{ name: string; query: string; distance: string; time: string }[]>([]);

  const addCustomDestinationToHistory = (name: string, query: string, distance: string = "Đang đo...", time: string = "Đang đo...") => {
    if (!name || name.trim() === "") return;
    setCustomDestinationsHistory(prev => {
      const exists = prev.some(item => item.name.toLowerCase() === name.toLowerCase() || item.query.toLowerCase() === query.toLowerCase());
      if (exists) {
        return prev.map(item => {
          if (item.name.toLowerCase() === name.toLowerCase() || item.query.toLowerCase() === query.toLowerCase()) {
            return {
              ...item,
              distance: distance !== "Đang đo..." && distance !== "Đang tính..." ? distance : item.distance,
              time: time !== "Đang đo..." && time !== "Đang tính..." ? time : item.time
            };
          }
          return item;
        });
      }
      return [{ name, query, distance, time }, ...prev];
    });
  };

  // Simulation & Manual Input States
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const [showTransitionTester, setShowTransitionTester] = useState<boolean>(true);
  const [showKeywords, setShowKeywords] = useState(true);
  const [showSubtitlesConfig, setShowSubtitlesConfig] = useState(true);
  const [showSecondLevelConfig, setShowSecondLevelConfig] = useState(false);
  const [newSubtitleKeyword, setNewSubtitleKeyword] = useState("");
  const [newSubtitleText, setNewSubtitleText] = useState("");
  
  // Editing states for 2nd-level keywords
  const [editingSubId, setEditingSubId] = useState<string | null>(null);

  const [isPresentationMode, setIsPresentationMode] = useState<boolean>(false);

  // 2nd-level keywords configuration state
  const [secondLevelKeywords, setSecondLevelKeywords] = useState<SecondLevelKeyword[]>(() => {
    const defaults: SecondLevelKeyword[] = [
      {
        id: "sub-1",
        parentTopic: "Nội thất nhà bếp",
        keyword: "bàn ăn nhanh",
        caption: "Bàn ăn nhanh tinh tế nối liền đảo bếp, là nơi lý tưởng cho những bữa ăn nhanh hoặc nhâm nhi cafe.",
        imageUrl: "/images/Nyah-Phu-Dinh/mau-nha-cosmo-gen-2/noi-that-nha-bep/ban-an-nhanh/ban-an-nhanh.jpg"
      },
      {
        id: "sub-2",
        parentTopic: "Nội thất nhà bếp",
        keyword: "bếp fullsize",
        caption: "Hệ tủ bếp hỗ trợ thiết bị fullsize như tủ lạnh side-by-side, máy rửa bát và lò nướng âm tủ.",
        imageUrl: "/images/Nyah-Phu-Dinh/mau-nha-cosmo-gen-2/noi-that-nha-bep/bep-fullsize/thiet-bi-fullsize.png"
      },
      {
        id: "sub-3",
        parentTopic: "Nội thất nhà bếp",
        keyword: "giặt sấy",
        caption: "Khu vực giặt sấy tiện ích tích hợp ngay cạnh bếp giúp tối ưu hóa không gian sống.",
        imageUrl: "/images/Nyah-Phu-Dinh/mau-nha-cosmo-gen-2/noi-that-nha-bep/giat-say-tai-bep/giat-say-tai-bep.jpg"
      },
      {
        id: "sub-4",
        parentTopic: "Nội thất nhà bếp",
        keyword: "trạm sinh hoạt",
        caption: "Trạm sinh hoạt liên mạch thiết kế tinh xảo, tạo điểm nhấn ấm cúng cho cả gia đình.",
        imageUrl: "/images/Nyah-Phu-Dinh/mau-nha-cosmo-gen-2/noi-that-nha-bep/tram-sinh-hoat/tram-sinh-hoat-lien-mach.jpg"
      },
      {
        id: "sub-5",
        parentTopic: "Nội thất nhà bếp",
        keyword: "bàn ăn chậm",
        caption: "Không gian bàn ăn lớn sang trọng dành cho những bữa cơm ấm áp, gắn kết gia đình trọn vẹn.",
        imageUrl: "/images/Nyah-Phu-Dinh/mau-nha-cosmo-gen-2/noi-that-nha-bep/ban-an-cham/ban-an-cham.jpg"
      }
    ];
    try {
      const stored = localStorage.getItem("second_level_keywords_mapping");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    return defaults;
  });

  // Real-time second level keywords with transition delay (parent topic first, then sub config)
  const [activeSubConfigWithDelay, setActiveSubConfigWithDelay] = useState<SecondLevelKeyword | null>(null);
  const [testActiveTopic, setTestActiveTopic] = useState<string | null>(null);
  const [testActiveSubConfig, setTestActiveSubConfig] = useState<SecondLevelKeyword | null>(null);
  const [isAutoTransitionDemo, setIsAutoTransitionDemo] = useState<boolean>(false);
  const [demoSlideIndex, setDemoSlideIndex] = useState<number>(0);
  const lastSubConfigIdRef = useRef<string | null>(null);
  const subConfigTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTopicRef = useRef<string | null>(null);
  const tvContainerRef = useRef<HTMLDivElement>(null);

  const addSecondLevelKeyword = (parentTopic: string, keyword: string, caption: string, imageUrl: string) => {
    if (!parentTopic.trim() || !keyword.trim() || !caption.trim()) return false;
    const newConfig: SecondLevelKeyword = {
      id: "sub-" + Date.now(),
      parentTopic: parentTopic.trim(),
      keyword: keyword.trim(),
      caption: caption.trim(),
      imageUrl: imageUrl.trim()
    };
    setSecondLevelKeywords((prev) => {
      const updated = [...prev, newConfig];
      try {
        localStorage.setItem("second_level_keywords_mapping", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    setExpandedTopics((prev) => ({
      ...prev,
      [parentTopic.trim()]: true
    }));
    return true;
  };

  const removeSecondLevelKeyword = (id: string) => {
    setSecondLevelKeywords((prev) => {
      const updated = prev.filter(item => item.id !== id);
      try {
        localStorage.setItem("second_level_keywords_mapping", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const updateSecondLevelKeyword = (id: string, parentTopic: string, keyword: string, caption: string, imageUrl: string) => {
    if (!parentTopic.trim() || !keyword.trim() || !caption.trim()) return false;
    setSecondLevelKeywords((prev) => {
      const updated = prev.map(item => item.id === id ? {
        ...item,
        parentTopic: parentTopic.trim(),
        keyword: keyword.trim(),
        caption: caption.trim(),
        imageUrl: imageUrl.trim()
      } : item);
      try {
        localStorage.setItem("second_level_keywords_mapping", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    return true;
  };

  const getFullConversationTextForMatching = (): string => {
    let text = transcript + " " + interimTranscript;
    if (appMode === "chatbot" && chatMessages.length > 0) {
      // Get last user message and bot response
      const lastMessages = chatMessages.slice(-2).map(m => m.text).join(" ");
      text = lastMessages + " " + text;
    }
    return text;
  };

  const getActiveSecondLevelConfig = (parentTopic: string): SecondLevelKeyword | null => {
    if (!parentTopic) return null;
    const fullText = getFullConversationTextForMatching();
    const normFullText = normalizePhrase(fullText);
    if (!normFullText) return null;

    // Chỉ tìm kiếm từ khóa lớp 2 trong khoảng 400 ký tự cuối của cuộc trò chuyện để tránh bị kẹt ở quá khứ
    const windowSize = 400;
    const recentText = normFullText.length > windowSize ? normFullText.slice(-windowSize) : normFullText;
    
    // Filter configs that belong to this parentTopic
    const matchingConfigs = secondLevelKeywords.filter(
      cfg => normalizeName(cfg.parentTopic) === normalizeName(parentTopic)
    );
    
    if (matchingConfigs.length === 0) return null;
    
    let activeConfig: SecondLevelKeyword | null = null;
    let latestIndex = -1;
    
    matchingConfigs.forEach(cfg => {
      // Split by comma to support multiple alternate keywords (e.g. "bàn ăn nhanh, ăn nhanh")
      const subKeywords = cfg.keyword.split(",").map(k => k.trim()).filter(Boolean);
      subKeywords.forEach(subKw => {
        const normKw = normalizePhrase(subKw);
        if (!normKw) return;
        const idx = recentText.lastIndexOf(normKw);
        if (idx !== -1 && idx > latestIndex) {
          latestIndex = idx;
          activeConfig = cfg;
        }
      });
    });
    
    return activeConfig;
  };

  const findAnyMatchedSecondLevelConfig = (): SecondLevelKeyword | null => {
    const fullText = getFullConversationTextForMatching();
    const normFullText = normalizePhrase(fullText);
    if (!normFullText) return null;

    // Chỉ tìm kiếm từ khóa lớp 2 trong khoảng 400 ký tự cuối của cuộc trò chuyện để tránh bị kẹt ở quá khứ
    const windowSize = 400;
    const recentText = normFullText.length > windowSize ? normFullText.slice(-windowSize) : normFullText;
    
    let activeConfig: SecondLevelKeyword | null = null;
    let latestIndex = -1;
    
    secondLevelKeywords.forEach(cfg => {
      // Split by comma to support multiple alternate keywords
      const subKeywords = cfg.keyword.split(",").map(k => k.trim()).filter(Boolean);
      subKeywords.forEach(subKw => {
        const normKw = normalizePhrase(subKw);
        if (!normKw) return;
        const idx = recentText.lastIndexOf(normKw);
        if (idx !== -1 && idx > latestIndex) {
          latestIndex = idx;
          activeConfig = cfg;
        }
      });
    });
    
    return activeConfig;
  };

  const getFlattenedScannedImages = (): string[] => {
    const list: string[] = [];
    Object.values(scannedFolderImages).forEach((urls) => {
      if (Array.isArray(urls)) {
        urls.forEach((url) => {
          if (!list.includes(url)) {
            list.push(url);
          }
        });
      }
    });
    return list;
  };

  // Custom subtitles based on specific spoken keywords
  const [subtitleKeywords, setSubtitleKeywords] = useState<Record<string, string>>(() => {
    const defaults = {
      "bếp": "Thiết kế không gian bếp hiện đại, trang bị đầy đủ tủ bếp An Cường cao cấp và hệ thống thông minh.",
      "tủ bếp": "Hệ tủ bếp kịch trần phủ lớp Acrylic bóng gương An Cường cao cấp, chống ẩm mốc trọn đời.",
      "đá marble": "Mặt bếp hoàn thiện bằng đá Granite/Marble Tây Ban Nha dày 18mm chống trầy xước và chịu lực nén cực tốt.",
      "6 tầng": "Mẫu Cosmo Gen 2 kết cấu lên đến 6 tầng (1 trệt, 1 lửng, 3 lầu, 1 tầng đa năng) tối ưu không gian sử dụng.",
      "thang máy": "Tích hợp sẵn hố thang máy kính cường lực nhập khẩu nguyên chiếc tải trọng 450kg cực kỳ êm ái.",
      "giếng trời": "Giếng trời thông tầng rộng 7m² đón gió tự nhiên giúp đối lưu không khí trong lành suốt 24h.",
      "sổ hồng riêng": "Cam kết bàn giao sổ hồng riêng sở hữu lâu dài từng căn, pháp lý hoàn chỉnh tuyệt đối 100%.",
      "chợ rẫy": "Khoảng cách từ dự án đến Bệnh viện Chợ Rẫy là 6.2 km, thuận tiện di chuyển trong vòng 15 phút.",
      "phí quản lý 0 đồng": "Nhờ công nghệ ByteLife tự động hóa toàn khu, cư dân được hưởng đặc quyền miễn phí quản lý trọn đời.",
      "bảo hành 5 năm": "Cam kết bảo hành kết cấu vững chắc lên đến 5 năm và hỗ trợ kỹ thuật nhanh chóng từ chủ đầu tư Nhã Đạt.",
      "fullsize": "Không gian bếp được thiết kế thông minh hỗ trợ lắp đặt đầy đủ các thiết bị gia dụng fullsize hiện đại.",
      "thiết bị fullsize": "Không gian bếp được thiết kế thông minh hỗ trợ lắp đặt đầy đủ các thiết bị gia dụng fullsize hiện đại.",
      "bếp fullsize": "Không gian bếp được thiết kế thông minh hỗ trợ lắp đặt đầy đủ các thiết bị gia dụng fullsize hiện đại.",
      "giặt sấy tại bếp": "Giặt sấy ngay tại bếp vô cùng tiện lợi, tối ưu diện tích và thuận tiện cho sinh hoạt hàng ngày.",
      "giặt sấy ở bếp": "Giặt sấy ngay tại bếp vô cùng tiện lợi, tối ưu diện tích và thuận tiện cho sinh hoạt hàng ngày.",
      "giặt sấy trong bếp": "Giặt sấy ngay tại bếp vô cùng tiện lợi, tối ưu diện tích và thuận tiện cho sinh hoạt hàng ngày.",
      "giặt sấy": "Giặt sấy ngay tại bếp vô cùng tiện lợi, tối ưu diện tích và thuận tiện cho sinh hoạt hàng ngày."
    };
    try {
      const stored = localStorage.getItem("subtitle_keywords_mapping");
      if (stored) {
        return { ...defaults, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error(e);
    }
    return defaults;
  });

  const addSubtitleKeyword = (keyword: string, subtitle: string) => {
    const cleanKw = keyword.trim().toLowerCase();
    if (!cleanKw || !subtitle.trim()) return false;
    setSubtitleKeywords((prev) => {
      const updated = { ...prev, [cleanKw]: subtitle.trim() };
      try {
        localStorage.setItem("subtitle_keywords_mapping", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    return true;
  };

  const removeSubtitleKeyword = (keyword: string) => {
    setSubtitleKeywords((prev) => {
      const updated = { ...prev };
      delete updated[keyword.toLowerCase().trim()];
      try {
        localStorage.setItem("subtitle_keywords_mapping", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const getDynamicSubtitle = (truncateToTenWords: boolean = false): string => {
    const fullText = (transcript + interimTranscript).toLowerCase();
    let result = "";

    // 1. Prioritize active 2nd-level keyword caption for the displayed topic (only if image didn't fail)
    const activeSubConfig = activeSubConfigWithDelay;
    let isSubConfigImageValid = true;
    if (activeSubConfig && activeSubConfig.imageUrl) {
      const cleanSubUrl = activeSubConfig.imageUrl.split("?")[0];
      if (failedLocalUrls[cleanSubUrl]) {
        isSubConfigImageValid = false;
      }
    }

    if (activeSubConfig && isSubConfigImageValid) {
      result = activeSubConfig.caption;
    } else if (fullText) {
      // Find the most recently mentioned subtitle keyword
      let activeSubtitle: string | null = null;
      let latestIndex = -1;

      (Object.entries(subtitleKeywords) as [string, string][]).forEach(([kw, sentence]) => {
        const kwLower = kw.toLowerCase().trim();
        if (!kwLower) return;
        const idx = fullText.lastIndexOf(kwLower);
        if (idx !== -1 && idx > latestIndex) {
          latestIndex = idx;
          activeSubtitle = sentence;
        }
      });

      if (activeSubtitle) {
        result = activeSubtitle;
      }
    }

    if (!result) return "";

    if (truncateToTenWords) {
      const words = result.trim().split(/\s+/).filter(Boolean);
      if (words.length > 10) {
        return words.slice(0, 10).join(" ") + " ...";
      }
    }

    return result;
  };

  const [topicConciseSummaries, setTopicConciseSummaries] = useState<Record<string, string>>(() => {
    const defaults = {
      "Vị trí dự án Nyah Phú Định": "Trương Đình Hội, kết nối Võ Văn Kiệt 3 phút.",
      "Tiện ích xung quanh": "Gần Aeon Mall, siêu thị CoopMart và chợ Phú Định.",
      "Mẫu nhà Cosmo Gen 2": "Nhà phố thông minh 6 tầng sử dụng 250m².",
      "Nội thất nhà bếp": "Bếp chữ L kịch trần, gỗ MDF chống ẩm cao cấp.",
      "Nội thất phòng ngủ": "Phòng ngủ ấm cúng, tối ưu ánh sáng tự nhiên.",
      "Nội thất phòng khách": "Sofa chữ I, vách tivi đá sang trọng tinh tế.",
      "Nội thất phòng tắm": "Vách kính ngăn nước, thiết bị vệ sinh cao cấp."
    };
    try {
      const stored = localStorage.getItem("topic_concise_summaries_list");
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaults, ...parsed };
      }
    } catch (e) {
      console.error(e);
    }
    return defaults;
  });

  useEffect(() => {
    try {
      localStorage.setItem("topic_concise_summaries_list", JSON.stringify(topicConciseSummaries));
    } catch (e) {
      console.error(e);
    }
  }, [topicConciseSummaries]);

  const getSuperConciseSubtitle = (topic: string, analysis: any): string => {
    // If there is an active 2nd-level keyword/sub-config matching this topic, prioritize its caption (câu nói tâm đắc)
    const finalSub = testActiveTopic ? testActiveSubConfig : activeSubConfigWithDelay;
    if (finalSub && finalSub.parentTopic === topic && finalSub.caption) {
      return finalSub.caption;
    }

    if (topic && topicConciseSummaries[topic]) {
      return topicConciseSummaries[topic];
    }

    let text = getDynamicSubtitle(false);
    if (!text && analysis) {
      text = analysis.slideSuggestion || analysis.summary || "";
    }

    if (!text) {
      return "Bất động sản dòng tiền, kinh doanh mặt tiền An Dương Vương";
    }

    // Strip markdown bold and other characters
    text = text.replace(/\*\*/g, "").trim();
    if (text.startsWith("- ")) {
      text = text.substring(2).trim();
    } else if (text.startsWith("-")) {
      text = text.substring(1).trim();
    }

    // Trim to exactly 10 words
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 10) {
      return words.slice(0, 10).join(" ");
    }
    return words.join(" ");
  };

  // States for Chatbot mode matching user's screenshot
  const [appMode, setAppMode] = useState<"chatbot" | "dashboard">("dashboard");
  const [chatInput, setChatInput] = useState("");
  const [isChatResponding, setIsChatResponding] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem("chatbot_messages_list");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: "init",
        sender: "bot",
        text: "Xin chào quý khách. Tôi là trợ lý ảo của dự án Nyah Phú Định từ chủ đầu tư Nhã Đạt. Quý khách đang quan tâm đến thông tin nào của dự án ạ?",
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      }
    ];
  });

  // States for custom topics
  const [deletedTopics, setDeletedTopics] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("deleted_topics");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const [topicParents, setTopicParents] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem("topic_parents");
      return stored ? JSON.parse(stored) : {
        "Vị trí dự án Nyah Phú Định": "Dự án Nyah Phú Định",
        "Tiện ích xung quanh": "Dự án Nyah Phú Định",
        "Mẫu nhà Cosmo Gen 2": "Dự án Nyah Phú Định",
        "Mẫu nhà Fusion Gen 5": "Dự án Nyah Phú Định",
        "Nội thất nhà bếp": "Mẫu nhà Cosmo Gen 2",
        "Nội thất phòng ngủ": "Mẫu nhà Cosmo Gen 2",
        "Nội thất phòng khách": "Mẫu nhà Cosmo Gen 2",
        "Nội thất phòng tắm": "Mẫu nhà Cosmo Gen 2"
      };
    } catch (e) {
      return {};
    }
  });
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({
    "Dự án Nyah Phú Định": true,
    "Mẫu nhà Cosmo Gen 2": true,
    "Mẫu nhà Fusion Gen 5": true,
    "Vị trí dự án Nyah Phú Định": true,
    "Tiện ích xung quanh": true,
    "Nội thất nhà bếp": true,
    "Nội thất phòng ngủ": true,
    "Nội thất phòng khách": true,
    "Nội thất phòng tắm": true,
  });

  const expandAllTopics = () => {
    const updated: Record<string, boolean> = {};
    Object.keys(topicKeywords).forEach((key) => {
      updated[key] = true;
    });
    setExpandedTopics(updated);
  };

  const collapseAllTopics = () => {
    const updated: Record<string, boolean> = {};
    Object.keys(topicKeywords).forEach((key) => {
      updated[key] = false;
    });
    setExpandedTopics(updated);
  };

  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [syncNotification, setSyncNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const getCoverImageSrc = (): string => {
    // Thử lấy ảnh cục bộ cho "Vị trí dự án Nyah Phú Định"
    const posImages = getValidTopicImages("Vị trí dự án Nyah Phú Định");
    if (posImages.length > 0) return posImages[0];
    
    // Thử lấy bất kỳ ảnh cục bộ nào trong các thư mục quét được
    for (const key of Object.keys(scannedFolderImages)) {
      const images = scannedFolderImages[key];
      if (images && images.length > 0) {
        return images[0];
      }
    }
    // Trả về mặc định dự phòng nếu không có ảnh nào được tải lên
    return "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=50&w=600";
  };

  const getTopicHierarchyPath = (topic: string): string[] => {
    const path: string[] = [];
    let current = topic;
    const visited = new Set<string>();
    while (current && topicParents[current]) {
      const parent = topicParents[current];
      if (visited.has(parent)) break;
      visited.add(parent);
      path.push(parent);
      current = parent;
    }
    return path.reverse();
  };

  // Input state for custom keywords
  const [newKeywordInputs, setNewKeywordInputs] = useState<Record<string, string>>({});

  // History / Timeline Session
  const [savedSessions, setSavedSessions] = useState<SavedTopicSession[]>(() => {
    try {
      const stored = localStorage.getItem("saved_conversation_sessions");
      if (!stored) return [];
      const parsed = JSON.parse(stored) as SavedTopicSession[];
      const seenIds = new Set<string>();
      return parsed.map((item, index) => {
        let uniqueId = item.id;
        if (!uniqueId || seenIds.has(uniqueId)) {
          uniqueId = `session_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`;
        }
        seenIds.add(uniqueId);
        return { ...item, id: uniqueId };
      });
    } catch {
      return [];
    }
  });
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);

  // Analysis mode: 'ai' (Gemini) or 'heuristic' (instant robust matching)
  const [analysisMode, setAnalysisMode] = useState<"ai" | "heuristic">("ai");

  // Effect to automatically persist conversation logs
  useEffect(() => {
    safeSaveToLocalStorage("saved_conversation_sessions", JSON.stringify(savedSessions));
  }, [savedSessions]);

  // Dynamic system-learned keywords for each of the 3 topics
  const [topicKeywords, setTopicKeywords] = useState<Record<string, string[]>>(() => {
    const defaults = {
      "Dự án Nyah Phú Định": [
        "dự án", "nyah", "nyah phú định", "nhã đạt", "nhadat", "phú định", "an dương vương", "compound", "biệt lập", "shophouse"
      ],
      "Nội thất nhà bếp": [
        "bếp", "nhà bếp", "tủ bếp", "mdf", "acrylic", "melamine", "tủ lạnh", 
        "bồn rửa", "nấu ăn", "nội thất bếp", "bàn ăn", "hút mùi", "lò vi sóng"
      ],
      "Mẫu nhà Cosmo Gen 2": [
        "cosmo", "gen 2", "diện tích", "5m", "9m", "5x9", "250m", "kết cấu", 
        "6 tầng", "trệt", "lửng", "3 lầu", "tầng", "móng", "thiết kế xây dựng", "mẫu nhà", "đất", "quy mô"
      ],
      "Mẫu nhà Fusion Gen 5": [
        "fusion", "gen 5", "bán tải", "master", "sân thượng", "phòng master", "thang biến hóa", "fusion gen 5", "phục vụ xe bán tải"
      ],
      "Vị trí dự án Nyah Phú Định": [
        "vị trí", "địa chỉ", "bản đồ", "tọa độ", "đường đi", "trương đình hội", "phú định", "nyah", 
        "di chuyển", "ngập nước", "kẹt xe", "quận 1", "quận 4", "phú mỹ hưng", "giao thông", "ngập"
      ],
      "Tiện ích xung quanh": [
        "tiện ích", "xung quanh", "ngoại khu", "gần đó", "chợ", "siêu thị", "trường học", 
        "bệnh viện", "aeon mall", "coopmart", "bách hóa xanh", "mega market", 
        "trung tâm thương mại", "tiểu học", "mầm non", "thcs", "tiện ích xung quanh"
      ],
      "Nội thất phòng ngủ": [
        "phòng ngủ", "giường", "giường ngủ", "nệm", "tủ áo", "tủ quần áo", "đầu giường", 
        "rèm cửa", "bàn trang điểm", "táp đầu giường", "chăn ga", "máy lạnh phòng ngủ"
      ],
      "Nội thất phòng khách": [
        "phòng khách", "sofa", "ghế tựa", "bàn trà", "kệ tivi", "vách ốp", "thảm", 
        "đèn chùm", "tranh treo tường", "tivi", "salon", "vách ngăn"
      ],
      "Nội thất phòng tắm": [
        "phòng tắm", "nhà vệ sinh", "lavabo", "vòi sen", "bồn tắm", "vách kính", 
        "gạch ốp", "toilet", "bồn cầu", "gương soi", "sen tắm", "vệ sinh"
      ],
      "Chủ đề khác hoặc dự án khác": [
        "chủ đề khác", "dự án khác", "ngoài danh mục", "trò chuyện", "tán gẫu", "vui vẻ", "hỏi thăm",
        "gói hàng", "tìm đồ", "xe máy", "chiếc quạt", "mang về nhà"
      ]
    };

    try {
      const stored = localStorage.getItem("topic_keywords_learned");
      const deletedStored = localStorage.getItem("deleted_topics");
      const deleted: string[] = deletedStored ? JSON.parse(deletedStored) : [];
      
      let merged = defaults;
      if (stored) {
        const parsed = JSON.parse(stored);
        merged = { ...defaults, ...parsed };
      }
      
      const filtered: Record<string, string[]> = {};
      Object.entries(merged).forEach(([k, v]) => {
        if (!deleted.includes(k)) {
          filtered[k] = v;
        }
      });
      return filtered;
    } catch (e) {
      console.error(e);
    }
    return defaults;
  });

  // Generate testable slides dynamically from loaded config
  const testableSlides = useMemo(() => {
    const slides: { label: string; topic: string; subConfig: SecondLevelKeyword | null }[] = [];
    
    // Add parent topics
    Object.keys(topicKeywords).forEach(topic => {
      slides.push({
        label: topic,
        topic,
        subConfig: null
      });
    });

    // Add second level keywords
    secondLevelKeywords.forEach(sub => {
      slides.push({
        label: `${sub.parentTopic} → ${sub.caption || sub.keyword.split(',')[0]}`,
        topic: sub.parentTopic,
        subConfig: sub
      });
    });

    return slides;
  }, [topicKeywords, secondLevelKeywords]);

  // Handle auto slideshow timer with intelligent loading protection
  useEffect(() => {
    if (!isAutoTransitionDemo || testableSlides.length === 0 || !isCurrentImageLoaded) return;

    const timerId = setTimeout(() => {
      setDemoSlideIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % testableSlides.length;
        const nextSlide = testableSlides[nextIndex];
        setTestActiveTopic(nextSlide.topic);
        setTestActiveSubConfig(nextSlide.subConfig);
        return nextIndex;
      });
    }, 4500); // 4.5s of loaded display time

    return () => clearTimeout(timerId);
  }, [isAutoTransitionDemo, testableSlides, isCurrentImageLoaded]);

  // Initial trigger for slideshow
  useEffect(() => {
    if (isAutoTransitionDemo && testableSlides.length > 0) {
      const currentSlide = testableSlides[demoSlideIndex % testableSlides.length];
      setTestActiveTopic(currentSlide.topic);
      setTestActiveSubConfig(currentSlide.subConfig);
    }
  }, [isAutoTransitionDemo, testableSlides, demoSlideIndex]);

  const [topicKnowledge, setTopicKnowledge] = useState<Record<string, string>>(() => {
    const defaults = {
      "Dự án Nyah Phú Định": `Nguồn: MASTER KNOWLEDGE BASE T3/2026 - Tổng quan toàn bộ dự án Nyah Phú Định.
- Tên dự án: Ny’ah Phú Định. Chủ đầu tư: Công ty Nhã Đạt (nd).
- Vị trí: 156 An Dương Vương, Phường 16, Quận 8, TP.HCM.
- Quy mô: 50 căn biệt lập compound nhà phố và Shophouse thương mại cao cấp.
- Thiết kế: Signature by Codinachs (Barcelona).
- Đơn vị quản lý vận hành tự động thông minh: Hệ thống ByteLife tiên tiến giúp tối giản chi phí vận hành, đạt mức phí quản lý 0 đồng cho cư dân.`,

      "Nội thất nhà bếp": `Nguồn: MASTER KNOWLEDGE BASE T3/2026 - Phụ lục 1 – v6 & So sánh Gói hoàn thiện AIR/MAX.
- Sàn & Tường: Gạch Porcelain (Vietceramics, Trường Thịnh, Đồng Tâm); Sơn Maxilite/Jotun trắng.
- Hệ thống Điện: Dây dẫn Cadivi đi ngầm; Thiết bị thông minh Zigbee/Wifi; Máy chủ ByteLife (tại Bếp).
- Hệ thống Nước: Ống PPR cấp/PVC thoát (Bình Minh); Bồn nước 1000L & Máy nước nóng NLMT 210L (Đại Thành).
- Thiết bị vệ sinh: Trọn bộ Inax (Lavabo mặt đá granite, vòi sen tắm mưa, bồn cầu, phụ kiện). Vách kính tắm 10mm (Imundex).
- Cửa & Kính: Cửa nhựa Composite (phụ kiện Hafele); Nhôm kính Xingfa 8mm cường lực (phụ kiện Kinlong).
- Máy lạnh (Gói MAX): LG Âm trần cho phòng ngủ; LG Treo tường cho phòng khách và phòng ăn.
- So sánh Gói AIR & MAX:
  + Gói AIR: Bao gồm phần ướt & thiết bị vệ sinh, hệ thống AirTop. KHÔNG bao gồm ByteLife, Thiết bị bếp, Máy lạnh LG, Nội thất rời.
  + Gói MAX: Bao gồm phần ướt, thiết bị vệ sinh, hệ thống AirTop, ByteLife (Máy chủ + Công tắc thông minh), Thiết bị bếp (Sink, bếp từ, hút mùi, lò vi sóng - Ván An Cường, phụ kiện Imundex), Máy lạnh LG (Âm trần & Treo tường). KHÔNG bao gồm nội thất rời (bàn, ghế, giường, tủ thờ, đồ trang trí rời).
- Hệ thống AirTop (Sức khỏe): Lọc bụi mịn từ mái và thổi 9.5 triệu lít khí tươi/ngày giúp không gian sạch mà không cần mở cửa (Mẫu Opus công suất tăng gấp 3).
- Công nghệ ByteLife (Smart Solution): Hơn 30 cảm biến điều khiển thiết bị theo nhịp sinh học và chuyển động. Tối ưu nhân sự bảo vệ & quản lý nội khu, cốt lõi áp dụng Phí quản lý 0 đồng cho cư dân.`,

      "Mẫu nhà Cosmo Gen 2": `Nguồn: MASTER KNOWLEDGE BASE T3/2026 - Phân tích Mẫu nhà (Product Datasheet).
- Cosmo (Gen 2): Kích thước 5m x 9m, kết cấu 5 lầu (Trệt, lửng, 3 lầu, tầng đa năng). Thiết kế "Super Bright" tối ưu ánh sáng; tích hợp sẵn thang máy và 4 phòng ngủ en-suite; Giếng trời "siêu thực" 7m².
- Cosmo (Gen 1): Kích thước 5m x 8.75m, kết cấu 4 lầu (Trệt, lửng, 2 lầu, 1 lầu đa năng). Mặt tiền 5m; Sảnh đón và cổng garage riêng biệt.
- Fusion (Gen 5): Kích thước 4m x 11m, kết cấu 4.5 lầu (Trệt, lửng, 3 lầu, sân thượng). Garage cực đại cho xe bán tải; Thang biến hóa không chia đôi nhà; Phòng ngủ Master chiếm 2/3 chiều dài nhà.
- Opus (Startup): Kích thước 4m x 12.5m, kết cấu 4.5 lầu (Trệt, lửng, 3 lầu, sân thượng). Mô hình 2-in-1: 2 tầng văn phòng Grade A (tải trọng sàn +150%); 4 tầng nhà ở cao cấp; Thang máy lên tận sân thượng. Phù hợp startup công nghệ, livestream, studio, shop online cần văn phòng đạt chuẩn Grade A (tải trọng sàn +150%, lối đi người khuyết tật, thang máy lên sân thượng). Tải trọng sàn Opus tăng thêm 150% so với nhà ở thông thường.
- Office 1 & 2: Tổng 130.2m² (2 căn), kết cấu 7 tầng (Hầm, trệt, lửng + 4 lầu). Khối đế 3 tầng kinh doanh (chịu tải gấp 3 lần thông thường phục vụ Gym/Spa/Showroom) và 4 tầng trên gồm 28-32 căn hộ dịch vụ phong cách Cashmere. Áp dụng cho gói 2 căn Office (32.23 tỷ VNĐ): Cam kết thuê lại tổng giá trị 9.53 tỷ VNĐ trong 7 năm (Tối thiểu cam kết 3-6 năm). Có hầm nước chữa cháy riêng biệt cho các khối thương mại.
- Mật độ: Tất cả các mẫu nhà đều xây dựng với mật độ tối đa theo quy định.`,

      "Mẫu nhà Fusion Gen 5": `Nguồn: MASTER KNOWLEDGE BASE T3/2026 - Phân tích Mẫu nhà Fusion (Gen 5).
- Kích thước: 4m x 11m, kết cấu 4.5 lầu (Trệt, lửng, 3 lầu, sân thượng).
- Các cải tiến vượt trội:
  + Garage cực đại: Thiết kế tối ưu có sức chứa xe bán tải lớn hoặc xe gia đình SUV thoải mái.
  + Thang biến hóa: Hệ thống cầu thang độc đáo giúp không gian lưu thông linh hoạt, không chia đôi căn nhà như lối thiết kế cũ.
  + Phòng ngủ Master: Được ưu ái chiếm đến 2/3 chiều dài sàn nhà, tạo không gian nghỉ ngơi siêu rộng rãi và sang trọng bậc nhất.`,

      "Vị trí dự án Nyah Phú Định": `Nguồn: MASTER KNOWLEDGE BASE T3/2026 - Tổng quan Dự án & Triết lý Phát triển.
- Tên dự án: Ny’ah Phú Định. Chủ đầu tư: Công ty Nhã Đạt (nd).
- Vị trí chiến lược: 156 An Dương Vương, Phường 16, Quận 8, TP.HCM.
- Quy mô: 50 căn (Mã lô từ #01 đến #50), gồm nhà phố Compound biệt lập và Shophouse thương mại.
- Trục lộ chính: Cách Võ Văn Kiệt 1.000m, cận kề Vành Đai 2. Đặc biệt, trục đường Trương Đình Hội (lộ giới 20m) đã hoàn tất xây dựng, kết nối trực tiếp với Nguyễn Văn Linh qua nút giao khác mức.
- Tiến độ bàn giao: Dự kiến năm 2026. Thiết kế bởi Signature by Codinachs (Barcelona).
- Kết nối: 18 phút đến Quận 1; 27 phút đến Quận 2.
- Ngập nước: KHÔNG BỊ NGẬP NƯỚC. Trục đường Trương Đình Hội lộ giới 20m đã hoàn tất xây dựng cao ráo, đồng bộ hạ tầng thoát nước.
- Quy trình pháp lý 4 bước:
  + Bước 1: Giấy chứng nhận quyền sử dụng đất (Sổ đỏ tổng đã sẵn có).
  + Bước 2: Giấy phép xây dựng (Sẵn có, cập nhật sang tên chủ mới).
  + Bước 3: Giấy chứng nhận nhà + đất (Sổ hồng riêng từng căn sau hoàn công).
  + Bước 4: Hợp đồng mua bán công chứng (Chuyển quyền sở hữu tài sản trọn đời).
  * Dự án được phê duyệt 1/500, hồ sơ PCCC thẩm tra theo tiêu chuẩn mới nhất. Thanh toán đủ 85% có thể tiến hành công chứng sang tên ngay (Ngoại lệ duy nhất là lô #03 không áp dụng).
- Bảo hành: 05 năm đối với kết cấu khung sườn bê tông cốt thép. Cam kết bàn giao nhà và thiết bị không khiếm khuyết.
- Đối tác tài chính ngân hàng tài trợ dự án: TPBank, Techcombank, MB và BIDV.`,

      "Tiện ích xung quanh": `Nguồn: MASTER KNOWLEDGE BASE T3/2026 - Tiện ích ngoại khu & nội khu.
- Tiện ích ngoại khu: Aeon Mall Bình Tân, Co.op Mart Phú Lâm, MM Mega Market Bình Phú, Bệnh viện Chợ Rẫy, Hệ thống trường học các cấp (Phú Định, THCS, THPT).
- Triết lý "Chất liệu Hạnh phúc" hội tụ 4 giá trị cốt lõi: Thở sạch sống khỏe (AirTop), Nắng tràn sức sống (Super Bright), Tự do khôn lớn (An ninh Compound), và Bật tung năng lượng (17 đặc quyền tiện ích nội khu).
- Hệ thống 17 đặc quyền tiện ích nội khu:
  1. Biển hiệu Ny’ah Phú Định | 2. Khu Landmark Coffee | 3. Cổng chính tự động | 4. Khu “Sạc pin” | 5. Sảnh lối vào sân | 6. Đường chính sinh hoạt nội khu | 7. Cây xanh nội khu (kèn hồng/vàng) | 8. Ghế công viên | 9. Bồn hoa công viên | 10. Khu vui chơi trẻ em | 11. Khu thể thao ngoài trời | 12. Sân bóng rổ mini | 13. Tranh graffiti | 14. Sân cầu lông | 15. Signature by Codinachs (Kiến trúc) | 16. Công viên số 2 | 17. Trạm khử khuẩn hàng shipper.
- Phí quản lý 0 đồng: Nhờ hệ thống ByteLife tự động hóa vận hành toàn khu compound, giảm thiểu tối đa chi phí nhân sự quản lý và an ninh, lợi ích này được chuyển trực tiếp cho cư dân.`,

      "Bảng giá & Thanh toán": `Nguồn: MASTER KNOWLEDGE BASE T3/2026 - Bảng giá & Phương thức Thanh toán.
- Rổ hàng v12:
  + Lot_50: 11,470,000,000 VNĐ (Cosmo Gen 2 - Giá nhà chưa nội thất)
  + Lot_42: 8,981,000,000 VNĐ (Cosmo Gen 2 - Giá nhà chưa nội thất)
  + Lot_24: 12,751,000,000 VNĐ (Opus v3 - Giá nhà chưa nội thất)
  + Lot_03: 9,710,000,000 VNĐ (Cosmo - Giá nhà chưa nội thất)
  + Office_Package: 32,230,000,000 VNĐ (2 căn kèm nội thất mẫu Opus)
- Phương thức Thanh toán (PTTT v7d):
  + Chuẩn: 10% ký HĐ, sau đó thanh toán 3%/tháng trong 7 tháng. 8% khi nhận nhà (Gói AIR). 61% khi công chứng.
  + Sớm (Chiết khấu): Chiết khấu = (Số tiền đóng trước) x (Hệ số x 2.9% / 12) x (Số tháng đóng trước). Hệ số: Gấp 3 lần hoặc 6 lần lãi suất tiết kiệm 9 tháng của Vietcombank (hiện là 2.9%). Ví dụ: Thanh toán ngay 50% nhận chiết khấu 4.06% (đối với gói Max).`,

      "Nội thất phòng ngủ": "Nguồn: Thiết kế nội thất phòng ngủ Cosmo Gen 2.\nSử dụng vách ốp đầu giường ấm cúng, tủ quần áo âm tường kịch trần cánh trượt kính, tích hợp bàn trang điểm nhỏ gọn và máy lạnh thổi gián tiếp bảo vệ sức khỏe.",
      "Nội thất phòng khách": "Nguồn: Layout thiết kế phòng khách tầng lửng.\nBố trí bộ sofa chữ I cao cấp màu trung tính, bàn trà gỗ tối giản, kệ tivi treo tường và vách ốp đá vân mây sang trọng phối hợp đèn chùm ấm áp.",
      "Nội thất phòng tắm": "Nguồn: Danh mục vật liệu bàn giao thiết bị vệ sinh.\nTrang bị lavabo đặt bàn, vòi sen đứng nóng lạnh, vách kính cường lực ngăn khu vực ướt/khô, gạch ốp tường chống thấm vân đá hiện đại."
    };
    try {
      const stored = localStorage.getItem("topic_knowledge_base");
      const deletedStored = localStorage.getItem("deleted_topics");
      const deleted: string[] = deletedStored ? JSON.parse(deletedStored) : [];
      
      let merged = defaults;
      if (stored) {
        const parsed = JSON.parse(stored);
        merged = { ...defaults, ...parsed };
      }
      
      const filtered: Record<string, string> = {};
      Object.entries(merged).forEach(([k, v]) => {
        if (!deleted.includes(k)) {
          filtered[k] = v;
        }
      });
      return filtered;
    } catch {
      // Ignore
    }
    return defaults;
  });

  // States for the new Topic Auto-Summarizer tool
  const [summarizerSelectedTopic, setSummarizerSelectedTopic] = useState("Vị trí dự án Nyah Phú Định");
  const [summarizerInputText, setSummarizerInputText] = useState("");
  const [summarizerOutputText, setSummarizerOutputText] = useState("");
  const [isAutoSummarizing, setIsAutoSummarizing] = useState(false);
  const [summarizerStatus, setSummarizerStatus] = useState<{ type: "success" | "error" | "info" | null; message: string }>({ type: null, message: "" });

  useEffect(() => {
    if (topicKnowledge[summarizerSelectedTopic]) {
      setSummarizerInputText(topicKnowledge[summarizerSelectedTopic]);
    } else {
      setSummarizerInputText("");
    }
    
    if (topicConciseSummaries[summarizerSelectedTopic]) {
      setSummarizerOutputText(topicConciseSummaries[summarizerSelectedTopic]);
    } else {
      setSummarizerOutputText("");
    }
    setSummarizerStatus({ type: null, message: "" });
  }, [summarizerSelectedTopic, isConfigsLoaded]);

  const handleInputTextChange = (val: string) => {
    setSummarizerInputText(val);
    setTopicKnowledge(prev => ({
      ...prev,
      [summarizerSelectedTopic]: val
    }));
  };

  const handleAutoSummarize = async () => {
    if (!summarizerInputText.trim()) {
      setSummarizerStatus({ type: "error", message: "Vui lòng nhập thông tin chi tiết cần tóm tắt." });
      return;
    }

    setIsAutoSummarizing(true);
    setSummarizerStatus({ type: "info", message: "Đang gọi AI Gemini tóm tắt..." });

    try {
      const response = await fetch("/api/auto-summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: summarizerInputText })
      });

      const data = await response.json();
      if (data.success && data.summary) {
        setSummarizerOutputText(data.summary);
        setTopicConciseSummaries(prev => ({
          ...prev,
          [summarizerSelectedTopic]: data.summary
        }));
        setSummarizerStatus({ type: "success", message: "Tóm tắt thành công! Đã lưu." });
      } else if (data.fallback) {
        setSummarizerOutputText(data.fallback);
        setTopicConciseSummaries(prev => ({
          ...prev,
          [summarizerSelectedTopic]: data.fallback
        }));
        setSummarizerStatus({
          type: "success",
          message: "Đã sử dụng giải thuật tóm gọn thay thế. Đã lưu."
        });
      } else {
        setSummarizerStatus({ type: "error", message: data.error || "Không thể tóm tắt. Vui lòng thử lại." });
      }
    } catch (err: any) {
      console.error(err);
      const words = summarizerInputText.replace(/\*\*/g, "").replace(/^Nguồn:\s*[^\n]+\n/gi, "").split(/\s+/).filter(Boolean);
      const fallbackSummary = words.slice(0, 10).join(" ");
      setSummarizerOutputText(fallbackSummary);
      setTopicConciseSummaries(prev => ({
        ...prev,
        [summarizerSelectedTopic]: fallbackSummary
      }));
      setSummarizerStatus({ type: "success", message: "Đã dùng giải thuật tóm gọn dự phòng. Đã lưu." });
    } finally {
      setIsAutoSummarizing(false);
    }
  };

  const handleManualSummaryChange = (val: string) => {
    setSummarizerOutputText(val);
    setTopicConciseSummaries(prev => ({
      ...prev,
      [summarizerSelectedTopic]: val
    }));
  };

  const [newTopicKnowledgeText, setNewTopicKnowledgeText] = useState("");
  const [botAnswerCorner, setBotAnswerCorner] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("top-left");
  const [showBotAnswerOnImage, setShowBotAnswerOnImage] = useState(true);
  const [isSlideConcise, setIsSlideConcise] = useState(true);

  // States for Vertical TV (16:9 vertical / 9:16 aspect ratio)
  const [isVerticalTvMode, setIsVerticalTvMode] = useState<boolean>(true);
  const [isTvAutoPlay, setIsTvAutoPlay] = useState<boolean>(true);
  const [tvAutoPlayInterval, setTvAutoPlayInterval] = useState<number>(6); // seconds
  const [showTvAdvice, setShowTvAdvice] = useState<boolean>(true);
  const [tvImageFit, setTvImageFit] = useState<"cover" | "contain">("cover");
  const [isPortrait, setIsPortrait] = useState<boolean>(true);

  useEffect(() => {
    if (isVerticalTvMode) {
      const timer = setTimeout(() => {
        if (tvContainerRef.current) {
          tvContainerRef.current.focus();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isVerticalTvMode]);

  const tvCardRef = useRef<HTMLDivElement>(null);
  const [tvDimensions, setTvDimensions] = useState({ width: 0, height: 0 });
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(1.5);
  const [displayedTvImageSrc, setDisplayedTvImageSrc] = useState<string>("");

  useEffect(() => {
    if (!isVerticalTvMode || !tvCardRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setTvDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(tvCardRef.current);
    return () => observer.disconnect();
  }, [isVerticalTvMode]);

  // Synchronize custom configurations from/to server after all state variables are declared
  useEffect(() => {
    // Initial load of custom configs from public/app_configs.json on server
    const loadServerConfigs = async () => {
      try {
        const response = await fetch("/api/load-configs");
        const data = await response.json();
        if (data.success && data.configs) {
          const c = data.configs;
          if (c.customTopicImages) setCustomTopicImages(c.customTopicImages);
          if (c.secondLevelKeywords) setSecondLevelKeywords(c.secondLevelKeywords);
          if (c.subtitleKeywords) setSubtitleKeywords(c.subtitleKeywords);
          if (c.topicKeywords) {
            setTopicKeywords(c.topicKeywords);
            if (c.topicKeywords["Tiện ích xung quanh"]) {
              setDeletedTopics((prev) => {
                const updated = prev.filter((t) => t !== "Tiện ích xung quanh");
                localStorage.setItem("deleted_topics", JSON.stringify(updated));
                return updated;
              });
            }
          }
          if (c.topicKnowledge) setTopicKnowledge(c.topicKnowledge);
          if (c.topicConciseSummaries) setTopicConciseSummaries(c.topicConciseSummaries);
        }
      } catch (err) {
        console.error("Lỗi tải cấu hình tùy chỉnh từ máy chủ:", err);
      } finally {
        setIsConfigsLoaded(true);
      }
    };
    loadServerConfigs();
  }, []);

  // Auto-save configs to server when any is updated (after initial load is complete)
  useEffect(() => {
    if (!isConfigsLoaded) return;

    const saveServerConfigs = async () => {
      try {
        await fetch("/api/save-configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            configs: {
              customTopicImages,
              secondLevelKeywords,
              subtitleKeywords,
              topicKeywords,
              topicKnowledge,
              topicConciseSummaries
            }
          })
        });
      } catch (err) {
        console.error("Lỗi tự động lưu cấu hình lên máy chủ:", err);
      }
    };

    // Debounce saves to 2 seconds to avoid rapid successive writes during fast typing
    const delayDebounce = setTimeout(() => {
      saveServerConfigs();
    }, 2000);

    return () => clearTimeout(delayDebounce);
  }, [customTopicImages, secondLevelKeywords, subtitleKeywords, topicKeywords, topicKnowledge, topicConciseSummaries, isConfigsLoaded]);

  // Auto-sync topic folders with disk so they always exist in file explorer
  useEffect(() => {
    if (!isConfigsLoaded) return;

    const syncTopicFolders = async () => {
      try {
        const topicNames = Object.keys(topicKeywords);
        const response = await fetch("/api/sync-all-folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            topicNames, 
            topicParents, 
            secondLevelKeywords 
          })
        });
        const data = await response.json();
        if (data.success) {
          console.log("Đã đồng bộ thành công các thư mục vật lý:", data.created, data.existed);
          // Always re-fetch scanned folder images to sync empty/new folders to client UI state
          await fetchScannedFolderImages();
        }
      } catch (err) {
        console.error("Lỗi khi gửi yêu cầu đồng bộ thư mục vật lý:", err);
      }
    };

    // Debounce folder sync operation to 2.5 seconds to completely eliminate backend disk lag while typing keywords/topics
    const delayDebounce = setTimeout(() => {
      syncTopicFolders();
    }, 2500);

    return () => clearTimeout(delayDebounce);
  }, [topicKeywords, topicParents, secondLevelKeywords, isConfigsLoaded]);

  // Auto-play interval for vertical TV mode with intelligent loading protection
  useEffect(() => {
    if (!isVerticalTvMode || !isTvAutoPlay || !isCurrentImageLoaded) return;
    
    const timerId = setTimeout(() => {
      if (displayedTopic) {
        handleNextImage(displayedTopic);
      }
    }, tvAutoPlayInterval * 1000);
    
    return () => clearTimeout(timerId);
  }, [isVerticalTvMode, isTvAutoPlay, tvAutoPlayInterval, displayedTopic, isCurrentImageLoaded]);

  // Slideshow automatic transition: 6 seconds per image when topic has multiple images (with intelligent loading protection)
  useEffect(() => {
    if (!displayedTopic) return;
    if (isVerticalTvMode) return; // TV mode handles its own auto-play
    if (!isRegularAutoPlay) return; // Respect pause request
    if (!isCurrentImageLoaded) return;
    
    const validImages = getValidTopicImages(displayedTopic);
    if (validImages.length <= 1) return;

    const timerId = setTimeout(() => {
      setActiveImageIndexes((prev) => {
        const currentIdx = prev[displayedTopic] || 0;
        const nextIdx = (currentIdx + 1) % validImages.length;
        return { ...prev, [displayedTopic]: nextIdx };
      });
    }, 6000); // 6s of loaded display time

    return () => clearTimeout(timerId);
  }, [
    displayedTopic, 
    scannedFolderImages, 
    customTopicImages, 
    lastActiveHouseModel, 
    failedLocalUrls, 
    activeImageIndexes,
    isVerticalTvMode,
    isTvAutoPlay,
    isRegularAutoPlay,
    isCurrentImageLoaded
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (text: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        callback(result);
      }
    };
    reader.readAsText(file);
  };

  const learnNewKeywords = (topic: string, newKws: string[]) => {
    if (!topic || !newKws || !Array.isArray(newKws)) return;
    
    setTopicKeywords((prev) => {
      const current = prev[topic] || [];
      const updated = [...current];
      let hasChanges = false;
      
      newKws.forEach((kw) => {
        const cleanKw = kw.toLowerCase().trim();
        if (cleanKw && !updated.includes(cleanKw)) {
          updated.push(cleanKw);
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        try {
          localStorage.setItem("topic_keywords_learned", JSON.stringify({ ...prev, [topic]: updated }));
        } catch (e) {
          console.error(e);
        }
        return { ...prev, [topic]: updated };
      }
      return prev;
    });
  };

  const removeKeyword = (topic: string, kwToDel: string) => {
    setTopicKeywords((prev) => {
      const current = prev[topic] || [];
      const updated = current.filter((kw) => kw !== kwToDel);
      try {
        localStorage.setItem("topic_keywords_learned", JSON.stringify({ ...prev, [topic]: updated }));
      } catch (e) {
        console.error(e);
      }
      return { ...prev, [topic]: updated };
    });
  };

  const addNewTopic = async (topicName: string, keywords: string[], initialKnowledge?: string, parentTopicName?: string): Promise<{ success: boolean; error?: string }> => {
    const cleanName = topicName.trim();
    if (!cleanName) {
      return { success: false, error: "Tên chủ đề không được để trống." };
    }
    const uniqueKey = parentTopicName && parentTopicName.trim() ? `${parentTopicName.trim()} > ${cleanName}` : cleanName;
    if (topicKeywords[uniqueKey]) {
      return { success: false, error: "Chủ đề này đã tồn tại." };
    }

    setDeletedTopics((prev) => {
      const updated = prev.filter((t) => t !== uniqueKey);
      try {
        localStorage.setItem("deleted_topics", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    
    setTopicKeywords((prev) => {
      const updated = { ...prev, [uniqueKey]: keywords.map(k => k.trim().toLowerCase()).filter(Boolean) };
      try {
        localStorage.setItem("topic_keywords_learned", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    setTopicKnowledge((prev) => {
      const updated = { ...prev, [uniqueKey]: initialKnowledge || `Tài liệu tư vấn tự tạo cho chủ đề: ${cleanName}` };
      try {
        localStorage.setItem("topic_knowledge_base", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    if (parentTopicName) {
      setTopicParents((prev) => {
        const updated = { ...prev, [uniqueKey]: parentTopicName };
        try {
          localStorage.setItem("topic_parents", JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });

      setExpandedTopics((prev) => ({
        ...prev,
        [parentTopicName]: true,
        [uniqueKey]: true
      }));
    } else {
      setExpandedTopics((prev) => ({
        ...prev,
        [uniqueKey]: true
      }));
    }

    // Dynamic folder creation trigger
    try {
      const response = await fetch("/api/create-topic-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicName: cleanName, parentTopicName })
      });
      const data = await response.json();
      if (data.success) {
        console.log(`Đã đồng bộ tạo thư mục cho chủ đề: ${data.folderName}`);
        // Immediately fetch the newly scanned folders map to synchronize local state
        await fetchScannedFolderImages();
      }
    } catch (err) {
      console.error("Không thể tự động tạo thư mục cho chủ đề mới:", err);
    }

    return { success: true };
  };

  const deleteCustomTopic = async (topicName: string) => {
    setTopicKeywords((prev) => {
      const updated = { ...prev };
      delete updated[topicName];
      try {
        localStorage.setItem("topic_keywords_learned", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    setTopicKnowledge((prev) => {
      const updated = { ...prev };
      delete updated[topicName];
      try {
        localStorage.setItem("topic_knowledge_base", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    setTopicParents((prev) => {
      const updated = { ...prev };
      delete updated[topicName];
      try {
        localStorage.setItem("topic_parents", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    setDeletedTopics((prev) => {
      const updated = Array.from(new Set([...prev, topicName]));
      try {
        localStorage.setItem("deleted_topics", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // Dynamic folder deletion trigger
    try {
      const response = await fetch("/api/delete-topic-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicName })
      });
      const data = await response.json();
      if (data.success) {
        console.log(`Đã đồng bộ xóa thư mục cho chủ đề: ${data.folderName}`);
        // Refresh local scanned folder map
        await fetchScannedFolderImages();
      }
    } catch (err) {
      console.error("Không thể tự động xóa thư mục cho chủ đề:", err);
    }
  };

  const renameCustomTopic = async (oldName: string, newName: string): Promise<{ success: boolean; error?: string }> => {
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanNew) {
      return { success: false, error: "Tên chủ đề mới không được trống." };
    }
    if (cleanOld === cleanNew) {
      return { success: true };
    }
    if (topicKeywords[cleanNew]) {
      return { success: false, error: "Tên chủ đề mới đã tồn tại." };
    }

    // 1. Update topicKeywords
    setTopicKeywords((prev) => {
      const updated = { ...prev };
      if (updated[cleanOld]) {
        updated[cleanNew] = updated[cleanOld];
        delete updated[cleanOld];
      }
      try {
        localStorage.setItem("topic_keywords_learned", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // 2. Update topicKnowledge
    setTopicKnowledge((prev) => {
      const updated = { ...prev };
      if (updated[cleanOld]) {
        updated[cleanNew] = updated[cleanOld];
        delete updated[cleanOld];
      }
      try {
        localStorage.setItem("topic_knowledge_base", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // 3. Update topicParents
    setTopicParents((prev) => {
      const updated = { ...prev };
      
      // Update parent of its children too!
      Object.keys(updated).forEach((key) => {
        if (updated[key] === cleanOld) {
          updated[key] = cleanNew;
        }
      });

      // Update its own parent
      if (updated[cleanOld]) {
        updated[cleanNew] = updated[cleanOld];
        delete updated[cleanOld];
      }

      try {
        localStorage.setItem("topic_parents", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // 4. Update topicConciseSummaries
    setTopicConciseSummaries((prev) => {
      const updated = { ...prev };
      if (updated[cleanOld]) {
        updated[cleanNew] = updated[cleanOld];
        delete updated[cleanOld];
      }
      try {
        localStorage.setItem("topic_concise_summaries_list", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // 5. Update subtitleKeywords
    setSubtitleKeywords((prev) => {
      const updated = { ...prev };
      if (updated[cleanOld]) {
        updated[cleanNew] = updated[cleanOld];
        delete updated[cleanOld];
      }
      try {
        localStorage.setItem("topic_subtitle_keywords_list", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // 6. Update secondLevelKeywords
    setSecondLevelKeywords((prev) => {
      const updated = prev.map((item) => {
        if (item.parentTopic === cleanOld) {
          return { ...item, parentTopic: cleanNew };
        }
        return item;
      });
      try {
        localStorage.setItem("second_level_keywords", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // 7. Update customTopicImages
    setCustomTopicImages((prev) => {
      const updated = { ...prev };
      if (updated[cleanOld]) {
        updated[cleanNew] = updated[cleanOld];
        delete updated[cleanOld];
      }
      try {
        localStorage.setItem("custom_topic_images_v2", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // 8. If active topic is this one, update it
    if (predictedTopic === cleanOld) {
      setPredictedTopic(cleanNew);
    }
    if (lastValidTopic === cleanOld) {
      setLastValidTopic(cleanNew);
    }

    // 9. Call rename folder on backend
    try {
      const currentParent = topicParents[cleanOld] || "";
      const response = await fetch("/api/rename-topic-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldTopicName: cleanOld, newTopicName: cleanNew, parentTopicName: currentParent })
      });
      const data = await response.json();
      if (data.success) {
        console.log(`Đã đổi tên thư mục: ${data.from} -> ${data.to}`);
        await fetchScannedFolderImages();
      }
    } catch (err) {
      console.error("Lỗi khi đổi tên thư mục của chủ đề:", err);
    }

    return { success: true };
  };

  const clearAllLearnedKeywords = () => {
    const baseCountMap: Record<string, number> = {
      "Nội thất nhà bếp": 12,
      "Mẫu nhà Cosmo Gen 2": 18,
      "Vị trí dự án Nyah Phú Định": 14,
      "Tiện ích xung quanh": 15,
      "Nội thất phòng ngủ": 12,
      "Nội thất phòng khách": 12,
      "Nội thất phòng tắm": 12,
      "Chủ đề khác hoặc dự án khác": 12
    };

    setTopicKeywords((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((topic) => {
        const baseCount = baseCountMap[topic];
        if (baseCount !== undefined) {
          updated[topic] = updated[topic].slice(0, baseCount);
        }
      });
      try {
        localStorage.setItem("topic_keywords_learned", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const clearLearnedKeywordsForTopic = (topic: string) => {
    const baseCountMap: Record<string, number> = {
      "Nội thất nhà bếp": 12,
      "Mẫu nhà Cosmo Gen 2": 18,
      "Vị trí dự án Nyah Phú Định": 14,
      "Tiện ích xung quanh": 15,
      "Nội thất phòng ngủ": 12,
      "Nội thất phòng khách": 12,
      "Nội thất phòng tắm": 12,
      "Chủ đề khác hoặc dự án khác": 12
    };

    const baseCount = baseCountMap[topic];
    if (baseCount === undefined) return;

    setTopicKeywords((prev) => {
      const updated = { ...prev };
      updated[topic] = (updated[topic] || []).slice(0, baseCount);
      try {
        localStorage.setItem("topic_keywords_learned", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const resetToDefaultTopics = () => {
    const defaults = {
      "Nội thất nhà bếp": [
        "bếp", "nhà bếp", "tủ bếp", "mdf", "acrylic", "melamine", "tủ lạnh", 
        "bồn rửa", "nấu ăn", "nội thất bếp", "bàn ăn", "hút mùi", "lò vi sóng"
      ],
      "Mẫu nhà Cosmo Gen 2": [
        "cosmo", "gen 2", "diện tích", "5m", "9m", "5x9", "250m", "kết cấu", 
        "6 tầng", "trệt", "lửng", "3 lầu", "tầng", "móng", "thiết kế xây dựng", "mẫu nhà", "đất", "quy mô"
      ],
      "Vị trí dự án Nyah Phú Định": [
        "vị trí", "địa chỉ", "bản đồ", "tọa độ", "đường đi", "trương đình hội", "phú định", "nyah", 
        "di chuyển", "ngập nước", "kẹt xe", "quận 1", "quận 4", "phú mỹ hưng", "giao thông", "ngập"
      ],
      "Tiện ích xung quanh": [
        "tiện ích", "xung quanh", "ngoại khu", "gần đó", "chợ", "siêu thị", "trường học", 
        "bệnh viện", "aeon mall", "coopmart", "bách hóa xanh", "mega market", 
        "trung tâm thương mại", "tiểu học", "mầm non", "thcs", "tiện ích xung quanh"
      ],
      "Nội thất phòng ngủ": [
        "phòng ngủ", "giường", "giường ngủ", "nệm", "tủ áo", "tủ quần áo", "đầu giường", 
        "rèm cửa", "bàn trang điểm", "táp đầu giường", "chăn ga", "máy lạnh phòng ngủ"
      ],
      "Nội thất phòng khách": [
        "phòng khách", "sofa", "ghế tựa", "bàn trà", "kệ tivi", "vách ốp", "thảm", 
        "đèn chùm", "tranh treo tường", "tivi", "salon", "vách ngăn"
      ],
      "Nội thất phòng tắm": [
        "phòng tắm", "nhà vệ sinh", "lavabo", "vòi sen", "bồn tắm", "vách kính", 
        "gạch ốp", "toilet", "bồn cầu", "gương soi", "sen tắm", "vệ sinh"
      ],
      "Chủ đề khác hoặc dự án khác": [
        "chủ đề khác", "dự án khác", "ngoài danh mục", "trò chuyện", "tán gẫu", "vui vẻ", "hỏi thăm",
        "gói hàng", "tìm đồ", "xe máy", "chiếc quạt", "mang về nhà"
      ]
    };
    setTopicKeywords(defaults);
    try {
      localStorage.setItem("topic_keywords_learned", JSON.stringify(defaults));
    } catch (e) {
      console.error(e);
    }
  };

  // References
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const autoAnalyzeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyzedTextRef = useRef<string>("");
  const userManuallyStopped = useRef<boolean>(false);
  const micPermissionBlocked = useRef<boolean>(false);
  const isSimulatingRef = useRef<boolean>(false);
  const consecutiveErrorsRef = useRef<number>(0);
  const lastStartTimestampRef = useRef<number>(0);

  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  // Real-time automatic pause analysis states
  const [secondsSinceLastSpeech, setSecondsSinceLastSpeech] = useState<number | null>(null);

  interface TopicScoreDetail {
    topic: string;
    score: number;
    matchedKeywords: string[];
    recentMatchesCount: number;
  }

  // Real-time instant prediction of topic (0ms latency client-side heuristic)
  const [predictedTopic, setPredictedTopic] = useState<string | null>(null);
  const [topicMatchDetails, setTopicMatchDetails] = useState<TopicScoreDetail[]>([]);

  // Track the most recent valid topic and its analysis result
  const [lastValidTopic, setLastValidTopic] = useState<string | null>("Vị trí dự án Nyah Phú Định");
  const [lastValidAnalysis, setLastValidAnalysis] = useState<AnalysisResult | null>(() => lookupDefaultAnalysis("Vị trí dự án Nyah Phú Định"));

  const detectTopicWithGrouping = (text: string): { matched: string | null; details: TopicScoreDetail[] } => {
    const lower = text.toLowerCase();
    
    // Detect other projects/developers first to avoid false-matching location/specs of other properties
    const otherProjects = [
      "vinhomes", "vinhome", "novaland", "masterise", "masteri", "khang điền", "khang dien",
      "nam long", "akari", "mizuki", "sunrise", "grand park", "vạn phúc", "him lam",
      "capitaland", "sun group", "sunshine", "dự án khác", "các dự án khác", "bên khác"
    ];

    let hasOtherProject = false;
    otherProjects.forEach(kw => {
      if (lower.includes(kw)) {
        hasOtherProject = true;
      }
    });

    if (lower.includes("phú mỹ hưng") && !lower.includes("di chuyển") && !lower.includes("sang") && !lower.includes("đến")) {
      hasOtherProject = true;
    }

    if (hasOtherProject) {
      return { matched: "Chủ đề khác hoặc dự án khác", details: [] };
    }

    const details: TopicScoreDetail[] = [];
    const windowSize = 250; // Use last 250 characters as sliding window
    const normText = normalizePhrase(text);

    const allLevel2Kws = new Set<string>();
    secondLevelKeywords.forEach((cfg) => {
      const subKws = cfg.keyword.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
      subKws.forEach((kw) => {
        allLevel2Kws.add(normalizePhrase(kw));
      });
    });

    Object.entries(topicKeywords).forEach(([topicName, keywordsList]) => {
      const list: string[] = [];
      (keywordsList as string[]).forEach((kw) => {
        const normKw = normalizePhrase(kw);
        // Trường hợp từ khóa đã được thêm vào từ khóa lớp 2 thì không nên thêm vào bất kỳ chủ đề nào khác
        if (allLevel2Kws.has(normKw)) {
          return;
        }
        list.push(kw);
      });
      let score = 0;
      const matchedKeywords: string[] = [];
      let recentMatchesCount = 0;

      list.forEach(kw => {
        const normKw = normalizePhrase(kw);
        if (!normKw) return;

        const idxInFull = lastIndexOfPhrase(normText, normKw);
        if (idxInFull !== -1) {
          // If the keyword exists in full text
          matchedKeywords.push(kw);
          score += 1; // +1 Base point

          // Check if it exists in the sliding window
          if (idxInFull >= (normText.length - windowSize)) {
            score += 4; // +4 Bonus point for being in recent focus context
            recentMatchesCount += 1;
          }
        }
      });

      details.push({
        topic: topicName,
        score,
        matchedKeywords,
        recentMatchesCount
      });
    });

    // Apply specificity boost: if a topic has a parent (or ancestor) that also scored > 0,
    // we boost the child's score because the user is referring to a more specific sub-topic.
    details.forEach(d => {
      if (d.score === 0) return; // CRITICAL FIX: Only boost if the child itself scored > 0!
      let boost = 0;
      let currentParent = topicParents[d.topic];
      while (currentParent) {
        const parentDetail = details.find(p => p.topic === currentParent);
        if (parentDetail && parentDetail.score > 0) {
          boost += 10;
        }
        // Small boost if the parent is the last active house model to break ties
        if (lastActiveHouseModel && currentParent === lastActiveHouseModel) {
          boost += 5;
        }
        currentParent = topicParents[currentParent];
      }
      d.score += boost;
    });

    // Find the topic with the highest score
    let winner: string | null = null;
    let highestScore = 0;
    let bestLastMatchIdx = -1;

    // To find the lastMatchIdx for each topic, we compute it during evaluation:
    const topicLastMatchIdx: Record<string, number> = {};
    Object.entries(topicKeywords).forEach(([topicName, keywordsList]) => {
      const list = keywordsList as string[];
      let lastIdx = -1;
      list.forEach(kw => {
        const normKw = normalizePhrase(kw);
        const idx = lastIndexOfPhrase(normText, normKw);
        if (idx > lastIdx) {
          lastIdx = idx;
        }
      });
      topicLastMatchIdx[topicName] = lastIdx;
    });

    details.forEach(d => {
      const lastIdx = topicLastMatchIdx[d.topic] ?? -1;
      if (d.score > 0) {
        if (d.score > highestScore) {
          highestScore = d.score;
          bestLastMatchIdx = lastIdx;
          winner = d.topic;
        } else if (d.score === highestScore) {
          // Tie-break: which topic had the keyword mentioned most recently in the transcript?
          if (lastIdx > bestLastMatchIdx) {
            bestLastMatchIdx = lastIdx;
            winner = d.topic;
          }
        }
      }
    });

    return { matched: winner, details };
  };

  const detectTopicHeuristically = (text: string): string | null => {
    const lowerText = text.toLowerCase();
    const isDistanceQuery = lowerText.includes("bao xa") || 
                            lowerText.includes("khoảng cách") || 
                            lowerText.includes("cách bao nhiêu") || 
                            lowerText.includes("đường đi") ||
                            lowerText.includes("di chuyển") ||
                            lowerText.includes("mất bao lâu") ||
                            lowerText.includes("bản đồ") ||
                            lowerText.includes("đi tới") ||
                            lowerText.includes("đi đến") ||
                            lowerText.includes("khoang cach") ||
                            lowerText.includes("mat bao lau") ||
                            lowerText.includes("duong di") ||
                            lowerText.includes("ban do") ||
                            lowerText.includes("di toi") ||
                            lowerText.includes("di den");
    if (isDistanceQuery) {
      return "Tiện ích xung quanh";
    }
    const { matched } = detectTopicWithGrouping(text);
    return matched;
  };

  // Run real-time heuristic check
  useEffect(() => {
    let fullText = (transcript + interimTranscript).trim();
    if (!fullText && appMode === "chatbot" && chatMessages.length > 0) {
      const lastUserMsg = [...chatMessages].reverse().find(m => m.sender === "user");
      if (lastUserMsg) {
        fullText = lastUserMsg.text;
      }
    }
    if (!fullText) {
      setPredictedTopic(null);
      setTopicMatchDetails([]);
      return;
    }
    const { matched, details } = detectTopicWithGrouping(fullText);
    setPredictedTopic(matched);
    setTopicMatchDetails(details);
  }, [transcript, interimTranscript, topicKeywords, secondLevelKeywords, appMode, chatMessages]);

  // Scroll to bottom of transcript automatically inside its container only
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (autoAnalyzeTimerRef.current) {
        clearInterval(autoAnalyzeTimerRef.current);
      }
    };
  }, []);

  // Keep the latest state values in a ref to avoid stale closure lags in keyboard listeners
  const keysStateRef = useRef({
    isVerticalTvMode,
    displayedTopic,
    isTvAutoPlay,
    handlePrevImage,
    handleNextImage,
    setIsVerticalTvMode,
    setIsTvAutoPlay,
    setIsRegularAutoPlay
  });

  useEffect(() => {
    keysStateRef.current = {
      isVerticalTvMode,
      displayedTopic,
      isTvAutoPlay,
      handlePrevImage,
      handleNextImage,
      setIsVerticalTvMode,
      setIsTvAutoPlay,
      setIsRegularAutoPlay
    };
  }); // Run on every render to ensure latest closures are immediately accessible

  // Keyboard listeners for Slide Deck & 100% Fullscreen TV Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const state = keysStateRef.current;

      if (e.key === "Escape") {
        if (state.isVerticalTvMode) {
          state.setIsVerticalTvMode(false);
        }
      } else if (e.key === "ArrowLeft") {
        // Change image backwards
        state.handlePrevImage(state.displayedTopic);
      } else if (e.key === "ArrowRight") {
        // Change image forwards
        state.handleNextImage(state.displayedTopic);
      } else if (e.key === " ") {
        // Spacebar toggles autoplay
        e.preventDefault();
        if (state.isVerticalTvMode) {
          state.setIsTvAutoPlay((prev) => !prev);
        } else {
          state.setIsRegularAutoPlay((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // Completely static key bindings for perfect, instant reactivity

  // Initialize Speech Recognition
  useEffect(() => {
    if (!SpeechRecognition) {
      setRecognitionError(
        "Trình duyệt của bạn không hỗ trợ API Nhận diện giọng nói. Hãy dùng thử tính năng 'Mô Phỏng Hội Thoại' bên dưới nhé!"
      );
      return;
    }

    let autoRestartTimeout: NodeJS.Timeout | null = null;
    let isDestroyed = false;

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = language;

      rec.onstart = () => {
        if (isDestroyed) return;
        setIsListening(true);
        setRecognitionError(null);
        lastStartTimestampRef.current = Date.now();
        consecutiveErrorsRef.current = 0;
      };

      rec.onerror = (event: any) => {
        if (isDestroyed) return;
        const errType = event.error || "unknown";
        consecutiveErrorsRef.current += 1;
        
        // Avoid using console.error for benign/transient errors so the dev error overlay doesn't trigger
        if (errType === "no-speech" || errType === "aborted") {
          console.warn(`Speech recognition inactive: ${errType}`);
          return;
        }

        console.warn("Speech Recognition Error Event:", errType, event);
        
        if (errType === "not-allowed" || errType === "service-not-allowed") {
          micPermissionBlocked.current = true;
          setRecognitionError(
            "Iframe hoặc trình duyệt đã chặn quyền truy cập Microphone. Vui lòng cấp quyền hoặc trải nghiệm bằng 'Mô Phỏng Hội Thoại' ở mục bên dưới!"
          );
          setIsListening(false);
        } else {
          // Print error gracefully in dev console as warning or minimal info
          console.log(`Speech Recognition Status: ${errType}`);
        }
      };

      rec.onend = () => {
        if (isDestroyed) return;

        if (autoRestartTimeout) {
          clearTimeout(autoRestartTimeout);
        }

        const runDuration = Date.now() - lastStartTimestampRef.current;

        // Auto-restart if allowed and desired by the user
        if (!userManuallyStopped.current && !micPermissionBlocked.current) {
          // If stopped too quickly (frequently crashing), use a small cooldown to protect resources
          const delay = runDuration < 1000 ? 1000 : 50;
          
          if (consecutiveErrorsRef.current >= 15) {
            console.warn("Too many consecutive SpeechRecognition errors. Stopping auto-restart.");
            setRecognitionError("Không thể kết nối mic tự động liên tiếp. Nhấn nút Micro để thử lại.");
            setIsListening(false);
            userManuallyStopped.current = true;
            return;
          }

          autoRestartTimeout = setTimeout(() => {
            if (isDestroyed) return;
            if (!userManuallyStopped.current && !micPermissionBlocked.current) {
              try {
                rec.start();
              } catch (err) {
                // If already starting or running, ignore error
              }
            }
          }, delay);
        } else {
          // Genuinely stopped by user
          setIsListening(false);
        }
      };

      rec.onresult = (event: any) => {
        if (isDestroyed) return;
        // Nếu đang trong quá trình mô phỏng kịch bản mẫu, bỏ qua kết quả giọng nói thực tế để tránh trộn lẫn chữ
        if (isSimulatingRef.current) return;

        let finalTrans = "";
        let interimTrans = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript + " ";
          } else {
            interimTrans += event.results[i][0].transcript;
          }
        }

        if (finalTrans) {
          setTranscript((prev) => prev + finalTrans);
        }
        setInterimTranscript(interimTrans);
      };

      recognitionRef.current = rec;

      // Auto-start on load if permitted
      if (!userManuallyStopped.current && !isSimulating) {
        try {
          rec.start();
          setIsListening(true);
        } catch (err) {
          console.warn("Speech recognition auto-start attempt failed/blocked:", err);
        }
      }
    } catch (e: any) {
      console.warn("Speech Recognition Init Error:", e);
      setRecognitionError("Không thể khởi tạo micro nhận diện.");
    }

    return () => {
      isDestroyed = true;
      if (autoRestartTimeout) {
        clearTimeout(autoRestartTimeout);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (err) {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, [language]);

  // Handle listening toggles
  const toggleListening = () => {
    if (!recognitionRef.current) {
      if (!SpeechRecognition) {
        setRecognitionError("Microphone không được hỗ trợ trên trình duyệt này.");
        return;
      }
      // Re-trigger setup if not initialized
      setRecognitionError("Đang thử kết nối micro...");
      return;
    }

    if (isListening) {
      userManuallyStopped.current = true;
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      userManuallyStopped.current = false;
      micPermissionBlocked.current = false;
      setTranscript("");
      setInterimTranscript("");
      setRecognitionError(null);
      try {
        recognitionRef.current.lang = language;
        recognitionRef.current.start();
      } catch (err) {
        console.error("Error starting speech recognition:", err);
        setRecognitionError("Vui lòng thử bấm lại, micro đang khởi động.");
      }
    }
  };

  // Rút gọn thông tin nguồn tri thức xuống tầm 20 từ (20 chữ) ngoài màn hình
  const summarizeTo20Words = (text: string): string => {
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
  };

  // Preprocess analysis result to inject Google Maps Route Info directly into the suggestion text for chatbot
  const preprocessAnalysisWithRoute = (analysis: AnalysisResult): AnalysisResult => {
    if (!analysis) return analysis;
    if (analysis.detectedDestination) {
      const dist = analysis.estimatedDistance || "5.0 km";
      const dur = analysis.estimatedDuration || "12 phút";
      const routePrefix = `🗺️ Khoảng cách từ ${analysis.detectedDestination} đến dự án Nyah Phú Định là khoảng **${dist}**, di chuyển bằng xe máy mất tầm **${dur}** anh/chị nhé. `;
      if (analysis.suggestion && !analysis.suggestion.includes("🗺️")) {
        return {
          ...analysis,
          suggestion: routePrefix + analysis.suggestion
        };
      }
    }
    return analysis;
  };

  // Generate beautiful structured analysis locally when in Heuristic mode
  const getLocalHeuristicAnalysis = (text: string): AnalysisResult => {
    const matchedTopic = detectTopicHeuristically(text) || "Chủ đề khác hoặc dự án khác";
    const customKnowledge = topicKnowledge[matchedTopic];

    const extracted = extractLandmarkFromQuery(text);
    let detectedDestination: string | undefined = undefined;
    let estimatedDistance: string | undefined = undefined;
    let estimatedDuration: string | undefined = undefined;

    if (extracted) {
      detectedDestination = extracted;
      const lowerDest = extracted.toLowerCase();
      if (lowerDest.includes("chợ rẫy") || lowerDest.includes("cho ray")) {
        estimatedDistance = "6.2 km";
        estimatedDuration = "15 phút";
      } else if (lowerDest.includes("hùng vương") || lowerDest.includes("hung vuong")) {
        estimatedDistance = "5.8 km";
        estimatedDuration = "13 phút";
      } else if (lowerDest.includes("từ dũ") || lowerDest.includes("tu du")) {
        estimatedDistance = "7.5 km";
        estimatedDuration = "18 phút";
      } else if (lowerDest.includes("đại học y dược") || lowerDest.includes("dai hoc y duoc")) {
        estimatedDistance = "5.2 km";
        estimatedDuration = "12 phút";
      } else if (lowerDest.includes("nguyễn tri phương") || lowerDest.includes("nguyen tri phuong")) {
        estimatedDistance = "4.8 km";
        estimatedDuration = "11 phút";
      } else if (lowerDest.includes("an đông") || lowerDest.includes("an dong")) {
        estimatedDistance = "5.5 km";
        estimatedDuration = "12 phút";
      } else if (lowerDest.includes("đầm sen") || lowerDest.includes("dam sen")) {
        estimatedDistance = "4.8 km";
        estimatedDuration = "10 phút";
      } else if (lowerDest.includes("tân sơn nhất") || lowerDest.includes("tan son nhat") || lowerDest.includes("sân bay") || lowerDest.includes("san bay")) {
        estimatedDistance = "12 km";
        estimatedDuration = "30 phút";
      } else if (lowerDest.includes("bến xe miền tây") || lowerDest.includes("mien tay")) {
        estimatedDistance = "3.8 km";
        estimatedDuration = "8 phút";
      } else {
        estimatedDistance = "5.0 km";
        estimatedDuration = "12 phút";
      }
    }
    
    const lower = text.toLowerCase();

    // 1. Check for specific keywords first to route correctly even if default classifier says other/generic
    if (lower.includes("pháp lý") || lower.includes("phap ly") || lower.includes("sổ hồng") || lower.includes("so hong") || lower.includes("sổ đỏ") || lower.includes("so do") || lower.includes("giấy phép") || lower.includes("giay phep") || lower.includes("hoàn công") || lower.includes("hoan cong")) {
      return {
        topic: "Pháp lý & Sổ hồng",
        category: "Pháp lý & Cam kết",
        summary: "Quy trình pháp lý 4 bước minh bạch và tiến độ hoàn công cấp sổ hồng riêng từng căn của Nyah Phú Định.",
        keywords: ["pháp lý 4 bước", "sổ hồng riêng từng căn", "sổ đỏ tổng", "giấy phép xây dựng", "hoàn công"],
        imageQuery: "legal document folder home owner license property",
        suggestion: "Dạ, quy trình pháp lý của dự án **Ny'ah Phú Định** cực kỳ minh bạch và đã hoàn thiện đầy đủ qua 4 bước chuẩn chỉnh để bảo vệ quyền lợi trọn đời cho anh/chị ạ:\n\n* 📕 **Bước 1**: Giấy chứng nhận quyền sử dụng đất (**Sổ đỏ tổng** đã sẵn có, sẵn sàng giao dịch).\n* 🏗️ **Bước 2**: Giấy phép xây dựng (**Sẵn có**, cập nhật sang tên chủ mới).\n* 🏠 **Bước 3**: Giấy chứng nhận nhà + đất (**Sổ hồng riêng từng căn** sau khi hoàn công).\n* ✍️ **Bước 4**: Hợp đồng mua bán công chứng (Chuyển quyền sở hữu tài sản trọn đời).\n\nDự án được phê duyệt quy hoạch **1/500**, hồ sơ PCCC được thẩm tra theo tiêu chuẩn mới nhất. Đặc biệt, khi anh/chị **thanh toán đủ 85%** là có thể tiến hành công chứng sang tên ngay (ngoại trừ lô **#03**).\n\nAnh/chị có cần em gửi bản scan sổ đỏ tổng hoặc giấy phép xây dựng qua Zalo để mình an tâm tìm hiểu trước không ạ? 😊",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    }

    if (lower.includes("bảo hành") || lower.includes("bao hanh") || lower.includes("kết cấu") || lower.includes("ket cau") || lower.includes("khung sườn") || lower.includes("khung suon")) {
      return {
        topic: "Chính sách Bảo hành",
        category: "Pháp lý & Cam kết",
        summary: "Cam kết bảo hành kết cấu vững chắc 5 năm và bàn giao không lỗi từ chủ đầu tư Nhã Đạt.",
        keywords: ["bảo hành 5 năm", "bảo hành kết cấu", "bàn giao không khiếu nại", "nhã đạt"],
        imageQuery: "modern engineering building structure warranty safety protection",
        suggestion: "Dạ, chính sách bảo hành nhà của chủ đầu tư **Nhã Đạt** rất uy tín và cam kết lâu dài để anh/chị an tâm dọn về sinh sống ạ:\n\n* 🏗️ **Bảo hành kết cấu 05 năm**: Áp dụng đối với toàn bộ khung sườn bê tông cốt thép chịu lực chính của ngôi nhà.\n* ⚙️ **Bảo hành vận hành**: Bên em cam kết bàn giao căn nhà và các trang thiết bị đi kèm không khiếm khuyết, vận hành tốt trong điều kiện bình thường.\n* 🔌 **Thiết bị công nghệ & điện tử**: Các thiết bị vệ sinh Inax, hệ thống điện thông minh Zigbee, máy lạnh LG (trong gói MAX) sẽ được bảo hành theo đúng thời hạn quy định của nhà sản xuất tại thời điểm bàn giao.\n\nMọi thắc mắc hay sự cố kỹ thuật sẽ có đội ngũ kỹ sư hỗ trợ tận nhà nhanh chóng. Anh/chị có muốn tham khảo kỹ hơn về danh mục vật liệu hoàn thiện chi tiết không ạ? 🛡️",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    }

    if (lower.includes("bảng giá") || lower.includes("bang gia") || lower.includes("giá bán") || lower.includes("gia ban") || lower.includes("giá cả") || lower.includes("tỷ") || lower.includes("ty") || lower.includes("mã lô") || lower.includes("ma lo") || lower.includes("lô #") || lower.includes("rổ hàng") || lower.includes("ro hang")) {
      return {
        topic: "Bảng giá & Rổ hàng v12",
        category: "Tài chính & Ưu đãi",
        summary: "Cập nhật bảng giá rổ hàng v12 các lô Cosmo Gen 2, Cosmo tiêu chuẩn và mẫu Opus Startup mới nhất.",
        keywords: ["bảng giá v12", "lot_42 giá 8.981 tỷ", "lot_03 giá 9.71 tỷ", "lot_50", "lot_24", "office_package"],
        imageQuery: "modern architecture residential townhouses luxury property pricing",
        suggestion: "Dạ, em xin gửi anh/chị thông tin **bảng giá rổ hàng cập nhật mới nhất (Tháng 03/2026)** tại dự án Ny'ah Phú Định (giá nhà thô chưa bao gồm nội thất rời):\n\n* 🏡 **Lot_42 (Mẫu Cosmo Gen 2)**: **8.981.000.000 VNĐ** (Mức giá tốt nhất rổ hàng).\n* 🏡 **Lot_03 (Mẫu Cosmo tiêu chuẩn)**: **9.710.000.000 VNĐ**.\n* 🏡 **Lot_50 (Mẫu Cosmo Gen 2)**: **11.470.000.000 VNĐ** (Vị trí góc hai mặt thoáng đắc địa).\n* 🏢 **Lot_24 (Mẫu Opus v3 Startup)**: **12.751.000.000 VNĐ** (Mặt tiền rộng, thích hợp đặt văn phòng công ty).\n* 🏢 **Office_Package (Cặp 02 căn Office)**: **32.230.000.000 VNĐ** (Đã trang bị sẵn nội thất hoàn chỉnh theo thiết kế mẫu Opus).\n\nAnh/chị đang tìm kiếm một căn nhà để ở ấm cúng hay có nhu cầu vừa ở vừa làm văn phòng công ty để em tư vấn mã lô phù hợp nhất ạ? 💰",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    }

    if (lower.includes("thanh toán") || lower.includes("thanh toan") || lower.includes("chiết khấu") || lower.includes("chiet khau") || lower.includes("tiến độ") || lower.includes("tien do") || lower.includes("góp") || lower.includes("pttt")) {
      return {
        topic: "Phương thức Thanh toán & Chiết khấu",
        category: "Tài chính & Ưu đãi",
        summary: "Tiến độ thanh toán chuẩn giãn 10% đợt đầu và công thức chiết khấu thanh toán sớm vượt trội.",
        keywords: ["tiến độ thanh toán", "trả góp 3%/tháng", "chiết khấu thanh toán sớm", "chiết khấu 4.06%"],
        imageQuery: "finance calculation money coins house keys investment",
        suggestion: "Dạ, dự án **Ny'ah Phú Định** đang áp dụng phương thức thanh toán cực kỳ linh hoạt cùng chính sách chiết khấu rất hấp dẫn ạ:\n\n* 📅 **Thanh toán chuẩn**: Đợt đầu chỉ cần **10%** ký HĐ, sau đó trả góp nhẹ nhàng **3%/tháng** trong vòng 7 tháng. Khi nhận nhà bàn giao (gói AIR) đóng tiếp **8%**, và đợt cuối đóng **61%** khi công chứng sang tên sổ hồng.\n* 💰 **Chiết khấu thanh toán sớm**: Chiết khấu = (Số tiền đóng trước) x (Hệ số x 2.9% / 12) x (Số tháng đóng trước). Hệ số chiết khấu gấp **3 lần** hoặc **6 lần** lãi suất tiết kiệm kỳ hạn 9 tháng của Vietcombank (hiện tại là 2.9%). Ví dụ, nếu anh/chị đóng sớm 50% sẽ được chiết khấu ngay tới **4.06%** (cho gói MAX) trừ thẳng vào hợp đồng!\n\nAnh/chị muốn lựa chọn phương án thanh toán giãn theo tiến độ hay thanh toán sớm để nhận mức chiết khấu tối đa ạ? 💸",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    }

    if (lower.includes("airtop") || lower.includes("khí tươi") || lower.includes("khi tuoi") || lower.includes("thở sạch") || lower.includes("tho sach") || lower.includes("bụi mịn") || lower.includes("bui min") || lower.includes("pm2.5")) {
      return {
        topic: "Hệ thống AirTop Sức khỏe",
        category: "Công nghệ & Tiện ích",
        summary: "Hệ thống cấp khí tươi lọc bụi mịn PM2.5 AirTop bảo vệ tối đa sức khỏe hô hấp gia đình.",
        keywords: ["hệ thống airtop", "cấp khí tươi Panasonic", "lọc bụi mịn PM2.5", "đối lưu không khí"],
        imageQuery: "clean air breeze ventilation system home filter smart design",
        suggestion: "Dạ, hệ thống **AirTop** là giải pháp 'Thở sạch sống khỏe' độc quyền cực kỳ tâm huyết tại Ny'ah Phú Định giúp bảo vệ sức khỏe cho cả gia đình mình:\n\n* 🌀 **Cơ chế**: Không khí tươi tự nhiên từ trên mái nhà sẽ được nạp qua quạt Panasonic cùng hệ thống bộ lọc chuyên dụng, lọc sạch hoàn toàn bụi mịn PM2.5 trước khi thổi vào phòng ngủ và phòng khách.\n* 📊 **Hiệu suất**: Cung cấp tới **9.5 triệu lít khí tươi** sạch khuẩn mỗi ngày, giúp đối lưu dòng khí liên tục, thải độc khí CO2 và mùi ẩm mốc, giữ nhà luôn thoáng mát mà không cần mở cửa (tránh bụi bặm và tiếng ồn đô thị). Đối với mẫu nhà **Opus Startup**, công suất cấp khí tươi được tăng cường gấp **3 lần** để đáp ứng không gian làm việc đông người.\n\nGia gia đình mình có người lớn tuổi nhạy cảm với thời tiết hay em bé nhỏ không ạ, hệ thống này cực kỳ có lợi cho hệ hô hấp đó anh/chị! 🌬️",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    }

    if (lower.includes("bytelife") || lower.includes("nhà thông minh") || lower.includes("nha thong minh") || lower.includes("phí quản lý") || lower.includes("phi quan ly") || lower.includes("0 đồng") || lower.includes("0 dong") || lower.includes("cảm biến") || lower.includes("cam bien")) {
      return {
        topic: "Hệ thống ByteLife & Phí quản lý 0đ",
        category: "Công nghệ & Tiện ích",
        summary: "Tự động hóa toàn diện bằng hệ sinh thái ByteLife giúp tối ưu năng lượng và miễn phí quản lý trọn đời.",
        keywords: ["nhà thông minh bytelife", "hơn 30 cảm biến", "phí quản lý 0 đồng trọn đời", "compound tự động hóa"],
        imageQuery: "smart home interface automation application light sensor controls console",
        suggestion: "Dạ, sự kết hợp giữa hệ thống nhà thông minh **ByteLife** và công nghệ quản lý compound tự động hóa là bí quyết giúp cư dân Ny'ah Phú Định được hưởng chính sách **Phí quản lý 0 đồng** trọn đời ạ:\n\n* 🧠 **Tự động hóa**: Trang bị hơn **30 cảm biến** tự động điều khiển đèn, điều hòa, thiết bị theo nhịp sinh học và chuyển động thực tế của gia đình để tối ưu năng lượng và chống lãng phí.\n* 🛡️ **Vận hành tự động**: Hệ thống camera giám sát AI thông minh, cổng chính tự động kiểm soát ra vào bằng nhận diện khuôn mặt/biển số xe và trạm shipper nhận hàng tự động giúp giảm thiểu tối đa chi phí thuê nhân viên bảo vệ hay ban quản lý.\n\nNhờ vậy, cư dân không phải đóng bất kỳ khoản phí quản lý định kỳ nào mà vẫn được bảo vệ an ninh compound biệt lập 24/7 cực kỳ đẳng cấp. Anh/chị có muốn tìm hiểu thêm về gói bàn giao MAX có tích hợp sẵn ByteLife không ạ? 🏠",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    }

    if (lower.includes("opus") || lower.includes("office") || lower.includes("startup") || lower.includes("văn phòng") || lower.includes("van phong") || lower.includes("tải trọng") || lower.includes("tai trong")) {
      return {
        topic: "Mẫu nhà phố chuyên văn phòng Opus",
        category: "Thông số & Kết cấu",
        summary: "Khám phá mẫu nhà phố Opus chuyên startup với dầm sàn chịu tải trọng lớn gấp rưỡi và tiện ích văn phòng hạng A.",
        keywords: ["mẫu nhà opus", "tải trọng dầm sàn +150%", "vừa ở vừa làm việc 2-in-1", "thang máy biệt lập"],
        imageQuery: "modern design open startup office loft architecture town house",
        suggestion: "Dạ, mẫu nhà phố **Opus (Startup)** có kích thước **4m x 12.5m** (kết cấu Trệt, lửng, 3 lầu, sân thượng) là mô hình **2-in-1** độc đáo thiết kế riêng cho việc vừa ở vừa làm việc chuyên nghiệp:\n\n* 🏢 **2 tầng văn phòng Grade A**: Kết cấu dầm sàn chịu tải trọng cực lớn, tăng cường thêm **150%** so với nhà ở thông thường (thoải mái lắp đặt tủ hồ sơ lớn hay thiết bị máy móc nặng), có lối đi riêng cho người khuyết tật.\n* 🏠 **4 tầng nhà ở cao cấp**: Phía trên cực kỳ biệt lập, yên tĩnh cho gia đình sinh hoạt cùng hệ thống thang máy chạy thẳng lên sân thượng.\n\nĐây là lựa chọn lý tưởng cho các doanh nghiệp Startup công nghệ, công ty thiết kế, Studio hoặc Shop Online cần văn phòng đại diện đạt chuẩn. Anh/chị đang có ý định tự kinh doanh hay cho thuê lại mặt bằng văn phòng ạ? 🏢",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    }

    if (lower.includes("fusion") || lower.includes("bán tải") || lower.includes("ban tai") || lower.includes("gara") || lower.includes("gác lửng") || lower.includes("gac lung")) {
      return {
        topic: "Mẫu nhà Fusion Gen 5",
        category: "Thông số & Kết cấu",
        summary: "Tìm hiểu mẫu Fusion với gara đỗ bán tải rộng, thiết kế thang bộ sát tường độc đáo và phòng ngủ master siêu lớn.",
        keywords: ["mẫu nhà fusion", "gara đỗ xe bán tải", "thang bộ sát tường", "phòng ngủ master chiếm 2/3"],
        imageQuery: "modern luxury townhouse interior garage staircase bedroom designer",
        suggestion: "Dạ, mẫu nhà **Fusion (Gen 5)** kích thước **4m x 11m** (Trệt, lửng, 3 lầu, sân thượng) nổi tiếng với các thiết kế cực kỳ đột phá và tối ưu không gian:\n\n* 🚗 **Garage cực đại**: Đỗ vừa vặn cả dòng xe bán tải cỡ lớn Ford Ranger hoặc 2 xe ô tô nhỏ một cách thoải mái trong nhà.\n* 🪜 **Thang bộ sáng tạo**: Thang biến hóa ôm sát tường, không chia đôi ngôi nhà như thiết kế truyền thống, giúp mở rộng tầm nhìn tối đa và tạo độ thoáng tuyệt vời.\n* 🛏️ **Phòng ngủ Master siêu lớn**: Thiết kế chiếm trọn **2/3 chiều dài nhà**, đem lại không gian nghỉ dưỡng chuẩn khách sạn 5 sao riêng tư và đầy đủ tiện nghi.\n\nAnh/chị có muốn nhận bản vẽ chi tiết bố trí mặt bằng các tầng của mẫu Fusion này để tiện hình dung không ạ? 📐",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    }

    if (lower.includes("cosmo gen 1") || (lower.includes("cosmo") && lower.includes("gen 1")) || lower.includes("sảnh đón") || lower.includes("sanh don")) {
      return {
        topic: "Mẫu nhà phố bề thế Cosmo Gen 1",
        category: "Thông số & Kết cấu",
        summary: "Mẫu nhà Cosmo Gen 1 mặt tiền rộng 5m sở hữu hai lối vào riêng biệt, tạo vẻ bề thế và sang trọng.",
        keywords: ["mẫu cosmo gen 1", "mặt tiền 5m rộng thoáng", "lối vào bộ hành biệt lập", "garage xe hơi riêng"],
        imageQuery: "modern elegant townhouse architecture 5m facade ho chi minh city",
        suggestion: "Dạ, mẫu nhà **Cosmo Gen 1** kích thước **5m x 8.75m** (kết cấu Trệt, lửng, 2 lầu, 1 lầu đa năng) sở hữu những ưu điểm vượt trội:\n\n* 🏠 **Mặt tiền rộng 5m**: Cho cảm giác bề thế, đón gió trời và đón nhận ánh sáng tự nhiên vô cùng rộng thoáng.\n* 🚗 **Lối đi riêng biệt**: Thiết kế sảnh đón khách bộ hành sang trọng và lối vào garage ô tô hoàn toàn tách biệt, mang lại sự tinh tế và riêng tư cao nhất.\n\nĐây là dòng sản phẩm có tổng giá rất mềm, phù hợp cho gia đình từ 3-5 thành viên thích không gian mặt tiền ngang rộng. Anh/chị có muốn em gửi bảng so sánh chi tiết công năng giữa Cosmo Gen 1 và Cosmo Gen 2 không ạ? 🏠",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    }

    if (lower.includes("air và max") || lower.includes("gói air") || lower.includes("goi air") || lower.includes("gói max") || lower.includes("goi max") || lower.includes("bàn giao") || lower.includes("ban giao") || lower.includes("vật liệu") || lower.includes("vat lieu")) {
      return {
        topic: "Gói bàn giao AIR & MAX",
        category: "Tư vấn thiết bị",
        summary: "So sánh điểm khác biệt của gói bàn giao cơ bản AIR và gói bàn giao thông minh cao cấp MAX.",
        keywords: ["gói bàn giao air", "gói bàn giao max", "gỗ an cường", "điện thông minh bytelife", "máy lạnh LG"],
        imageQuery: "modern interior design material samples finishes wood panels metal",
        suggestion: "Dạ, chủ đầu tư thiết kế 2 gói bàn giao hoàn thiện **AIR** và **MAX** vô cùng linh hoạt để anh/chị lựa chọn phù hợp với nhu cầu và ngân sách của gia đình mình:\n\n* 🌬️ **Gói AIR (Bàn giao hoàn thiện cơ bản)**: Đầy đủ phần hoàn thiện thô chất lượng cao bao gồm sơn nước nội ngoại thất Jotun, gạch nền Porcelain Vietceramics chống trơn, trọn bộ thiết bị vệ sinh Inax cao cấp, vách kính tắm 10mm Imundex, và đặc biệt là hệ thống cấp khí tươi sạch **AirTop** lọc bụi mịn bảo vệ sức khỏe. Gói này phù hợp nếu anh/chị muốn tự tay thiết kế nội thất gỗ và sắm sửa thiết bị theo ý thích riêng.\n* 👑 **Gói MAX (Bàn giao thông minh cao cấp)**: Nâng cấp toàn diện từ gói AIR bằng cách tích hợp thêm hệ thống điện thông minh **ByteLife** (cảm biến tự động, máy chủ trung tâm kết nối Zigbee/Wifi), tủ bếp gỗ MDF chống ẩm **An Cường** cao cấp kèm mặt đá granite, phụ kiện giảm chấn Imundex, bếp từ + máy hút mùi âm tủ hiện đại, và hệ thống máy lạnh âm trần/treo tường thương hiệu **LG** cao cấp lắp đặt sẵn ở tất cả các phòng.\n\nAnh/chị muốn lựa chọn bàn giao nhà hoàn thiện cơ bản (gói AIR) hay muốn nhận nhà hoàn thiện thông minh cao cấp (gói MAX) dọn vào ở ngay ạ? 😊",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    }

    // 2. Original Topics
    if (matchedTopic === "Nội thất nhà bếp") {
      return {
        topic: "Nội thất nhà bếp",
        category: "Thiết kế Nội thất",
        summary: "Phương án thiết kế tủ bếp chữ L kịch trần bằng chất liệu MDF An Cường cao cấp cho mẫu nhà Cosmo Gen 2.",
        keywords: ["nội thất bếp", "tủ bếp chữ L", "gỗ mdf an cường", "acrylic bóng gương", "tối ưu không gian góc"],
        imageQuery: "minimalist luxury kitchen cabinet",
        suggestion: customKnowledge 
          ? `Dạ, theo tài liệu bếp: ${summarizeTo20Words(customKnowledge)}`
          : "Dạ, thiết kế tủ bếp chữ L kịch trần bằng chất liệu MDF chống ẩm cao cấp của **An Cường** phủ Acrylic bóng gương vô cùng sang trọng và bền bỉ ạ ✨. Bố trí này vừa tối ưu không gian góc chết, tăng sức chứa thêm 30% và tạo tầm nhìn kết nối thoáng đạt với bàn ăn. Bên em khuyên đặt bồn rửa và bếp từ cách nhau ít nhất 60cm chuẩn phong thủy Thủy - Hỏa tương tế, và tủ lạnh đặt đầu tủ để tiện lưu trữ thực phẩm ạ! 🍳",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    } else if (matchedTopic === "Mẫu nhà Cosmo Gen 2") {
      return {
        topic: "Mẫu nhà Cosmo Gen 2",
        category: "Thông số & Kết cấu",
        summary: "Thông số kỹ thuật mẫu Cosmo Gen 2 diện tích 5mx9m, quy mô 6 tầng, giếng trời Super Bright 7m2 siêu sáng.",
        keywords: ["cosmo gen 2", "diện tích 5x9", "6 tầng sử dụng 250m2", "giếng trời 7m2", "thang máy cao cấp"],
        imageQuery: "modern town house exterior architecture",
        suggestion: customKnowledge
          ? `Dạ, thông số theo bản vẽ: ${summarizeTo20Words(customKnowledge)}`
          : "Dạ đúng rồi ạ, mẫu Cosmo Gen 2 có diện tích đất 5m x 9m nhưng tổng diện tích sử dụng lên tới **250m²** nhờ thiết kế thông minh 6 tầng (1 trệt, 1 lửng, 3 lầu và 1 tầng đa năng) 🏠. Kết cấu này được thiết kế móng cọc bê tông cốt thép cực kỳ vững chắc. Đặc biệt sở hữu giếng trời **'Super Bright' rộng tới 7m²** giúp đón ánh nắng ngập tràn sức sống đến từng mét vuông nhà, kết hợp thang máy chạy mượt mà và 4 phòng ngủ khép kín en-suite sang trọng ạ! 🌟",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    } else if (matchedTopic === "Vị trí dự án Nyah Phú Định") {
      return {
        topic: "Vị trí dự án Nyah Phú Định",
        category: "Vị trí & Tiện ích",
        summary: "Vị trí đắc địa mặt tiền đường Trương Đình Hội 20m Quận 8, không bị ngập nước và kết nối Võ Văn Kiệt 1.000m.",
        keywords: ["vị trí", "nyah phú định", "trương đình hội lộ giới 20m", "địa chỉ 156 an dương vương", "không ngập nước"],
        imageQuery: "modern town house exterior architecture",
        suggestion: customKnowledge
          ? `Dạ, vị trí dự án: ${summarizeTo20Words(customKnowledge)}`
          : "Dạ, dự án Nyah Phú Định tọa lạc tại địa chỉ **156 An Dương Vương, Phường 16, Quận 8, TP.HCM** 📍, ngay mặt tiền trục đường **Trương Đình Hội (lộ giới quy hoạch 20m)** vừa nâng cấp khang trang. Nhờ cốt đường mới nâng cao ráo cùng cống hộp hộp khẩu độ lớn, toàn bộ khu dự án **hoàn toàn không bị ngập nước** kể cả khi mưa bão lớn hay triều cường. Từ đây kết nối Võ Văn Kiệt chỉ 1.000m, di chuyển sang Quận 1 chỉ tầm **18 phút**, sang Quận 7 Phú Mỹ Hưng chỉ **25 phút** cực kỳ nhanh chóng ạ! 🏠",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    } else if (matchedTopic === "Tiện ích xung quanh") {
      return {
        topic: "Tiện ích xung quanh",
        category: "Vị trí & Tiện ích",
        summary: "Hệ sinh thái tiện ích ngoại khu phong phú bán kính 1-3km: Aeon Mall Bình Tân, Chợ Phú Định, trường học các cấp.",
        keywords: ["tiện ích ngoại khu", "chợ phú định cách 2 phút đi bộ", "aeon mall bình tân cách 12 phút", "mega market bình phú"],
        imageQuery: "modern clean neighborhood park shopping center school street",
        suggestion: customKnowledge
          ? `Dạ, tiện ích xung quanh: ${summarizeTo20Words(customKnowledge)}`
          : "Dạ, bao bọc quanh compound Ny'ah Phú Định là một hệ sinh thái tiện ích ngoại khu vô cùng phong phú và đầy đủ luôn ạ 🏫. Chỉ mất 2 phút đi bộ là tới chợ Phú Định, trường tiểu học và THCS Phú Định kế bên giúp anh/chị đưa đón bé đi học cực kỳ thảnh thơi. Ngoài ra, đại siêu thị Aeon Mall Bình Tân, Mega Market Bình Phú hay bệnh viện Quận 8 cũng chỉ cách khoảng **10-15 phút** chạy xe thôi anh/chị nhé! 🛍️✨",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    } else if (matchedTopic === "Chủ đề khác hoặc dự án khác") {
      return {
        topic: "Chủ đề khác hoặc dự án khác",
        category: "Chủ đề khác",
        summary: "Cuộc trò chuyện đề cập đến dự án khác hoặc nội dung không thuộc phạm vi tư vấn (Phân tích Heuristic).",
        keywords: ["chủ đề khác", "dự án khác", "ngoài danh mục"],
        imageQuery: "modern workspace",
        suggestion: customKnowledge
          ? `Dạ, tư vấn từ tài liệu: ${summarizeTo20Words(customKnowledge)}`
          : "Dạ, hiện tại hệ thống ghi nhận anh/chị đang trao đổi về chủ đề khác hoặc thông tin dự án khác ngoài dự án Nyah Phú Định Quận 8 và mẫu nhà Cosmo Gen 2. Nếu anh/chị cần hỗ trợ thêm thông tin gì về vị trí Nyah Phú Định, thiết kế Cosmo Gen 2, các mẫu nhà hay chính sách thanh toán, pháp lý, bảo hành, hãy cứ hỏi em nhé! 😊",
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    } else {
      // Custom user-defined topics
      return {
        topic: matchedTopic,
        category: "Tư vấn tùy chỉnh",
        summary: `Cuộc hội thoại liên quan đến chủ đề tự thiết lập: ${matchedTopic} (Phân tích Heuristic).`,
        keywords: topicKeywords[matchedTopic] || [matchedTopic],
        imageQuery: "modern design workspace",
        suggestion: customKnowledge
          ? `Dạ, tư vấn về ${matchedTopic}: ${summarizeTo20Words(customKnowledge)}`
          : `Dạ, em nhận thấy anh/chị đang quan tâm đến "${matchedTopic}" 😊. Đây là một chủ đề rất hay và hữu ích. Em rất sẵn lòng giải đáp thêm các thắc mắc chi tiết của anh/chị về khía cạnh này, anh/chị cứ thoải mái chia sẻ thêm nhé! 💬`,
        detectedDestination,
        estimatedDistance,
        estimatedDuration
      };
    }
  };

  // Trigger analysis via Server API
  const handleAnalyzeText = async (textToAnalyze: string) => {
    const trimmed = textToAnalyze.trim();
    if (!trimmed || trimmed.length < 3) {
      setAnalysisError("Cuộc hội thoại quá ngắn để phân tích chi tiết. Vui lòng nói hoặc nhập thêm từ.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAiImageError(null);

    // Tự động phát hiện khi khách hỏi khoảng cách hoặc đường đi
    const lowerText = trimmed.toLowerCase();
    const isDistanceQuery = lowerText.includes("bao xa") || 
                            lowerText.includes("khoảng cách") || 
                            lowerText.includes("cách bao nhiêu") || 
                            lowerText.includes("đường đi") ||
                            lowerText.includes("di chuyển") ||
                            lowerText.includes("mất bao lâu") ||
                            lowerText.includes("bản đồ") ||
                            lowerText.includes("đi tới") ||
                            lowerText.includes("đi đến") ||
                            lowerText.includes("khoang cach") ||
                            lowerText.includes("mat bao lau") ||
                            lowerText.includes("duong di") ||
                            lowerText.includes("ban do") ||
                            lowerText.includes("di toi") ||
                            lowerText.includes("di den");

    if (isDistanceQuery) {
      const extracted = extractLandmarkFromQuery(trimmed);
      if (extracted) {
        const queryWithCity = extracted.toLowerCase().includes("hồ chí minh") || extracted.toLowerCase().includes("hcm")
          ? extracted
          : `${extracted}, Hồ Chí Minh`;

        setSelectedDestination(queryWithCity);
        const lowerDest = extracted.toLowerCase();
        let dist = "5.0 km";
        let dur = "12 phút di chuyển";
        if (lowerDest.includes("chợ rẫy") || lowerDest.includes("cho ray")) {
          dist = "6.2 km";
          dur = "15 phút di chuyển";
        } else if (lowerDest.includes("hùng vương") || lowerDest.includes("hung vuong")) {
          dist = "5.8 km";
          dur = "13 phút di chuyển";
        } else if (lowerDest.includes("từ dũ") || lowerDest.includes("tu du")) {
          dist = "7.5 km";
          dur = "18 phút di chuyển";
        } else if (lowerDest.includes("đại học y dược") || lowerDest.includes("dai hoc y duoc")) {
          dist = "5.2 km";
          dur = "12 phút di chuyển";
        } else if (lowerDest.includes("nguyễn tri phương") || lowerDest.includes("nguyen tri phuong")) {
          dist = "4.8 km";
          dur = "11 phút di chuyển";
        } else if (lowerDest.includes("an đông") || lowerDest.includes("an dong")) {
          dist = "5.5 km";
          dur = "12 phút di chuyển";
        } else if (lowerDest.includes("đầm sen") || lowerDest.includes("dam sen")) {
          dist = "4.8 km";
          dur = "10 phút di chuyển";
        } else if (lowerDest.includes("tân sơn nhất") || lowerDest.includes("tan son nhat") || lowerDest.includes("sân bay") || lowerDest.includes("san bay")) {
          dist = "12 km";
          dur = "30 phút di chuyển";
        } else if (lowerDest.includes("bến xe miền tây") || lowerDest.includes("mien tay")) {
          dist = "3.8 km";
          dur = "8 phút di chuyển";
        }
        setRouteInfo({ distance: dist, duration: dur });
        addCustomDestinationToHistory(extracted, queryWithCity, dist, dur);
      } else {
        // Tìm điểm gần nhất phù hợp trong SURROUNDING_PLACES
        const matchedPlace = SURROUNDING_PLACES.find(place => {
          const placeNameLower = place.name.toLowerCase();
          if (placeNameLower.includes("chợ phú định")) {
            return lowerText.includes("chợ phú định") || lowerText.includes("cho phu dinh") || 
              (/\bchợ\b/i.test(lowerText) && !lowerText.includes("chợ rẫy") && !lowerText.includes("cho ray") && !lowerText.includes("chợ bến thành") && !lowerText.includes("cho ben thanh") && !lowerText.includes("chợ an đông") && !lowerText.includes("cho an dong"));
          }
          if (placeNameLower.includes("trường thcs phú định")) {
            return lowerText.includes("trường thcs phú định") || lowerText.includes("truong thcs phu dinh") || 
              (/\btrường\b/i.test(lowerText) || /\btruong\b/i.test(lowerText) || /\bthcs\b/i.test(lowerText) || /\bhọc\b/i.test(lowerText) || /\bhoc\b/i.test(lowerText));
          }
          if (placeNameLower.includes("võ văn kiệt")) {
            return lowerText.includes("võ văn kiệt") || lowerText.includes("vo van kiet") || lowerText.includes("văn kiệt") || lowerText.includes("van kiet") || lowerText.includes("vòng xoay") || lowerText.includes("đại lộ") || lowerText.includes("dai lo");
          }
          if (placeNameLower.includes("mega market")) {
            return lowerText.includes("mega") || lowerText.includes("market") || lowerText.includes("bình phú") || lowerText.includes("binh phu");
          }
          if (placeNameLower.includes("bệnh viện")) {
            const hasOtherHospital = lowerText.includes("chợ rẫy") || lowerText.includes("cho ray") ||
                                     lowerText.includes("hùng vương") || lowerText.includes("hung vuong") ||
                                     lowerText.includes("từ dũ") || lowerText.includes("tu du") ||
                                     lowerText.includes("đại học y dược") || lowerText.includes("dai hoc y duoc") ||
                                     lowerText.includes("nguyễn tri phương") || lowerText.includes("nguyen tri phuong") ||
                                     lowerText.includes("nhi đồng") || lowerText.includes("nhi dong");
            return (lowerText.includes("bệnh viện") || lowerText.includes("benh vien") || lowerText.includes("y tế") || lowerText.includes("y te")) && !hasOtherHospital;
          }
          if (placeNameLower.includes("aeon")) {
            return lowerText.includes("aeon") || lowerText.includes("bình tân") || lowerText.includes("binh tan");
          }
          if (placeNameLower.includes("bến thành")) {
            return lowerText.includes("bến thành") || lowerText.includes("ben thanh") || lowerText.includes("quận 1") || lowerText.includes("quan 1");
          }
          return false;
        });
 
        if (matchedPlace) {
          setSelectedDestination(matchedPlace.query);
          setRouteInfo({
            distance: matchedPlace.distance,
            duration: matchedPlace.time
          });
          addCustomDestinationToHistory(matchedPlace.name, matchedPlace.query, matchedPlace.distance, matchedPlace.time);
        } else {
          // Fallback mặc định đến Võ Văn Kiệt
          const defaultPlace = SURROUNDING_PLACES[2]; // Võ Văn Kiệt
          setSelectedDestination(defaultPlace.query);
          setRouteInfo({
            distance: defaultPlace.distance,
            duration: defaultPlace.time
          });
          addCustomDestinationToHistory(defaultPlace.name, defaultPlace.query, defaultPlace.distance, defaultPlace.time);
        }
      }
    }

    // If analysisMode is heuristic, bypass API entirely
    if (analysisMode === "heuristic") {
      setTimeout(() => {
        const localAnalysis = preprocessAnalysisWithRoute(getLocalHeuristicAnalysis(trimmed));
        const isSameTopic = currentAnalysis && currentAnalysis.topic === localAnalysis.topic;
        if (!isSameTopic) {
          setCustomAiImage(null);
        }

        setCurrentAnalysis(localAnalysis);
        lastAnalyzedTextRef.current = trimmed;

        const timeString = new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const newSession: SavedTopicSession = {
          id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: timeString,
          transcript: trimmed,
          analysis: localAnalysis,
          customAiImageUrl: null,
        };

        setSavedSessions((prev) => [newSession, ...prev]);
        setSelectedHistoryId(newSession.id);

        setTranscript("");
        setInterimTranscript("");
        setIsAnalyzing(false);
      }, 400);
      return;
    }

    try {
      const allLevel2Kws = new Set<string>();
      secondLevelKeywords.forEach((cfg) => {
        const subKws = cfg.keyword.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
        subKws.forEach((kw) => {
          allLevel2Kws.add(normalizePhrase(kw));
        });
      });

      const mergedKeywordsMap: Record<string, string[]> = {};
      Object.entries(topicKeywords).forEach(([topic, kws]) => {
        const list: string[] = [];
        (kws as string[]).forEach((kw) => {
          const normKw = normalizePhrase(kw);
          // Trường hợp từ khóa đã được thêm vào từ khóa lớp 2 thì không nên thêm vào bất kỳ chủ đề nào khác
          if (allLevel2Kws.has(normKw)) {
            return;
          }
          list.push(kw);
        });
        mergedKeywordsMap[topic] = list;
      });

      const response = await fetch("/api/analyze-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: trimmed,
          activeTopics: Object.keys(topicKeywords),
          topicKeywordsMap: mergedKeywordsMap,
          topicKnowledge: topicKnowledge,
          isSelfLearningDisabled: true
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gặp sự cố khi gửi dữ liệu phân tích");
      }

      if (data.success && data.analysis) {
        const newAnalysis: AnalysisResult = preprocessAnalysisWithRoute(data.analysis);
        
        // If the new topic is different from the current topic, reset custom AI image
        const isSameTopic = currentAnalysis && currentAnalysis.topic === newAnalysis.topic;
        if (!isSameTopic) {
          setCustomAiImage(null);
        }

        if (newAnalysis.detectedDestination) {
          // Tự động chuyển hình ảnh sang "Tiện ích xung quanh" (bản đồ ngoại khu)
          newAnalysis.topic = "Tiện ích xung quanh";
          newAnalysis.category = "Vị trí & Tiện ích";

          const destName = newAnalysis.detectedDestination;
          const queryWithCity = destName.toLowerCase().includes("hồ chí minh") || destName.toLowerCase().includes("hcm")
            ? destName
            : `${destName}, Hồ Chí Minh`;
          setSelectedDestination(queryWithCity);
          if (newAnalysis.estimatedDistance && newAnalysis.estimatedDuration) {
            setRouteInfo({
              distance: newAnalysis.estimatedDistance,
              duration: newAnalysis.estimatedDuration
            });
          }
          addCustomDestinationToHistory(
            destName,
            queryWithCity,
            newAnalysis.estimatedDistance || "Đang đo...",
            newAnalysis.estimatedDuration || "Đang đo..."
          );
        }

        if (isDistanceQuery) {
          newAnalysis.topic = "Tiện ích xung quanh";
          newAnalysis.category = "Vị trí & Tiện ích";
        }

        setCurrentAnalysis(newAnalysis);
        lastAnalyzedTextRef.current = trimmed;

        // Auto-learn is disabled as requested by the user.
        // We do not run learnNewKeywords or show learnedNotification here.

        // Auto-save this session to Timeline History
        const timeString = new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const newSession: SavedTopicSession = {
          id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        safeSaveToLocalStorage("chatbot_messages_list", JSON.stringify(updatedMessages));
      }
    } catch (error: any) {
      console.error("Chatbot API Error:", error);
      
      // Fallback locally using heuristic matcher
      const localResult = preprocessAnalysisWithRoute(getLocalHeuristicAnalysis(trimmedInput));
      const botReplyText = localResult.suggestion || "Dạ em chưa tìm thấy thông tin này trong dữ liệu, anh/chị vui lòng nhập rõ ý hơn hoặc liên hệ hotline để bên em hỗ trợ trực tiếp nhé ạ.";
      
      const botMsg = {
        id: `bot_fallback_${Date.now()}`,
        sender: "bot" as const,
        text: botReplyText,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      };
 
      const updatedMessages = [...newMessages, botMsg];
      setChatMessages(updatedMessages);
      safeSaveToLocalStorage("chatbot_messages_list", JSON.stringify(updatedMessages));
    } finally {��i bị quá tải hoặc đạt tối đa số lượt gọi trong ngày/phút.\n\n" +
          "👉 Cách khắc phục tức thì:\n" +
          "1. Anh/Chị vui lòng chờ khoảng 30 giây đến 1 phút rồi bấm phân tích lại (hoặc bấm chạy kịch bản mẫu).\n" +
          "2. Để sử dụng ổn định lâu dài và không bao giờ gặp lỗi này, Anh/Chị hãy cấu hình API Key cá nhân của mình bằng cách vào menu Settings (biểu tượng bánh răng ở góc trên bên phải) > Secrets, thêm một phím mới với tên là GEMINI_API_KEY và dán mã khóa API Key của Anh/Chị vào."
        );
      } else if (
        errMsg.includes("503") ||
        errMsg.toLowerCase().includes("demand") ||
        errMsg.toLowerCase().includes("unavailable")
      ) {
        setAnalysisError(
          "⚠️ Lỗi hệ thống quá tải (Service Unavailable - Error 503)\n\n" +
          "Máy chủ AI Gemini của Google hiện tại đang nhận được lượng yêu cầu quá lớn từ người dùng trên toàn thế giới nên tạm thời không thể xử lý ngay lập tức (quá tải đột xuất).\n\n" +
          "👉 Cách khắc phục:\n" +
          "1. Anh/Chị vui lòng đợi khoảng vài chục giây rồi bấm thử phân tích lại nhé ạ.\n" +
          "2. Nếu anh/chị đã có API Key riêng của mình, việc thiết lập khóa cá nhân trong phần Settings > Secrets với tên GEMINI_API_KEY sẽ giúp ưu tiên băng thông ổn định hơn rất nhiều."
        );
      } else {
        setAnalysisError(err.message || "Không thể kết nối với máy chủ AI");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 1. Tự động đếm ngược giây khi nhận diện sự thay đổi của text để kích hoạt phân tích (Pause Detection / Debounce)
  useEffect(() => {
    const fullText = (transcript + interimTranscript).trim();
    
    // Nếu chưa có text hoặc text chưa thay đổi so với lần phân tích cuối, không làm gì cả
    if (!fullText || fullText.length < 3 || fullText === lastAnalyzedTextRef.current) {
      setSecondsSinceLastSpeech(null);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      return;
    }

    if (!isListening && !isSimulating) {
      setSecondsSinceLastSpeech(null);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      return;
    }

    // Bắt đầu đếm ngược 1 giây ngừng nói để tự động phân tích
    setSecondsSinceLastSpeech(1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      handleAnalyzeText(fullText);
      setSecondsSinceLastSpeech(null);
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [transcript, interimTranscript, isListening, isSimulating]);

  // 2. Bộ đếm ngược giây trực quan cập nhật giao diện
  useEffect(() => {
    if (secondsSinceLastSpeech === null || secondsSinceLastSpeech <= 0) return;

    const interval = setInterval(() => {
      setSecondsSinceLastSpeech((prev) => {
        if (prev !== null && prev > 1) {
          return prev - 1;
        }
        return null;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsSinceLastSpeech]);

  // 3. Cơ chế Định kỳ an toàn (đề phòng người dùng nói siêu dài không ngừng nghỉ)
  const textRef = useRef("");
  useEffect(() => {
    textRef.current = (transcript + interimTranscript).trim();
  }, [transcript, interimTranscript]);

  useEffect(() => {
    if (isListening || isSimulating) {
      autoAnalyzeTimerRef.current = setInterval(() => {
        const currentText = textRef.current;
        if (currentText && currentText.length > 25 && currentText !== lastAnalyzedTextRef.current) {
          handleAnalyzeText(currentText);
        }
      }, 8000); // 8 giây tự động cập nhật nếu nói liên tục không ngừng
    } else {
      if (autoAnalyzeTimerRef.current) {
        clearInterval(autoAnalyzeTimerRef.current);
        autoAnalyzeTimerRef.current = null;
      }
    }

    return () => {
      if (autoAnalyzeTimerRef.current) {
        clearInterval(autoAnalyzeTimerRef.current);
      }
    };
  }, [isListening, isSimulating]);

  // Custom AI Image Generation
  const generateAiImage = async () => {
    if (!currentAnalysis) return;

    setAiImageLoading(true);
    setAiImageError(null);
    setCustomAiImage(null);

    try {
      const query = currentAnalysis.imageQuery || currentAnalysis.topic;
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: query }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Không thể tạo ảnh từ Gemini");
      }

      if (data.success && data.imageUrl) {
        setCustomAiImage(data.imageUrl);

        // Update active history item with the custom image
        if (selectedHistoryId) {
          setSavedSessions((prev) =>
            prev.map((s) => (s.id === selectedHistoryId ? { ...s, customAiImageUrl: data.imageUrl } : s))
          );
        }
      }
    } catch (err: any) {
      console.log("Không thể tạo tranh AI (Gemini):", err.message || err);
      if (err.message?.toLowerCase().includes("billing") || err.message?.toLowerCase().includes("quota") || err.message?.toLowerCase().includes("api key")) {
        setAiImageError(
          "Tính năng tạo ảnh AI yêu cầu Phím API Gemini trả phí. Ứng dụng đã tự động hiển thị ảnh Unsplash chất lượng cao để thay thế bên dưới rồi ạ! ✨"
        );
      } else {
        setAiImageError(err.message || "Gặp lỗi khi truyền lệnh vẽ ảnh.");
      }
    } finally {
      setAiImageLoading(false);
    }
  };

  // Simulate a realistic voice transcription typing
  const runScenarioSimulation = (scenario: ConversationScenario) => {
    isSimulatingRef.current = true;
    setIsSimulating(true);

    setSelectedScenario(scenario.id);
    setTranscript("");
    setInterimTranscript("");
    setCurrentAnalysis(null);
    setCustomAiImage(null);

    const fullWords = scenario.conversation.split(" ");
    let currentIdx = 0;
    let accumulatedText = "";

    const interval = setInterval(() => {
      if (currentIdx < fullWords.length) {
        // Feed 2-3 words at a time to simulate conversational speaking speed
        const chunk = fullWords.slice(currentIdx, currentIdx + 3).join(" ") + " ";
        accumulatedText += chunk;
        setTranscript(accumulatedText);
        currentIdx += 3;
      } else {
        clearInterval(interval);
        isSimulatingRef.current = false;
        setIsSimulating(false);
        // Trigger final analysis
        handleAnalyzeText(accumulatedText);
      }
    }, 400);
  };

  // Click on timeline history to view past records
  const handleSelectHistorySession = (session: SavedTopicSession) => {
    setSelectedHistoryId(session.id);
    setCurrentAnalysis(session.analysis);
    setCustomAiImage(session.customAiImageUrl);
    setTranscript(session.transcript);
    setInterimTranscript("");
    setAiImageError(null);
  };

  // Clear active session inputs and analysis (but keep persistent logs safe)
  const resetAll = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setIsSimulating(false);
    setTranscript("");
    setInterimTranscript("");
    setCurrentAnalysis(null);
    setCustomAiImage(null);
    setSelectedHistoryId(null);
    setSelectedScenario("");
    setRecognitionError(null);
    setAnalysisError(null);
    setLastValidTopic(null);
    setLastValidAnalysis(null);
    lastAnalyzedTextRef.current = "";
    setActiveSubConfigWithDelay(null);
    lastSubConfigIdRef.current = null;

    // Reset Chatbot messages as well
    const initialChat = [
      {
        id: "init",
        sender: "bot",
        text: "Xin chào quý khách. Tôi là trợ lý ảo của dự án Nyah Phú Định từ chủ đầu tư Nhã Đạt. Quý khách đang quan tâm đến thông tin nào của dự án ạ?",
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      }
    ];
    setChatMessages(initialChat);
    try {
      localStorage.removeItem("chatbot_messages_list");
    } catch (e) {
      console.error(e);
    }
  };

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (appMode === "chatbot" && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, appMode]);

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedInput = chatInput.trim();
    if (!trimmedInput || isChatResponding) return;

    const userMsg = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender: "user" as const,
      text: trimmedInput,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    };

    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setIsChatResponding(true);

    safeSaveToLocalStorage("chatbot_messages_list", JSON.stringify(newMessages));

    try {
      // Build conversation history of the last 6 messages for full multi-turn context
      const chatHistoryList = chatMessages.filter(m => m.id !== "init").slice(-5);
      const historyText = chatHistoryList.length > 0 
        ? chatHistoryList.map(m => `${m.sender === "user" ? "Khách" : "Tư vấn"}: ${m.text}`).join("\n") + `\nKhách: ${trimmedInput}`
        : trimmedInput;

      const allLevel2Kws = new Set<string>();
      secondLevelKeywords.forEach((cfg) => {
        const subKws = cfg.keyword.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
        subKws.forEach((kw) => {
          allLevel2Kws.add(normalizePhrase(kw));
        });
      });

      const mergedKeywordsMap: Record<string, string[]> = {};
      Object.entries(topicKeywords).forEach(([topic, kws]) => {
        const list: string[] = [];
        (kws as string[]).forEach((kw) => {
          const normKw = normalizePhrase(kw);
          // Trường hợp từ khóa đã được thêm vào từ khóa lớp 2 thì không nên thêm vào bất kỳ chủ đề nào khác
          if (allLevel2Kws.has(normKw)) {
            return;
          }
          list.push(kw);
        });
        mergedKeywordsMap[topic] = list;
      });

      const response = await fetch("/api/analyze-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: historyText,
          activeTopics: Object.keys(topicKeywords),
          topicKeywordsMap: mergedKeywordsMap,
          topicKnowledge: topicKnowledge,
          isSelfLearningDisabled: true
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gặp sự cố khi gửi dữ liệu phân tích");
      }

      if (data.success && data.analysis) {
        const newAnalysis: AnalysisResult = preprocessAnalysisWithRoute(data.analysis);
        
        // Sync layout topic with what Gemini detected so the Left Panel updates its content/image!
        if (newAnalysis.topic) {
          const isSameTopic = currentAnalysis && currentAnalysis.topic === newAnalysis.topic;
          if (!isSameTopic) {
            setCustomAiImage(null);
          }
          setCurrentAnalysis(newAnalysis);
          
          if (newAnalysis.detectedDestination) {
            newAnalysis.topic = "Tiện ích xung quanh";
            newAnalysis.category = "Vị trí & Tiện ích";
            const destName = newAnalysis.detectedDestination;
            const queryWithCity = destName.toLowerCase().includes("hồ chí minh") || destName.toLowerCase().includes("hcm")
              ? destName
              : `${destName}, Hồ Chí Minh`;
            setSelectedDestination(queryWithCity);
            if (newAnalysis.estimatedDistance && newAnalysis.estimatedDuration) {
              setRouteInfo({
                distance: newAnalysis.estimatedDistance,
                duration: newAnalysis.estimatedDuration
              });
            }
          }
        }

        const botReplyText = newAnalysis.suggestion || newAnalysis.summary || "Dạ em chưa tìm thấy thông tin này trong hệ thống dữ liệu dự án ạ.";

        const botMsg = {
          id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sender: "bot" as const,
          text: botReplyText,
          timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        };

        const updatedMessages = [...newMessages, botMsg];
        setChatMessages(updatedMessages);

        try {
          localStorage.setItem("chatbot_messages_list", JSON.stringify(updatedMessages));
        } catch (err) {
          console.error(err);
        }
      }
    } catch (error: any) {
      console.error("Chatbot API Error:", error);
      
      // Fallback locally using heuristic matcher
      const localResult = preprocessAnalysisWithRoute(getLocalHeuristicAnalysis(trimmedInput));
      const botReplyText = localResult.suggestion || "Dạ em chưa tìm thấy thông tin này trong dữ liệu, anh/chị vui lòng nhập rõ ý hơn hoặc liên hệ hotline để bên em hỗ trợ trực tiếp nhé ạ.";
      
      const botMsg = {
        id: `bot_fallback_${Date.now()}`,
        sender: "bot" as const,
        text: botReplyText,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      };

      const updatedMessages = [...newMessages, botMsg];
      setChatMessages(updatedMessages);
      try {
        localStorage.setItem("chatbot_messages_list", JSON.stringify(updatedMessages));
      } catch (err) {
        console.error(err);
      }
    } finally {
      setIsChatResponding(false);
    }
  };

  // Download conversation logs as beautifully formatted, structural text report
  const downloadAllLogsText = () => {
    if (savedSessions.length === 0) return;
    
    let content = `========================================================================\n`;
    content += `        NHẬT KÝ HỘI THOẠI & PHÂN TÍCH CHỦ ĐỀ - NHADAT.COMPANY\n`;
    content += `        Thời gian xuất file: ${new Date().toLocaleString("vi-VN")}\n`;
    content += `========================================================================\n\n`;
    
    savedSessions.forEach((session, index) => {
      content += `[Phiên ${index + 1}] - Thời gian ghi nhận: ${session.timestamp}\n`;
      content += `------------------------------------------------------------\n`;
      content += `💬 Nội dung cuộc trò chuyện:\n"${session.transcript}"\n\n`;
      content += `🤖 AI Phân tích:\n`;
      content += `   - Chủ đề: ${session.analysis.topic}\n`;
      content += `   - Danh mục: ${session.analysis.category}\n`;
      content += `   - Ý chính tóm tắt: ${session.analysis.summary}\n`;
      content += `   - Từ khóa chính: ${session.analysis.keywords.join(", ")}\n`;
      content += `   - Ý kiến/Gợi ý tư vấn: ${session.analysis.suggestion}\n`;
      content += `============================================================\n\n`;
    });
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `NhatKy_CuocHoiThoai_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download conversation logs as JSON structural file
  const downloadAllLogsJson = () => {
    if (savedSessions.length === 0) return;
    const content = JSON.stringify(savedSessions, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Log_HoiThoai_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Safe clearing of persistent log history
  const clearAllLogs = () => {
    setSavedSessions([]);
    setSelectedHistoryId(null);
    localStorage.removeItem("saved_conversation_sessions");
    setConfirmClearLogs(false);
  };

  // Check if the current conversation belongs to any preset topic
  const currentText = (transcript + interimTranscript).trim();
  const isUserSpeaking = currentText.length > 0;

  // We consider a topic as active if the user is currently speaking/typing and it matches a preset topic heuristically,
  // OR if they aren't speaking but we have a valid analysis on a text that did belong to a preset topic.
  const hasActiveTopic = isUserSpeaking
    ? (detectTopicHeuristically(currentText) !== null)
    : (currentAnalysis !== null && lastAnalyzedTextRef.current !== "" && detectTopicHeuristically(lastAnalyzedTextRef.current) !== null);

  // The active topic for the image card
  // We prioritize predictedTopic (real-time voice keyword detection) over currentAnalysis.topic to ensure INSTANT, ultra-reactive image switching as the user is speaking!
  let activeImageTopic = (predictedTopic && predictedTopic !== "Chủ đề khác hoặc dự án khác" ? predictedTopic : null)
    || (currentAnalysis && currentAnalysis.topic && currentAnalysis.topic !== "Chủ đề khác hoặc dự án khác" ? currentAnalysis.topic : null)
    || lastValidTopic
    || "Vị trí dự án Nyah Phú Định";

  // Override off-topic/general classification if local heuristic matches a specific preset topic (e.g. "bàn ăn nhanh" matches "Nội thất nhà bếp")
  if (
    (activeImageTopic === "Chủ đề khác hoặc dự án khác" || !activeImageTopic) &&
    predictedTopic &&
    predictedTopic !== "Chủ đề khác hoặc dự án trước" &&
    predictedTopic !== "Chủ đề khác hoặc dự án khác"
  ) {
    activeImageTopic = predictedTopic;
  }

  // Nếu predictedTopic là con/cháu của activeImageTopic trong cấu trúc cây chủ đề (ví dụ: Nội thất nhà bếp là con của Mẫu nhà Cosmo Gen 2),
  // ta ưu tiên chọn predictedTopic (vì người dùng đang đề cập đi sâu vào chi tiết của mẫu nhà đó)
  if (predictedTopic && activeImageTopic && predictedTopic !== activeImageTopic) {
    let curr: string | null = predictedTopic;
    let isChild = false;
    while (curr && topicParents[curr]) {
      if (topicParents[curr] === activeImageTopic) {
        isChild = true;
        break;
      }
      curr = topicParents[curr];
    }
    if (isChild) {
      activeImageTopic = predictedTopic;
    }
  }

  // Prioritize displaying the image of the second-level keyword.
  // If we find any active second-level keyword in the transcript, we override activeImageTopic with its parent topic.
  const matchedSubConfig = findAnyMatchedSecondLevelConfig();
  if (matchedSubConfig) {
    activeImageTopic = matchedSubConfig.parentTopic;
  }

  // Fallback unrecognized or off-topic transitions to the last valid topic instead of jumping back to the location image
  if (activeImageTopic === "Chủ đề khác hoặc dự án khác" || !activeImageTopic) {
    activeImageTopic = (lastValidTopic && lastValidTopic !== "Chủ đề khác hoặc dự án khác") ? lastValidTopic : "Vị trí dự án Nyah Phú Định";
  }

  // The active analysis result for the suggestion card on the right
  const activeAnalysis = (currentAnalysis && currentAnalysis.topic && currentAnalysis.topic !== "Chủ đề khác hoặc dự án khác" ? currentAnalysis : null)
    || lastValidAnalysis
    || lookupDefaultAnalysis(activeImageTopic)
    || lookupDefaultAnalysis("Vị trí dự án Nyah Phú Định");

  // Update lastActiveHouseModel to keep track of the currently selected/discussed house model context
  useEffect(() => {
    if (activeImageTopic) {
      const norm = activeImageTopic.toLowerCase();
      if (norm.includes("cosmo") || norm.includes("fusion") || norm.includes("mau nha")) {
        setLastActiveHouseModel(activeImageTopic);
      }
    }
  }, [activeImageTopic]);

  // Update lastValidTopic and lastValidAnalysis whenever there's a valid new analysis or prediction
  useEffect(() => {
    if (currentAnalysis && currentAnalysis.topic) {
      let topicToUse = currentAnalysis.topic;
      if (topicToUse === "Chủ đề khác hoặc dự án khác" && predictedTopic && predictedTopic !== "Chủ đề khác hoặc dự án khác") {
        topicToUse = predictedTopic;
      }
      if (topicToUse === "Chủ đề khác hoặc dự án khác") {
        topicToUse = (lastValidTopic && lastValidTopic !== "Chủ đề khác hoặc dự án khác") ? lastValidTopic : "Vị trí dự án Nyah Phú Định";
      }
      setLastValidTopic(topicToUse);

      if (topicToUse === currentAnalysis.topic) {
        setLastValidAnalysis(currentAnalysis);
      } else {
        const matchedSession = savedSessions.find((s) => s.analysis.topic === topicToUse);
        if (matchedSession) {
          setLastValidAnalysis(matchedSession.analysis);
        } else {
          setLastValidAnalysis(lookupDefaultAnalysis(topicToUse));
        }
      }
    } else if (predictedTopic && predictedTopic !== "Chủ đề khác hoặc dự án khác") {
      setLastValidTopic(predictedTopic);
      // Find a past session with this topic to preload the consultant advice instantly
      const matchedSession = savedSessions.find((s) => s.analysis.topic === predictedTopic);
      if (matchedSession) {
        setLastValidAnalysis(matchedSession.analysis);
      } else {
        // If no past session, fallback to default preset analysis
        setLastValidAnalysis(lookupDefaultAnalysis(predictedTopic));
      }
    }
  }, [currentAnalysis, predictedTopic, savedSessions, lastValidTopic]);

  // Tab-switching useEffect removed as Google Maps is disabled.

  // Effect to manage the 2nd-level keyword transition delay
  useEffect(() => {
    const rawActiveSubConfig = getActiveSecondLevelConfig(activeImageTopic);
    const isTopicChanged = lastTopicRef.current !== activeImageTopic;
    lastTopicRef.current = activeImageTopic;
    
    if (rawActiveSubConfig) {
      // Prioritize second-level keyword images by switching to them instantly with zero delay!
      if (subConfigTimerRef.current) {
        clearTimeout(subConfigTimerRef.current);
        subConfigTimerRef.current = null;
      }
      lastSubConfigIdRef.current = rawActiveSubConfig.id;
      setActiveSubConfigWithDelay(rawActiveSubConfig);
    } else {
      // No active second-level keyword matched in the current active transcript.
      if (isTopicChanged) {
        // If the main topic actually changed to a completely new topic, clear the sub-config
        if (subConfigTimerRef.current) {
          clearTimeout(subConfigTimerRef.current);
          subConfigTimerRef.current = null;
        }
        lastSubConfigIdRef.current = null;
        setActiveSubConfigWithDelay(null);
      } else {
        // If the topic is still the same, DO NOT reset activeSubConfigWithDelay to null!
        // This preserves the last activated sub-config for the current parent topic and prevents it from reverting back.
      }
    }
  }, [transcript, interimTranscript, activeImageTopic, secondLevelKeywords]);

  // Compute target image source
  const finalActiveImageTopic = testActiveTopic || activeImageTopic;
  const activeSubConfig = testActiveTopic ? testActiveSubConfig : activeSubConfigWithDelay;
  let subConfigImageCandidate: string | null = null;
  if (activeSubConfig && activeSubConfig.imageUrl) {
    const cleanSubUrl = activeSubConfig.imageUrl.split("?")[0];
    if (!failedLocalUrls[cleanSubUrl]) {
      subConfigImageCandidate = activeSubConfig.imageUrl.startsWith("/")
        ? `${activeSubConfig.imageUrl}?v=${imageVersion}`
        : activeSubConfig.imageUrl;
    }
  }

  const localImageCandidate = subConfigImageCandidate || getLocalTopicImage(finalActiveImageTopic);

  const targetImageSrc = (localImageCandidate && (localImageCandidate.startsWith("/images/") || localImageCandidate.includes("?v=")))
    ? localImageCandidate
    : (customAiImage && activeAnalysis?.topic === finalActiveImageTopic)
      ? customAiImage
      : localImageCandidate
        ? localImageCandidate
        : "";

  useEffect(() => {
    if (!targetImageSrc) {
      setDisplayedTvImageSrc("");
      return;
    }

    // UPDATE IMAGE SOURCE INSTANTLY to initiate the visual transition immediately without waiting!
    setDisplayedTvImageSrc(targetImageSrc);
    setIsPreloading(true);

    const img = new Image();
    img.src = targetImageSrc;
    img.onload = () => {
      if (img.width > 0 && img.height > 0) {
        // Update aspect ratio once loaded to refine the layout container height
        setImageAspectRatio(img.width / img.height);
      }
      setIsPreloading(false);
    };
    img.onerror = () => {
      setIsPreloading(false);
    };
  }, [targetImageSrc]);

  // Synchronize isCurrentImageLoaded state with targetImageSrc changes
  useEffect(() => {
    if (targetImageSrc) {
      setIsCurrentImageLoaded(false);
    } else {
      setIsCurrentImageLoaded(true);
    }
  }, [targetImageSrc]);

  useEffect(() => {
    // Update text, topic, and analysis instantly! Zero delay for slide content transitions.
    setDisplayedTopic(finalActiveImageTopic);
    setDisplayedAnalysis(activeAnalysis);
    setIsPreloading(false);
  }, [finalActiveImageTopic, activeAnalysis]);

  const renderSlideAnswer = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return (
      <div className="space-y-4">
        {lines.map((line, lineIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          const isBullet = trimmed.startsWith("-") || trimmed.startsWith("+") || trimmed.startsWith("*");
          const contentText = isBullet ? trimmed.substring(1).trim() : trimmed;

          const parts = contentText.split(/(\*\*[^*]+\*\*)/g);
          const processedContent = parts.map((part, partIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={partIdx} className="font-bold text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/25">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });

          if (isBullet) {
            return (
              <div key={lineIdx} className="flex items-start gap-2 text-[18.75px] font-sans font-bold leading-relaxed text-slate-100 pl-1.5">
                <span className="text-rose-500 mt-2 select-none text-[12px]">■</span>
                <span className="flex-1">{processedContent}</span>
              </div>
            );
          }

          return (
            <p key={lineIdx} className="text-[18.75px] font-sans font-bold leading-relaxed text-slate-100">
              {processedContent}
            </p>
          );
        })}
      </div>
    );
  };

  const renderFormattedText = (text: string, isUser: boolean) => {
    if (!text) return "";
    const lines = text.split("\n");
    return (
      <div className="space-y-2.5">
        {lines.map((line, lineIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={lineIdx} className="h-1" />;

          const isBullet = trimmed.startsWith("-") || trimmed.startsWith("+") || trimmed.startsWith("*");
          const contentText = isBullet ? trimmed.substring(1).trim() : trimmed;

          const parts = contentText.split(/(\*\*[^*]+\*\*)/g);
          const processedContent = parts.map((part, partIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={partIdx} className={isUser ? "font-bold text-white" : "font-bold text-slate-900 bg-rose-500/5 px-1 py-0.5 rounded border border-rose-500/10"}>
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });

          if (isBullet) {
            return (
              <div key={lineIdx} className={`flex gap-2 items-start leading-relaxed pl-1.5 ${isUser ? "text-slate-100" : "text-slate-700"}`}>
                <span className="text-rose-500 mt-1.5 select-none text-[10px]">✦</span>
                <span className="flex-1">{processedContent}</span>
              </div>
            );
          }

          return (
            <p key={lineIdx} className={`leading-relaxed ${isUser ? "text-slate-100" : "text-slate-700"}`}>
              {processedContent}
            </p>
          );
        })}
      </div>
    );
  };

  if (currentPath === "admin") {
    return (
      <AdminPage
        topicKeywords={topicKeywords}
        setTopicKeywords={setTopicKeywords}
        topicParents={topicParents}
        setTopicParents={setTopicParents}
        secondLevelKeywords={secondLevelKeywords}
        setSecondLevelKeywords={setSecondLevelKeywords}
        topicKnowledge={topicKnowledge}
        setTopicKnowledge={setTopicKnowledge}
        topicConciseSummaries={topicConciseSummaries}
        setTopicConciseSummaries={setTopicConciseSummaries}
        isConfigsLoaded={isConfigsLoaded}
        scannedFolderImages={scannedFolderImages}
        fetchScannedFolderImages={fetchScannedFolderImages}
        imageVersion={imageVersion}
        setImageVersion={setImageVersion}
        predictedTopic={predictedTopic}
        addNewTopic={addNewTopic}
        learnNewKeywords={learnNewKeywords}
        expandAllTopics={expandAllTopics}
        collapseAllTopics={collapseAllTopics}
        resetToDefaultTopics={resetToDefaultTopics}
        addSecondLevelKeyword={addSecondLevelKeyword}
        removeSecondLevelKeyword={removeSecondLevelKeyword}
        updateSecondLevelKeyword={updateSecondLevelKeyword}
        syncNotification={syncNotification}
        setSyncNotification={setSyncNotification}
        setCurrentPath={setCurrentPath}
        expandedTopics={expandedTopics}
        setExpandedTopics={setExpandedTopics}
        editingTopic={editingTopic}
        setEditingTopic={setEditingTopic}
        editingSubId={editingSubId}
        setEditingSubId={setEditingSubId}
        activeSubConfigWithDelay={activeSubConfigWithDelay}
        setActiveSubConfigWithDelay={setActiveSubConfigWithDelay}
        setLastValidTopic={setLastValidTopic}
        setPredictedTopic={setPredictedTopic}
        clearLearnedKeywordsForTopic={clearLearnedKeywordsForTopic}
        deleteCustomTopic={deleteCustomTopic}
        getTopicHierarchyPath={getTopicHierarchyPath}
        removeKeyword={removeKeyword}
        renameCustomTopic={renameCustomTopic}
        getFlattenedScannedImages={getFlattenedScannedImages}
      />
    );
  }

  return (
    <div id="app_root" className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col selection:bg-rose-500 selection:text-white">
      <AnimatePresence>
        {isVerticalTvMode && (
          <motion.div
            ref={tvContainerRef}
            tabIndex={0}
            onClick={() => tvContainerRef.current?.focus()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] w-screen h-screen bg-slate-950 overflow-hidden font-sans text-slate-100 group flex items-center justify-center outline-none"
          >
            {/* 100% Fullscreen Aspect Card Container */}
            <div 
              ref={tvCardRef}
              className="w-full max-w-[56.25vh] h-full relative overflow-hidden shadow-2xl transition-all duration-500 flex flex-col bg-[#121212]"
            >
              {(() => {
                const H = tvDimensions.height || 720;
                const B = tvDimensions.width || 405;
                const min_h1 = 0.2 * H; // min h1 = 1/5 H
                
                // Max height the image can possibly take while respecting the minimum bottom margin of 1/5 H (0.2 H):
                // h2 must be such that h2 <= 0.8 * H.
                // Since the image is to be fit, its height h2 is determined by the width B or maximum available height:
                const h2_max = 0.8 * H;
                const h2_calculated = B / imageAspectRatio;
                const h2 = Math.min(h2_calculated, h2_max);
                
                const Space_remain = H - h2;
                const R = Space_remain - min_h1; // equivalent to H - h2 - min_h1
                
                let h0 = 0;
                let h1 = min_h1;
                
                if (R <= 0) {
                  h0 = 0;
                  h1 = min_h1;
                } else if (R <= (1/15) * H) {
                  // "tiếp tục giành khoảng trống cho bottom cho đến khi H- min h1-h2 > 1/15 H"
                  h0 = 0;
                  h1 = min_h1 + R; // equivalent to Space_remain
                } else {
                  // "thì chừa top margin bằng 1/15H. Khi có khoảng trống đứng lớn hơn nữa, thì chia 1/4 ở trên, và 3/4 ở dưới"
                  h0 = 0.25 * Space_remain;
                  h1 = 0.75 * Space_remain;
                }
                
                const tvSubtitleText = getSuperConciseSubtitle(displayedTopic || activeImageTopic, displayedAnalysis);

                return (
                  <div className="w-full h-full relative flex flex-col justify-start overflow-hidden bg-[#121212]">
                    {/* Backdrop background covering 100% of the screen with high blur */}
                    <div className="absolute inset-0 z-0 overflow-hidden select-none pointer-events-none">
                      {displayedTvImageSrc ? (
                        <SmoothBackdropImage src={displayedTvImageSrc} />
                      ) : (
                        <div className="w-full h-full bg-[#121212]" />
                      )}
                      {/* Dark gradient overlay to ensure contrast and premium feel */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85" />
                    </div>

                    {/* 1. Header (chủ đề ảnh) */}
                    <div 
                      className="w-full relative z-20 shrink-0 flex items-center justify-end select-none" 
                      style={{ height: `${h0}px`, paddingRight: `${B / 20}px` }}
                    >
                      {h0 > 0 && (
                        <span 
                          className="font-sans font-medium text-white/50 tracking-wider lowercase"
                          style={{ fontSize: `${Math.max(13, 13 * (B / 405))}px` }}
                        >
                          {displayedTopic ? displayedTopic.toLowerCase() : ""}
                        </span>
                      )}
                    </div>

                    {/* 2. Clear Foreground Image Area (fit, horizontally centered) */}
                    <div 
                      className="w-full relative z-10 shrink-0 flex items-center justify-center select-none overflow-hidden" 
                      style={{ height: `${h2}px` }}
                    >
                      {displayedTvImageSrc ? (
                        <SmoothImage
                          src={displayedTvImageSrc}
                          alt={displayedTopic}
                          className="max-w-full max-h-full object-contain rounded-none border border-white/20 shadow-[0_5px_15px_rgba(0,0,0,0.5)]"
                          wrapperClassName="relative w-full h-full flex items-center justify-center overflow-hidden"
                          onLoadComplete={() => {
                            setIsCurrentImageLoaded(true);
                          }}
                          onError={() => {
                            setIsCurrentImageLoaded(true);
                            const cleanUrl = displayedTvImageSrc.split("?")[0];
                            setFailedLocalUrls((prev) => ({
                              ...prev,
                              [cleanUrl]: true,
                            }));
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-900/40 backdrop-blur rounded-2xl border border-white/10">
                          <ImageIcon className="w-16 h-16 animate-pulse text-slate-700" />
                          <span className="text-xs mt-3 text-slate-500 font-mono tracking-wider">CHƯA CÓ HÌNH ẢNH</span>
                        </div>
                      )}
                    </div>

                    {/* 3. Bottom Slogan Area (vertically centered, horizontally center-aligned, exactly 150px padding-left and padding-right on 2160x3840, proportional otherwise) */}
                    <div 
                      className="w-full relative z-20 shrink-0 flex items-center justify-center text-center p-0 m-0 select-none" 
                      style={{ 
                        height: `${h1}px`, 
                        paddingLeft: `${Math.max(16, 150 * (B / 2160))}px`,
                        paddingRight: `${Math.max(16, 150 * (B / 2160))}px`
                      }}
                    >
                      <div 
                        className="flex flex-col items-center justify-center w-full max-w-full p-0 m-0"
                        style={{ gap: `${Math.max(4, 8 * (B / 405))}px` }}
                      >
                        {formatToTwoLinesOfMaxEightWords(tvSubtitleText).map((line, idx) => (
                          <span 
                            key={idx} 
                            className="font-sans font-bold text-white/95 tracking-wide block text-center"
                            style={{ 
                              fontSize: `${Math.max(21, 21 * (B / 405))}px`,
                              lineHeight: 1.15
                            }}
                          >
                            {line}
                          </span>
                        ))}

                        {/* Display Distance Info under slogan in TV Mode */}
                        {routeInfo && (displayedTopic === "Vị trí dự án Nyah Phú Định" || displayedTopic === "Tiện ích xung quanh") && (
                          <div 
                            className="mt-3 flex flex-col items-center gap-1 bg-black/40 border border-white/10 backdrop-blur px-4 py-2 rounded-2xl shadow-lg"
                            style={{ 
                              marginTop: `${Math.max(6, 12 * (B / 405))}px`,
                              paddingLeft: `${Math.max(10, 16 * (B / 405))}px`,
                              paddingRight: `${Math.max(10, 16 * (B / 405))}px`,
                              paddingTop: `${Math.max(6, 10 * (B / 405))}px`,
                              paddingBottom: `${Math.max(6, 10 * (B / 405))}px`,
                              borderRadius: `${Math.max(8, 12 * (B / 405))}px`
                            }}
                          >
                            <span 
                              className="text-rose-400 font-extrabold uppercase tracking-widest text-center block"
                              style={{ fontSize: `${Math.max(9, 10 * (B / 405))}px` }}
                            >
                              📍 Lộ trình tới: {selectedDestination ? selectedDestination.replace(", Hồ Chí Minh", "").replace(", Vietnam", "").replace(", Việt Nam", "") : "Dự án"}
                            </span>
                            <div className="flex items-center justify-center gap-2 mt-1">
                              <span 
                                className="bg-rose-500/20 border border-rose-500/40 px-3 py-1 rounded-xl text-rose-200 font-black tracking-wide flex items-center gap-1 shadow-inner"
                                style={{ 
                                  fontSize: `${Math.max(12, 13 * (B / 405))}px`,
                                  paddingLeft: `${Math.max(8, 12 * (B / 405))}px`,
                                  paddingRight: `${Math.max(8, 12 * (B / 405))}px`
                                }}
                              >
                                📏 {routeInfo.distance}
                              </span>
                              <span 
                                className="bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-xl text-emerald-300 font-black tracking-wide flex items-center gap-1 shadow-inner"
                                style={{ 
                                  fontSize: `${Math.max(12, 13 * (B / 405))}px`,
                                  paddingLeft: `${Math.max(8, 12 * (B / 405))}px`,
                                  paddingRight: `${Math.max(8, 12 * (B / 405))}px`
                                }}
                              >
                                🛵 {routeInfo.duration}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}



              {/* Status indicator shown as a subtle pulse dot when analyzing or loading */}
              {(isAnalyzing || isPreloading) && (
                <div className="absolute top-6 right-6 bg-slate-950/80 border border-slate-800 rounded-full p-2.5 text-rose-400 shadow-2xl backdrop-blur-md z-30 pointer-events-none">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
              )}


            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek Top Banner Header */}
      <header id="app_header" className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-500 animate-pulse">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-rose-400 bg-clip-text text-transparent">
                  NhaDat.company
                </span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-mono border border-rose-500/20 font-bold">
                  AI Realtime
                </span>
              </div>
              <p className="text-xs text-slate-400">Trợ lý phân tích cuộc đối thoại & đồng bộ hình ảnh thông minh</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 rounded-lg border border-slate-800">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isListening ? "bg-emerald-500 animate-ping" : isSimulating ? "bg-amber-400 animate-pulse" : "bg-slate-600"
                }`}
              />
              <span className="text-xs font-mono text-slate-300">
                {isListening ? "ĐANG NGHE..." : isSimulating ? "MÔ PHỎNG..." : "SẴN SÀNG"}
              </span>
            </div>

            {/* Toggle Presentation Mode */}
            <button
              onClick={() => setIsPresentationMode(!isPresentationMode)}
              className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition font-semibold cursor-pointer ${
                isPresentationMode
                  ? "bg-rose-600/20 text-rose-400 border-rose-500/40 hover:bg-rose-600/30 shadow-lg shadow-rose-950/25"
                  : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700"
              }`}
              title={isPresentationMode ? "Thoát chế độ chỉ xem ảnh, hiển thị lại bảng cấu hình" : "Ẩn hết các bộ cấu hình phức tạp, chỉ hiển thị ảnh/bản đồ"}
            >
              {isPresentationMode ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-rose-400" />
                  <span>Hiện Cấu Hình</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Chế Độ Chỉ Xem Ảnh</span>
                </>
              )}
            </button>

            {/* Chế độ TV 16:9 Landscape */}
            <button
              onClick={() => setIsVerticalTvMode(true)}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-slate-900 hover:bg-slate-800 hover:text-rose-400 hover:border-rose-500/40 text-rose-400 border-slate-800 transition font-semibold cursor-pointer shadow-md"
              title="Mở chế độ hiển thị tối ưu cho TV 16:9 (Phù hợp trình chiếu phòng họp, tivi showroom)"
            >
              <Tv className="w-3.5 h-3.5 animate-pulse text-rose-400" />
              <span>Chế độ TV (16:9)</span>
            </button>

            {/* Bảng quản trị */}
            <button
              onClick={() => setCurrentPath("admin")}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg border border-rose-500/20 font-semibold cursor-pointer shadow-md hover:shadow-rose-950/20 transition duration-200"
              title="Mở bảng cấu hình từ khóa & hình ảnh riêng biệt cực kỳ mượt mà"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Bảng quản trị</span>
            </button>

            <button
              onClick={resetAll}
              className="text-xs flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-slate-300 rounded-lg border border-slate-800 hover:border-slate-700 transition"
              id="btn_reset"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Dọn dẹp</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main id="app_main" className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
        {/* Left Column: Voice Recording, Transcribing, Templates (span 3 / 30% width) */}
        {!isPresentationMode && (
          <section id="column_left" className="lg:col-span-3 flex flex-col gap-4">
          {/* Controls toolbar to toggle simulation and keywords */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2 backdrop-blur shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 tracking-wider">
                <Settings className="w-3.5 h-3.5 text-rose-500" />
                <span>Cấu hình bảng điều khiển</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setShowSimulation(!showSimulation)}
                className={`py-1.5 px-1.5 rounded-xl border text-[10px] font-semibold transition flex items-center justify-center gap-1 ${
                  showSimulation
                    ? "bg-rose-600/10 text-rose-400 border-rose-500/20 hover:bg-rose-600/20"
                    : "bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300"
                }`}
              >
                <span>{showSimulation ? "👁️ Kịch bản" : "🙈 Kịch bản"}</span>
              </button>
              <button
                onClick={() => setShowKeywords(!showKeywords)}
                className={`py-1.5 px-1.5 rounded-xl border text-[10px] font-semibold transition flex items-center justify-center gap-1 ${
                  showKeywords
                    ? "bg-rose-600/10 text-rose-400 border-rose-500/20 hover:bg-rose-600/20"
                    : "bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300"
                }`}
              >
                <span>{showKeywords ? "👁️ Từ khóa" : "🙈 Từ khóa"}</span>
              </button>
              <button
                onClick={() => setShowSecondLevelConfig(!showSecondLevelConfig)}
                className={`py-1.5 px-1.5 rounded-xl border text-[10px] font-semibold transition flex items-center justify-center gap-1 ${
                  showSecondLevelConfig
                    ? "bg-rose-600/10 text-rose-400 border-rose-500/20 hover:bg-rose-600/20"
                    : "bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300"
                }`}
              >
                <span>{showSecondLevelConfig ? "👁️ Từ khóa Lớp 2" : "🙈 Từ khóa Lớp 2"}</span>
              </button>
            </div>

            {/* Added: Analysis Mode Switcher */}
            <div className="border-t border-slate-900 pt-2.5 mt-1 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 tracking-wider">
                  <Cpu className="w-3.5 h-3.5 text-rose-500" />
                  <span>Phương thức phân tích</span>
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  analysisMode === "ai" ? "bg-rose-950/40 text-rose-400 border border-rose-900" : "bg-amber-950/40 text-amber-400 border border-amber-900"
                }`}>
                  {analysisMode === "ai" ? "CHẤT LƯỢNG CAO" : "TRỰC TIẾP 0ms"}
                </span>
              </div>
              
              <div className="bg-slate-950/80 p-0.5 rounded-xl border border-slate-900 flex">
                <button
                  type="button"
                  onClick={() => setAnalysisMode("ai")}
                  className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                    analysisMode === "ai"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                  title="Sử dụng Trí Tuệ Nhân Tạo Google Gemini"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>AI Gemini</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisMode("heuristic")}
                  className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                    analysisMode === "heuristic"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-950/40"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                  title="Sử dụng giải thuật Heuristic siêu tốc"
                >
                  <Cpu className="w-3 h-3" />
                  <span>Heuristic</span>
                </button>
              </div>
            </div>
          </div>





          {/* BỘ TỰ ĐỘNG TÓM TẮT CHỦ ĐỀ */}
          <TopicSummarizerPanel
            topicKeywords={topicKeywords}
            topicParents={topicParents}
            topicKnowledge={topicKnowledge}
            setTopicKnowledge={setTopicKnowledge}
            topicConciseSummaries={topicConciseSummaries}
            setTopicConciseSummaries={setTopicConciseSummaries}
            isConfigsLoaded={isConfigsLoaded}
          />



          {/* GỘP CHUNG: BỘ GHI ÂM & NỘI DUNG CUỘC TRÒ CHUYỆN */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3.5 backdrop-blur shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 text-rose-500" />
                <span>LẮNG NGHE & NỘI DUNG</span>
              </h3>
              
              {/* Actions & Language Selection (Compact) */}
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 shrink-0">
                  <button
                    onClick={() => setLanguage("vi-VN")}
                    disabled={isListening}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition ${
                      language === "vi-VN" ? "bg-rose-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                    } disabled:opacity-50`}
                  >
                    VI
                  </button>
                  <button
                    onClick={() => setLanguage("en-US")}
                    disabled={isListening}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition ${
                      language === "en-US" ? "bg-rose-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                    } disabled:opacity-50`}
                  >
                    EN
                  </button>
                </div>

                {(transcript || interimTranscript) && (
                  <button
                    onClick={() => {
                      setTranscript("");
                      setInterimTranscript("");
                    }}
                    className="text-[10px] text-slate-400 hover:text-rose-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
                  >
                    Xóa chữ
                  </button>
                )}
              </div>
            </div>

            {/* Compact Recording Bar */}
            <div className="bg-slate-950/60 rounded-xl border border-slate-900 p-2.5 flex items-center gap-2.5 relative overflow-hidden">
              {isListening && (
                <div className="absolute inset-0 flex items-center pointer-events-none opacity-10">
                  <div className="w-full h-full bg-gradient-to-r from-rose-500/20 to-transparent animate-pulse" />
                </div>
              )}

              <button
                onClick={toggleListening}
                disabled={isSimulating}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow transition-all shrink-0 relative z-10 ${
                  isListening
                    ? "bg-rose-500 hover:bg-rose-600 active:scale-95 shadow-rose-500/10"
                    : "bg-slate-800 hover:bg-slate-700 active:scale-95 hover:text-rose-400 border border-slate-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                id="btn_microphone"
                title={isListening ? "Bấm để dừng ghi âm" : "Bấm để bắt đầu ghi âm"}
              >
                {isListening ? (
                  <Mic className="w-4.5 h-4.5 text-white animate-pulse" />
                ) : (
                  <MicOff className="w-4.5 h-4.5 text-slate-400" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-200 leading-tight">
                  {isListening ? "Đang lắng nghe giọng nói..." : isSimulating ? "Đang giả lập hội thoại..." : "Chế độ nghe tự động mở"}
                </p>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">
                  {isListening ? "Đang bắt từ khóa trực tiếp..." : "Bấm mic để ghi âm thủ công"}
                </p>
              </div>

              {/* Status pill inside the block */}
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-950 rounded-lg border border-slate-800/80 shrink-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isListening ? "bg-emerald-500 animate-ping" : isSimulating ? "bg-amber-400 animate-pulse" : "bg-slate-600"
                  }`}
                />
                <span className="text-[8px] font-mono text-slate-400 uppercase">
                  {isListening ? "ON" : isSimulating ? "SIM" : "READY"}
                </span>
              </div>
            </div>

            {/* Mic Error Banner if blocked/unsupported */}
            {recognitionError && (
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-1.5 text-[10px] text-rose-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="flex-1 leading-snug">
                  <p>{recognitionError}</p>
                </div>
              </div>
            )}

            {/* Scrollable transcript area inside the same card */}
            <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto bg-slate-950/60 border border-slate-900 rounded-xl p-3 max-h-[140px] min-h-[110px] text-xs space-y-2 scrollbar-thin">
              {!transcript && !interimTranscript ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-4">
                  <p className="italic text-[11px]">Nội dung cuộc gọi hiện diện tại đây...</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">Nói chuyện để hệ thống tự động nhận diện thời gian thực.</p>
                </div>
              ) : (
                <div className="space-y-2 leading-relaxed">
                  {transcript && (
                    <p className="text-slate-200 whitespace-pre-wrap font-medium">
                      {transcript}
                    </p>
                  )}

                  {interimTranscript && (
                    <p className="text-slate-400 italic bg-rose-500/5 px-1.5 py-0.5 rounded border border-rose-500/10 inline-block animate-pulse">
                      {interimTranscript}...
                    </p>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </div>

            {/* Realtime Countdown Progress Indicator */}
            {secondsSinceLastSpeech !== null && secondsSinceLastSpeech > 0 && (
              <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-between text-[10px] text-rose-300 animate-pulse">
                <span className="flex items-center gap-1 font-medium">
                  <span className="w-1 h-1 rounded-full bg-rose-500 animate-ping inline-block" />
                  Ngừng nói, tự động bắt chủ đề sau:
                </span>
                <span className="font-mono bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded shadow text-[9px]">
                  {secondsSinceLastSpeech}s
                </span>
              </div>
            )}

            {/* Realtime Keyword Grouping & Scoring Panel */}
            {topicMatchDetails.length > 0 && (transcript || interimTranscript) && (
              <div className="mt-2 pt-2 border-t border-slate-900/60 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[9px] uppercase font-bold text-slate-450 tracking-wider">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3 text-rose-500" />
                    <span>Bộ gom từ khóa & tính điểm chủ đề</span>
                  </span>
                  <span className="text-[8px] text-slate-500 font-mono normal-case">
                    Thời gian thực
                  </span>
                </div>

                <div className="space-y-1.5">
                  {topicMatchDetails.map((detail) => {
                    const isWinner = detail.topic === predictedTopic;
                    const maxScore = Math.max(...topicMatchDetails.map(d => d.score), 1);
                    const percentage = Math.min(100, Math.round((detail.score / maxScore) * 100));
                    
                    if (detail.score === 0) return null; // Show only active topics with matches to keep it clean

                    return (
                      <div 
                        key={detail.topic} 
                        className={`p-2 rounded-lg border text-[10px] transition duration-250 ${
                          isWinner 
                            ? "bg-rose-950/25 border-rose-500/35 text-rose-200 shadow-sm shadow-rose-950/20" 
                            : "bg-slate-900/40 border-slate-900 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold flex items-center gap-1">
                            <span>
                               {detail.topic === "Vị trí dự án Nyah Phú Định" ? "📍" : 
                                detail.topic === "Tiện ích xung quanh" ? "🌳" : 
                                detail.topic === "Mẫu nhà Cosmo Gen 2" ? "🏠" : 
                                detail.topic === "Nội thất nhà bếp" ? "🍳" : 
                                detail.topic === "Nội thất phòng ngủ" ? "🛏️" : 
                                detail.topic === "Nội thất phòng khách" ? "🛋️" : 
                                detail.topic === "Nội thất phòng tắm" ? "🚿" : "🏷️"}
                            </span>
                            <span className="truncate max-w-[150px]">{detail.topic}</span>
                          </span>
                          <span className="font-mono text-[9px] font-bold bg-slate-950/80 px-1 py-0.2 rounded border border-slate-900 text-slate-300">
                            {detail.score}đ ({detail.matchedKeywords.length} từ)
                          </span>
                        </div>

                        {/* Progress bar representing weight */}
                        <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden mb-1">
                          <div 
                            className={`h-full transition-all duration-300 rounded-full ${isWinner ? "bg-rose-500" : "bg-slate-700"}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>

                        {/* Matched keywords list */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-[8px] text-slate-500 font-mono self-center">Từ khớp:</span>
                          {detail.matchedKeywords.map((kw, idx) => (
                            <span 
                              key={idx} 
                              className={`text-[8px] px-1 py-0.2 rounded font-medium ${
                                isWinner 
                                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/10" 
                                  : "bg-slate-950 text-slate-500 border border-slate-900"
                              }`}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Preset Simulation Scenarios - Conditional rendering */}
          {showSimulation && (
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 backdrop-blur shadow-lg">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-amber-500" />
                <span>MÔ PHỎNG HỘI THOẠI MẪU (KHUYÊN DÙNG)</span>
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Giả lập cuộc đối thoại để kiểm thử đồng bộ hình ảnh tức thì:
              </p>

              <div className="grid grid-cols-1 gap-2 mt-1">
                {SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => runScenarioSimulation(sc)}
                    disabled={isSimulating || isListening}
                    className={`p-2.5 text-left rounded-xl border transition flex gap-2.5 items-start group ${
                      selectedScenario === sc.id
                        ? "bg-rose-950/20 border-rose-500 text-rose-200"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300"
                    } disabled:opacity-50 disabled:pointer-events-none`}
                  >
                    <span className="text-lg mt-0.5 shrink-0 group-hover:scale-110 transition duration-200">
                      {sc.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[11px] text-slate-200 group-hover:text-rose-400 truncate">
                        {sc.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 leading-snug">
                        {sc.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Input Form fallback */}
              <ChatManualInputForm onSubmit={(text) => {
                setTranscript(text);
                handleAnalyzeText(text);
              }} />
            </div>
          )}

          {/* Moved to bottom of main for full width */}

        </section>
      )}

        {/* Right Column: AI Analysis, Topic Image, Assistant (span 7 / 70% width or span 10 / 100% width) */}
        <section id="column_right" className={`${isPresentationMode ? "lg:col-span-10" : "lg:col-span-7"} flex flex-col gap-5 w-full`}>
          {isPresentationMode ? (
            /* SPECIAL BEAUTIFUL PORTRAIT 16:9 (9:16) LAYOUT FOR ONLY-VIEW MODE */
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6 md:p-8 backdrop-blur flex flex-col items-center justify-center relative min-h-[720px] w-full shadow-xl">
              {/* Subtle background glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.03),transparent_65%)] pointer-events-none" />

              {/* Header inside presentation mode container for controls */}
              <div className="w-full flex items-center justify-between pb-4 mb-6 border-b border-slate-800/60 z-10 shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                    CHẾ ĐỘ TRÌNH CHIẾU DỰ ÁN
                  </span>
                </div>
                <div className="flex gap-1.5 items-center">
                  <button
                    type="button"
                    onClick={() => setIsVerticalTvMode(true)}
                    className="text-[10px] font-bold bg-gradient-to-r from-rose-950/60 to-slate-900 text-rose-400 border border-rose-500/30 hover:border-rose-400 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    title="Mở chế độ hiển thị tối ưu cho TV dọc 16:9 (Tràn viền, tự động chạy slide)"
                  >
                    <Tv className="w-3.5 h-3.5 animate-pulse text-rose-400" />
                    <span>Mở Toàn Màn Hình TV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPresentationMode(false)}
                    className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Thoát Trình Chiếu</span>
                  </button>
                </div>
              </div>

              {/* Display Body: Vertical 16:9 portrait container */}
              <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[480px]">
                {(!displayedTopic || displayedTopic === "Chủ đề khác hoặc dự án khác" || !hasTopicImage(displayedTopic)) ? (
                  <div className="p-8 text-center max-w-md flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 animate-pulse">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                    <h4 className="font-semibold text-slate-300 text-sm">
                      {displayedTopic === "Chủ đề khác hoặc dự án khác" 
                        ? "Không hiển thị hình ảnh cho câu hỏi ngoài chủ đề" 
                        : !hasTopicImage(displayedTopic)
                        ? "Không hiển thị hình ảnh cho chủ đề này"
                        : "Chưa có chủ đề nào được phân tích"}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {displayedTopic === "Chủ đề khác hoặc dự án khác"
                        ? "Chatbot vẫn nỗ lực giải đáp chi tiết cho anh/chị, nhưng sẽ không hiển thị hình ảnh minh họa."
                        : !hasTopicImage(displayedTopic)
                        ? "Không hiển thị hình ảnh cho chủ đề này"
                        : "Khi cuộc đối thoại diễn ra, hình ảnh liên quan mật thiết đến chủ đề sẽ được cập nhật tự động tại đây."}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center w-full">
                    {/* The 16:9 portrait (9:16) image frame - ONLY shows the image, full borderless in 16:9 vertical */}
                    <div 
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button')) return;
                        handleNextImage(displayedTopic, e);
                      }}
                      className="relative aspect-[9/16] h-[520px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 group/portrait cursor-pointer transition-transform duration-300 hover:scale-[1.01]"
                      title="Click vào ảnh để xem hình tiếp theo trong slide"
                    >
                      {targetImageSrc ? (
                        <SmoothImage
                          src={targetImageSrc}
                          alt={displayedTopic}
                          className="w-full h-full object-cover"
                          onLoadComplete={() => {
                            setIsCurrentImageLoaded(true);
                          }}
                          onError={() => {
                            setIsCurrentImageLoaded(true);
                            const cleanUrl = targetImageSrc.split("?")[0];
                            setFailedLocalUrls((prev) => ({
                              ...prev,
                              [cleanUrl]: true,
                            }));
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                          <ImageIcon className="w-12 h-12 text-slate-800 animate-pulse" />
                        </div>
                      )}

                      {/* Translucent Carousel control buttons on hover */}
                      {getValidTopicImages(displayedTopic).length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handlePrevImage(displayedTopic, e)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white border border-slate-700/50 backdrop-blur-sm z-30 transition flex items-center justify-center cursor-pointer opacity-0 group-hover/portrait:opacity-100 animate-fade-in"
                            title="Slide trước"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleNextImage(displayedTopic, e)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white border border-slate-700/50 backdrop-blur-sm z-30 transition flex items-center justify-center cursor-pointer opacity-0 group-hover/portrait:opacity-100 animate-fade-in"
                            title="Slide tiếp theo"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>


                        </>
                      )}
                    </div>

                    {/* Symmetrical Title displayed beautifully OUTSIDE underneath the 9:16 portrait container */}
                    <div className="mt-6 text-center max-w-lg z-10">
                      <span className="text-[10px] tracking-[0.25em] font-bold text-rose-500 uppercase block mb-1.5">
                        CHỦ ĐỀ ĐANG TRÌNH CHIẾU
                      </span>
                      <h2 className="text-base font-serif font-bold text-slate-100 tracking-tight leading-snug drop-shadow-sm">
                        {displayedTopic}
                      </h2>
                      {displayedAnalysis?.summary && (
                        <p className="text-xs text-slate-400 mt-2.5 leading-relaxed max-w-sm mx-auto">
                          {activeSubConfigWithDelay && activeSubConfigWithDelay.parentTopic === displayedTopic && activeSubConfigWithDelay.caption
                            ? activeSubConfigWithDelay.caption
                            : displayedAnalysis.summary}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* STANDARD LANDSCAPE MULTI-COLUMN VIEW */
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur flex flex-col relative h-[600px] w-full">
              {/* Header with tag info */}
              <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4.5 h-4.5 text-rose-500" />
                  <span className="text-xs font-semibold tracking-wider uppercase text-slate-300">
                    HÌNH ẢNH MINH HỌA CHỦ ĐỀ CHUYÊN NGHIỆP
                  </span>
                </div>

                <div className="flex gap-1.5 items-center">
                  <button
                    type="button"
                    onClick={() => setIsVerticalTvMode(true)}
                    className="text-[10px] font-bold bg-gradient-to-r from-rose-950/60 to-slate-900 text-rose-400 border border-rose-500/30 hover:border-rose-400 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    title="Mở chế độ hiển thị tối ưu cho TV dọc 16:9 (Tràn viền, tự động chạy slide)"
                  >
                    <Tv className="w-3.5 h-3.5 animate-pulse text-rose-400" />
                    <span>📺 Mở TV Dọc (9:16)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBotAnswerOnImage(!showBotAnswerOnImage)}
                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                      showBotAnswerOnImage 
                        ? "bg-rose-600/20 text-rose-400 border-rose-500/20 hover:bg-rose-600 hover:text-white" 
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                    }`}
                    title="Chuyển đổi giữa Chế độ hiển thị Slide hoàn chỉnh (Ảnh + Câu trả lời tư vấn) hoặc chỉ hiển thị ảnh phóng to"
                  >
                    <span>{showBotAnswerOnImage ? "👁️ Chế độ Slide: BẬT" : "👁️ Chế độ Slide: TẮT"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const newVersion = Date.now();
                      setImageVersion(newVersion);
                      setFailedLocalUrls({});
                      try {
                        await fetchScannedFolderImages();
                        setSyncNotification({
                          type: "success",
                          message: "Kho ảnh đã được cập nhật lại theo cấu trúc thư mục mới nhất trên máy chủ!"
                        });
                        setTimeout(() => setSyncNotification(null), 4000);
                      } catch (err) {
                        setSyncNotification({
                          type: "error",
                          message: "Không thể kết nối đến máy chủ để cập nhật ảnh!"
                        });
                        setTimeout(() => setSyncNotification(null), 4000);
                      }
                    }}
                    title="Tải lại tất cả hình ảnh từ máy chủ để hiển thị tệp tin vừa tải lên"
                    className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 active:bg-slate-650 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Đồng bộ ảnh mới</span>
                  </button>


                </div>
              </div>

              {/* Display Body */}
              <div className="flex-1 relative flex flex-col items-center justify-center h-full w-full bg-slate-950/20 overflow-hidden">
                <AnimatePresence mode="wait">
                  {(!displayedTopic || displayedTopic === "Chủ đề khác hoặc dự án khác" || !hasTopicImage(displayedTopic)) ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-8 text-center max-w-md flex flex-col items-center justify-center gap-3"
                    >
                      <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 animate-pulse">
                        <ImageIcon className="w-7 h-7" />
                      </div>
                      <h4 className="font-semibold text-slate-300 text-sm">
                        {displayedTopic === "Chủ đề khác hoặc dự án khác" 
                          ? "Không hiển thị hình ảnh cho câu hỏi ngoài chủ đề" 
                          : !hasTopicImage(displayedTopic)
                          ? "Không hiển thị hình ảnh cho chủ đề này"
                          : "Chưa có chủ đề nào được phân tích"}
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {displayedTopic === "Chủ đề khác hoặc dự án khác"
                          ? "Hệ thống tự động nhận diện câu hỏi ngoài lề hoặc dự án khác. Chatbot vẫn nỗ lực giải đáp chi tiết cho anh/chị, nhưng sẽ không hiển thị hình ảnh minh họa để giữ đúng tiêu chuẩn tập trung của dự án Nyah Phú Định."
                          : !hasTopicImage(displayedTopic)
                          ? `Chủ đề "${displayedTopic}" nằm ngoài các chủ đề chính có ảnh minh họa sẵn. Chatbot vẫn phản hồi dựa trên nguồn dữ liệu tri thức của dự án Nyah Phú Định.`
                          : "Khi cuộc đối thoại diễn ra, hình ảnh liên quan mật thiết đến chủ đề sẽ được cập nhật tự động tại đây để minh họa trực quan cho khách hàng."}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="viewer"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      className="absolute inset-0 w-full h-full"
                    >
                      {targetImageSrc ? (
                        <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-950">
                          {/* Slide Left Column: The image stage */}
                          <div 
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('button')) return;
                              handleNextImage(displayedTopic, e);
                            }}
                            className={`relative group/carousel flex items-center justify-center bg-slate-950 cursor-pointer ${
                              showBotAnswerOnImage ? "lg:col-span-7 h-[42%] lg:h-full border-b lg:border-b-0 lg:border-r border-slate-800/80" : "lg:col-span-12 h-full"
                            }`}
                            title="Click vào ảnh để xem hình tiếp theo trong slide"
                          >
                            <SmoothImage
                              src={targetImageSrc}
                              alt={displayedTopic}
                              className="w-full h-full object-cover"
                              onLoadComplete={() => {
                                setIsCurrentImageLoaded(true);
                              }}
                              onError={() => {
                                setIsCurrentImageLoaded(true);
                                const cleanUrl = targetImageSrc.split("?")[0];
                                setFailedLocalUrls((prev) => ({
                                  ...prev,
                                  [cleanUrl]: true,
                                }));
                              }}
                            />

                            {/* Slide Navigation controls */}
                            {getValidTopicImages(displayedTopic).length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handlePrevImage(displayedTopic, e)}
                                  className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white border border-slate-700/50 backdrop-blur-sm z-30 transition flex items-center justify-center cursor-pointer opacity-80 hover:opacity-100"
                                  title="Slide trước"
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleNextImage(displayedTopic, e)}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white border border-slate-700/50 backdrop-blur-sm z-30 transition flex items-center justify-center cursor-pointer opacity-80 hover:opacity-100"
                                  title="Slide tiếp theo"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>


                              </>
                            )}
                          </div>

                          {/* Slide Right Column: The Topic Info & Consultant Answer (merged/consolidated to 1 complete slide show) */}
                          {showBotAnswerOnImage && (
                            <div className="lg:col-span-5 h-[58%] lg:h-full flex flex-col bg-slate-950/45 p-5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                              {/* Slide Header Tag */}
                              <div className="flex items-center justify-between border-b border-slate-900/60 pb-3 mb-4 select-none">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-300">
                                    {displayedAnalysis?.category || "TƯ VẤN VIÊN NHADAT.COMPANY"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800/80 rounded-lg p-0.5 select-none">
                                  <button
                                    type="button"
                                    onClick={() => setIsSlideConcise(true)}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                      isSlideConcise 
                                        ? "bg-rose-600 text-white shadow-sm" 
                                        : "text-slate-400 hover:text-slate-200"
                                    }`}
                                    title="Chữ slide siêu ngắn gọn, súc tích (10-20 từ)"
                                  >
                                    Ngắn gọn
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsSlideConcise(false)}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                      !isSlideConcise 
                                        ? "bg-rose-600 text-white shadow-sm" 
                                        : "text-slate-400 hover:text-slate-200"
                                    }`}
                                    title="Chữ đầy đủ chi tiết của tư vấn viên"
                                  >
                                    Đầy đủ
                                  </button>
                                </div>
                              </div>

                              {/* Slide Title: Topic Name */}
                              <h2 className="text-xs font-display font-bold text-slate-100 tracking-tight leading-snug mb-1">
                                {displayedTopic}
                              </h2>

                              {/* Conversation Summary */}
                              <p className="text-[11.5px] text-slate-400 italic mb-4 line-clamp-2 leading-relaxed">
                                &ldquo; {displayedAnalysis ? displayedAnalysis.summary : "Hệ thống tự động phát hiện cuộc hội thoại và trình bày thông tin minh họa."} &rdquo;
                              </p>

                              {/* Consultant Answer to Client Question (formatted beautifully) */}
                              <div className="flex-1 min-h-0 py-1">
                                {isSlideConcise ? (
                                  <div className="bg-rose-500/5 rounded-xl border border-rose-500/10 p-4 shadow-sm relative overflow-hidden">
                                    {/* Decorative visual quote mark */}
                                    <div className="absolute top-2 right-3 text-4xl font-serif text-rose-500/15 select-none font-bold">“</div>
                                    <div className="flex flex-col gap-1.5 items-start">
                                      {formatToTwoLinesOfMaxEightWords(
                                        activeSubConfigWithDelay && activeSubConfigWithDelay.parentTopic === displayedTopic && activeSubConfigWithDelay.caption
                                          ? activeSubConfigWithDelay.caption
                                          : (displayedAnalysis?.slideSuggestion || 
                                             (displayedAnalysis?.summary ? displayedAnalysis.summary : "Thông tin dự án đang cập nhật..."))
                                      ).map((line, idx) => (
                                        <span key={idx} className="text-[21px] font-sans font-bold text-slate-100 leading-relaxed tracking-wide block">
                                          {line}
                                        </span>
                                      ))}
                                    </div>

                                    {/* Distance & Route Info inside Slogan Card */}
                                    {routeInfo && (displayedTopic === "Vị trí dự án Nyah Phú Định" || displayedTopic === "Tiện ích xung quanh") && (
                                      <div className="mt-3 pt-3 border-t border-rose-500/10 flex flex-col gap-1.5 w-full">
                                        <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                          <span>📍</span> Lộ trình tới: {selectedDestination ? selectedDestination.replace(", Hồ Chí Minh", "").replace(", Vietnam", "").replace(", Việt Nam", "") : "Dự án"}
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className="bg-rose-950/40 border border-rose-900/40 px-2.5 py-0.5 rounded-lg text-[11px] font-bold text-rose-300 font-mono">
                                            📏 {routeInfo.distance}
                                          </span>
                                          <span className="bg-emerald-950/40 border border-emerald-900/40 px-2.5 py-0.5 rounded-lg text-[11px] font-bold text-emerald-400 font-mono">
                                            🛵 {routeInfo.duration}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    <div className="mt-3 flex items-center gap-1.5 text-[10px] text-rose-400 font-semibold uppercase tracking-wider">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                      <span>Thông điệp Slide (Ngắn gọn)</span>
                                    </div>
                                  </div>
                                ) : (
                                  displayedAnalysis?.suggestion ? (
                                    renderSlideAnswer(displayedAnalysis.suggestion)
                                  ) : (
                                    <p className="text-xs text-slate-500 italic">
                                      Hệ thống đang chờ phân tích để trích xuất thông tin tư vấn chính xác...
                                    </p>
                                  )
                                )}
                              </div>

                              {/* Distance & Route Mapping (If available for Location topics) */}
                              {routeInfo && selectedDestination && (displayedTopic === "Vị trí dự án Nyah Phú Định" || displayedTopic === "Tiện ích xung quanh") && (
                                <div className="mt-4 pt-4 border-t border-slate-900/60 flex flex-wrap items-center gap-2.5">
                                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                                    <span>📍 Lộ trình từ:</span>
                                    <span className="text-rose-400 font-bold max-w-[120px] truncate" title={selectedDestination}>
                                      {selectedDestination.replace(", Hồ Chí Minh", "").replace(", Vietnam", "").replace(", Việt Nam", "")}
                                    </span>
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="bg-rose-950/40 border border-rose-900/50 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-300 font-mono">
                                      📏 {routeInfo.distance}
                                    </span>
                                    <span className="bg-emerald-950/40 border border-emerald-900/50 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-400 font-mono">
                                      🛵 {routeInfo.duration}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Knowledge Base Reference (Anchor of truth) */}
                              {topicKnowledge[displayedTopic] && (
                                <div className="mt-4 pt-3.5 border-t border-slate-900/80 flex flex-col gap-1.5">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                    📚 Nguồn dữ liệu tri thức của dự án:
                                  </span>
                                  <div className="text-[9.5px] text-slate-400 leading-relaxed font-mono line-clamp-2 hover:line-clamp-none transition-all duration-200 bg-slate-900/40 p-2 rounded border border-slate-900">
                                    {topicKnowledge[displayedTopic]}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.08),transparent_70%)] pointer-events-none" />
                          <div className="relative z-10 max-w-sm flex flex-col items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-950/40 animate-pulse">
                              <AlertTriangle className="w-7 h-7" />
                            </div>
                            <div className="space-y-1.5">
                              <span className="px-2.5 py-0.5 text-[9px] font-bold uppercase rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 tracking-wider">
                                Hình ảnh chưa cập nhật
                              </span>
                              <h3 className="text-sm font-bold text-slate-100 tracking-tight mt-1 line-clamp-2 uppercase">
                                {displayedTopic}
                              </h3>
                              <p className="text-xs text-slate-400 max-w-[280px]">
                                Hình ảnh thực tế của chủ đề này hiện đang được cập nhật. Em mời anh/chị tham khảo các thông tin tư vấn chi tiết bên cạnh nhé.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

              {/* Loader for analysis */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-rose-500 animate-spin" />
                    <Sparkles className="w-5 h-5 text-rose-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <p className="text-xs font-medium text-slate-300 animate-pulse">
                    Gemini AI đang lắng nghe và phân tích chủ đề...
                  </p>
                </div>
              )}

              {/* Dynamic Subtle Loading/Syncing Indicator in corner of Card if preloading is active in background */}
            </div>

            {/* AI Image Generation Status banner */}
            {(aiImageLoading || aiImageError) && (
              <div className="p-3 bg-slate-950 border-t border-slate-800/80 z-10 text-xs flex items-center gap-2.5">
                {aiImageLoading && (
                  <>
                    <RefreshCw className="w-4 h-4 text-rose-500 animate-spin" />
                    <span className="text-slate-300">
                      Đang kết nối Gemini 2.5 để phác họa tranh minh họa... Vui lòng đợi trong giây lát!
                    </span>
                  </>
                )}
                {aiImageError && (
                  <>
                    <BadgeAlert className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-amber-300/90 leading-relaxed flex-1">{aiImageError}</span>
                  </>
                )}
              </div>
            )}
          </div>
          )}

          {/* Active AI Analysis Results & NhaDat.company Consultation Advice */}
          {!isPresentationMode && (
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 backdrop-blur flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                <span>KẾT QUẢ PHÂN TÍCH & TƯ VẤN THỜI GIAN THỰC</span>
              </h3>

              {analysisError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-[11px] whitespace-pre-line font-medium leading-relaxed">
                  {analysisError}
                </div>
              )}

              {activeAnalysis ? (
                <div className="space-y-3">
                  {/* Topic tags / keywords list */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 flex items-center gap-1">
                      Danh mục: <strong className="text-rose-400">{activeAnalysis.category}</strong>
                    </span>
                    {activeAnalysis.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg font-medium flex items-center gap-1"
                      >
                        # {kw}
                      </span>
                    ))}
                  </div>

                  {/* Consultant Advice Speech Bubble */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex gap-3 items-start">
                    {/* Vy Vy Avatar with pulse ring */}
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-base overflow-hidden">
                        👩‍💼
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                    </div>

                    <div className="flex-1 space-y-0.5 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold text-slate-200">Vy Vy — Chuyên viên NhaDat.company</h4>
                        <span className="text-[9px] text-slate-500">Vừa xong</span>
                      </div>

                      <div className="text-[11px] text-slate-300 leading-snug whitespace-pre-line bg-slate-950/40 p-2.5 rounded-xl border border-slate-950 font-medium">
                        {activeAnalysis.suggestion}
                      </div>

                      <div className="pt-1.5 text-[9px] text-slate-500 italic flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>Ý kiến phản hồi bám sát từ khóa trò chuyện và rổ sản phẩm có sẵn.</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-500 flex flex-col items-center justify-center gap-1">
                  <Compass className="w-8 h-8 text-slate-700 animate-spin [animation-duration:10s]" />
                  <p className="text-[11px] font-medium">Đang chờ cuộc trò chuyện bắt đầu...</p>
                  <p className="text-[10px] text-slate-600 max-w-sm mt-0.5">
                    Vy Vy sẽ lập tức phân tích và đưa ra tư vấn khi cuộc đối thoại hoặc kịch bản chạy.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

          {/* Dynamic Keyword Vocabulary Card - Conditional rendering */}
          {!isPresentationMode && showKeywords && (
            <div className="lg:col-span-10 w-full bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5 backdrop-blur shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-rose-500/10 transition-colors" />
              <div className="flex items-center justify-between gap-2 border-b border-slate-850 pb-2 flex-wrap">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Bookmark className="w-3.5 h-3.5 text-rose-500" />
                  <span>Cấu hình cây thư mục & từ khóa nhận diện</span>
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={expandAllTopics}
                    className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition flex items-center gap-1 normal-case px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 rounded-md"
                    title="Mở rộng tất cả các thư mục trong cây thư mục"
                  >
                    <FolderOpen className="w-2.5 h-2.5" />
                    <span>Mở tất cả</span>
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllTopics}
                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-300 transition flex items-center gap-1 normal-case px-2 py-0.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-md"
                    title="Thu gọn tất cả các thư mục trong cây thư mục"
                  >
                    <Folder className="w-2.5 h-2.5" />
                    <span>Thu tất cả</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetToDefaultTopics}
                    className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition flex items-center gap-1 normal-case px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-md"
                    title="Khôi phục lại các chủ đề mặc định ban đầu"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Khôi phục mặc định</span>
                  </button>
                  <span className="text-[9px] bg-rose-500/15 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded-full font-mono font-bold">
                    Cây Thư Mục Cố Định
                  </span>
                </div>
              </div>
              
              <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                Hệ thống phân loại hội thoại và tự động hiển thị hình ảnh chuẩn xác theo đúng cây thư mục và từ khóa được cấu hình dưới đây:
              </p>

              {/* Form Thêm chủ đề thủ công */}
              <AddManualTopicForm
                topicKeywords={topicKeywords}
                topicParents={topicParents}
                addNewTopic={addNewTopic}
                setSyncNotification={(notif) => {
                  if (notif) {
                    setSyncNotification({ type: notif.type === "info" ? "success" : notif.type, message: notif.message });
                  } else {
                    setSyncNotification(null);
                  }
                }}
              />

              <div className="space-y-3 mt-1">
                {(() => {
                  // Dynamically build roots and children map for tree structure
                  const roots: string[] = [];
                  const childrenMap: Record<string, string[]> = {};
                  
                  Object.keys(topicKeywords).forEach(tn => {
                    childrenMap[tn] = [];
                  });
                  
                  Object.keys(topicKeywords).forEach(tn => {
                    const parent = topicParents[tn];
                    if (parent && topicKeywords[parent]) {
                      childrenMap[parent].push(tn);
                    } else {
                      roots.push(tn);
                    }
                  });

                  const renderTopicNode = (topicName: string, depth: number) => {
                    const children = childrenMap[topicName] || [];
                    const subKeywords = secondLevelKeywords.filter((item) => item.parentTopic === topicName);
                    const hasChildren = children.length > 0 || subKeywords.length > 0;
                    const isExpanded = expandedTopics[topicName] !== false; // default to true
                    const isEditing = editingTopic === topicName;
                    const keywordsList = topicKeywords[topicName] || [];
                    
                    const baseCountMap: Record<string, number> = {
                      "Dự án Nyah Phú Định": 10,
                      "Nội thất nhà bếp": 12,
                      "Mẫu nhà Cosmo Gen 2": 18,
                      "Mẫu nhà Fusion Gen 5": 9,
                      "Vị trí dự án Nyah Phú Định": 16,
                      "Tiện ích xung quanh": 20,
                      "Nội thất phòng ngủ": 12,
                      "Nội thất phòng khách": 12,
                      "Nội thất phòng tắm": 12,
                      "Chủ đề khác hoặc dự án khác": 12
                    };
                    const baseCount = baseCountMap[topicName] || 12;

                    return (
                      <div key={topicName} className="flex flex-col gap-1.5">
                        {/* Node row */}
                        <div 
                          onClick={() => {
                            setLastValidTopic(topicName);
                            setPredictedTopic(topicName);
                            
                            const matchedSession = savedSessions.find((s) => s.analysis.topic === topicName);
                            if (matchedSession) {
                              setCurrentAnalysis(matchedSession.analysis);
                              setLastValidAnalysis(matchedSession.analysis);
                            } else {
                              const mockAnalysis = DEFAULT_ANALYSES[topicName] || {
                                topic: topicName,
                                category: topicName === "Vị trí dự án Nyah Phú Định" ? "Vị trí" : 
                                          topicName === "Tiện ích xung quanh" ? "Tiện ích" : "Nội thất",
                                summary: topicKnowledge[topicName] || "Chưa có thông tin chi tiết.",
                                keywords: keywordsList,
                                imageQuery: "",
                                suggestion: `Đang xem hình ảnh và tư vấn về chủ đề: ${topicName}.`
                              };
                              setCurrentAnalysis(mockAnalysis);
                              setLastValidAnalysis(mockAnalysis);
                            }
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none group/topic-card ${
                            predictedTopic === topicName 
                              ? "bg-emerald-950/25 border-emerald-500/40 hover:bg-emerald-950/35" 
                              : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850/30"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {/* Collapse/Expand Toggle */}
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTopics(prev => ({
                                    ...prev,
                                    [topicName]: !isExpanded
                                  }));
                                }}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition shrink-0"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                              </button>
                            ) : (
                              <div className="w-5 h-5 flex items-center justify-center text-slate-600 text-xs shrink-0">
                                •
                              </div>
                            )}

                            {/* Folder/File Icon */}
                            <span className="text-sm shrink-0">
                              {hasChildren ? (
                                isExpanded ? (
                                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                                ) : (
                                  <Folder className="w-3.5 h-3.5 text-amber-500" />
                                )
                              ) : (
                                <span>
                                  {getTopicDisplayName(topicName) === "Dự án Nyah Phú Định" ? "🏢" :
                                   getTopicDisplayName(topicName) === "Vị trí dự án Nyah Phú Định" ? "📍" : 
                                   getTopicDisplayName(topicName) === "Tiện ích xung quanh" ? "🌳" : 
                                   getTopicDisplayName(topicName) === "Mẫu nhà Cosmo Gen 2" ? "🏠" : 
                                   getTopicDisplayName(topicName) === "Mẫu nhà Fusion Gen 5" ? "🚗" : 
                                   getTopicDisplayName(topicName) === "Nội thất nhà bếp" ? "🍳" : 
                                   getTopicDisplayName(topicName) === "Nội thất phòng ngủ" ? "🛏️" : 
                                   getTopicDisplayName(topicName) === "Nội thất phòng khách" ? "🛋️" : 
                                   getTopicDisplayName(topicName) === "Nội thất phòng tắm" ? "🚿" : "🏷️"}
                                </span>
                              )}
                            </span>

                            <span className="text-[11px] font-bold text-slate-200 truncate flex-1">
                              {getTopicDisplayName(topicName)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {keywordsList.length > baseCount && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearLearnedKeywordsForTopic(topicName);
                                }}
                                className="text-[8px] font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-0.5 px-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded"
                                title={`Xóa nhanh các từ khóa tự học (có ✨) của riêng chủ đề "${topicName}"`}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                            <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.2 rounded font-semibold">
                              {keywordsList.length} từ
                            </span>
                            
                            {/* Toggle Edit Config Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTopic(isEditing ? null : topicName);
                              }}
                              className={`p-1 rounded transition ${
                                isEditing 
                                  ? "bg-emerald-500/20 text-emerald-400" 
                                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                              }`}
                              title="Cấu hình chi tiết chủ đề"
                            >
                              <Settings className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCustomTopic(topicName);
                              }}
                              className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition"
                              title={`Xóa chủ đề "${topicName}"`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Editing Panel inline */}
                        {isEditing && (
                          <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl ml-4 space-y-2.5">
                            {/* Breadcrumbs */}
                            {(() => {
                              const ancestors = getTopicHierarchyPath(topicName);
                              if (ancestors.length > 0) {
                                return (
                                  <div className="text-[8px] text-slate-500 flex items-center gap-1 flex-wrap">
                                    {ancestors.map((anc) => (
                                      <React.Fragment key={anc}>
                                        <span>{anc}</span>
                                        <span>➔</span>
                                      </React.Fragment>
                                    ))}
                                    <span className="text-emerald-400 font-semibold">{topicName}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            <TopicRenameInput
                              topicName={topicName}
                              renameCustomTopic={renameCustomTopic}
                              setEditingTopic={setEditingTopic}
                              setSyncNotification={setSyncNotification}
                            />

                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Các từ khóa nhận diện:</label>
                              <div className="flex flex-wrap gap-1">
                                {keywordsList.map((kw, i) => {
                                  const isNew = i >= baseCount;
                                  return (
                                    <span 
                                      key={i} 
                                      className={`text-[9px] pl-1.5 pr-0.5 py-0.2 rounded transition duration-300 flex items-center gap-0.5 group/kw-item ${
                                        isNew 
                                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold" 
                                          : "bg-slate-900 text-slate-400 border border-slate-850"
                                      }`}
                                    >
                                      <span>{kw}</span>
                                      {isNew && <span className="text-[8px]">✨</span>}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeKeyword(topicName, kw);
                                        }}
                                        className="w-3 h-3 rounded-full flex items-center justify-center hover:bg-rose-500/20 text-slate-600 hover:text-rose-400 transition-colors ml-0.5"
                                        title={`Xóa từ khóa "${kw}"`}
                                      >
                                        <X className="w-2 h-2" />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Chủ đề cha:</span>
                              <select
                                value={topicParents[topicName] || ""}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTopicParents((prev) => {
                                    const updated = { ...prev };
                                    if (val) {
                                      updated[topicName] = val;
                                    } else {
                                      delete updated[topicName];
                                    }
                                    try {
                                      localStorage.setItem("topic_parents", JSON.stringify(updated));
                                    } catch (err) {
                                      console.error(err);
                                    }
                                    return updated;
                                  });
                                }}
                                className="bg-slate-900 border border-slate-850 hover:border-slate-750 text-[10px] text-emerald-400 font-medium px-2 py-1 rounded focus:outline-none focus:border-emerald-500 cursor-pointer flex-1 transition"
                              >
                                <option value="">-- Không có (Chủ đề gốc) --</option>
                                {Object.keys(topicKeywords)
                                  .filter((tn) => tn !== topicName)
                                  .map((tn) => (
                                    <option key={tn} value={tn}>
                                      {tn}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div className="pt-2 border-t border-slate-900">
                              <TopicKeywordForm topicName={topicName} learnNewKeywords={learnNewKeywords} />
                            </div>

                            <TopicSloganConfig
                              topicName={topicName}
                              topicConciseSummaries={topicConciseSummaries}
                              setTopicConciseSummaries={setTopicConciseSummaries}
                              setSyncNotification={setSyncNotification}
                            />

                            <TopicImageUploader
                              topicName={topicName}
                              topicParents={topicParents}
                              scannedFolderImages={scannedFolderImages}
                              fetchScannedFolderImages={fetchScannedFolderImages}
                              setSyncNotification={setSyncNotification}
                              imageVersion={imageVersion}
                              setImageVersion={setImageVersion}
                            />

                            <div className="pt-2 border-t border-slate-900">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cấu hình từ khóa Lớp 2 (HÌNH ẢNH & PHỤ ĐỀ PHỤ):</span>
                              <AddSecondLevelForm
                                topicKeywords={topicKeywords}
                                topicParents={topicParents}
                                getFlattenedScannedImages={getFlattenedScannedImages}
                                addSecondLevelKeyword={addSecondLevelKeyword}
                                setSyncNotification={setSyncNotification}
                                fixedTopicName={topicName}
                              />
                            </div>
                          </div>
                        )}

                        {/* Recursive children rendering */}
                        {hasChildren && isExpanded && (
                          <div className="border-l border-slate-800/60 ml-3.5 pl-3 space-y-2 mt-1">
                            {children.map(childName => renderTopicNode(childName, depth + 1))}
                            
                            {/* Render second-level keywords as child nodes in the tree */}
                            {subKeywords.map((item) => {
                              const isSubEditing = editingSubId === item.id;
                              const isSubActive = activeSubConfigWithDelay?.id === item.id;

                              return (
                                <div key={item.id} className="flex flex-col gap-1.5 ml-2">
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Activate parent topic first
                                      setLastValidTopic(item.parentTopic);
                                      setPredictedTopic(item.parentTopic);
                                      // Instantly preview this sub-config on TV
                                      setActiveSubConfigWithDelay(item);
                                    }}
                                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none group/sub-card ${
                                      isSubActive
                                        ? "bg-rose-950/25 border-rose-500/40 hover:bg-rose-950/35"
                                        : "bg-slate-900/20 border-slate-800/60 hover:border-slate-700 hover:bg-slate-850/20"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <div className="w-3.5 h-3.5 flex items-center justify-center text-rose-500 text-xs shrink-0 font-bold">
                                        ↳
                                      </div>
                                      
                                      {/* Sub-keyword icon / thumbnail preview */}
                                      {item.imageUrl ? (
                                        <div className="w-5 h-5 rounded overflow-hidden border border-slate-800 shrink-0 bg-slate-950">
                                          <img 
                                            src={item.imageUrl.startsWith("/") ? `${item.imageUrl}?v=${imageVersion}` : item.imageUrl} 
                                            alt={item.keyword}
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                              (e.target as HTMLElement).style.display = "none";
                                            }}
                                          />
                                        </div>
                                      ) : (
                                        <Compass className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                      )}

                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-[10px] font-bold text-slate-300 truncate">
                                          {item.keyword}
                                        </span>
                                        <span className="text-[8px] text-slate-500 truncate font-sans leading-normal">
                                          {item.caption}
                                        </span>
                                      </div>
                                      
                                      <span className="text-[7px] bg-rose-500/15 text-rose-400 border border-rose-500/20 px-1 py-0.2 rounded font-mono font-bold shrink-0">
                                        Lớp 2
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 ml-1.5 opacity-60 group-hover/sub-card:opacity-100 transition">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingSubId(isSubEditing ? null : item.id);
                                        }}
                                        className={`p-1 rounded transition ${
                                          isSubEditing
                                            ? "bg-rose-500/20 text-rose-400"
                                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                                        }`}
                                        title="Sửa cấu hình Lớp 2"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeSecondLevelKeyword(item.id);
                                        }}
                                        className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition"
                                        title="Xóa cấu hình Lớp 2"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Inline editing form for 2nd level keyword */}
                                  {isSubEditing && (
                                    <div className="bg-slate-950/70 border border-slate-900 p-2.5 rounded-xl ml-4 text-[9px]">
                                      <EditSecondLevelForm
                                        item={item}
                                        topicKeywords={topicKeywords}
                                        topicParents={topicParents}
                                        getFlattenedScannedImages={getFlattenedScannedImages}
                                        updateSecondLevelKeyword={updateSecondLevelKeyword}
                                        setEditingSubId={setEditingSubId}
                                        setSyncNotification={setSyncNotification}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-3 mt-1">
                      {roots.map(root => renderTopicNode(root, 0))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 2nd-Level Keywords Configuration Card */}
          {!isPresentationMode && showSecondLevelConfig && (
            <div className="lg:col-span-10 w-full bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5 backdrop-blur shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-rose-500/10 transition-colors" />
              <div className="flex items-center justify-between gap-2 border-b border-slate-850 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-rose-500" />
                  <span>Từ khóa Lớp 2 & Hình ảnh/Phụ đề phụ</span>
                </h3>
                <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-mono font-bold">
                  Lớp 2
                </span>
              </div>
              
              <p className="text-[10px] text-slate-400 leading-normal">
                Khi đang nói về chủ đề chính, hệ thống sẽ dò tiếp các từ khóa chi tiết hơn ở lớp thứ 2 để đổi hình ảnh và phụ đề TV phù hợp:
              </p>

              {/* Scrollable List of existing configurations */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                {secondLevelKeywords.length === 0 ? (
                  <p className="text-[10px] italic text-slate-500 text-center py-3">Chưa có cấu hình liên kết lớp 2 nào.</p>
                ) : (
                  secondLevelKeywords.map((item) => {
                    const isEditing = editingSubId === item.id;
                    if (isEditing) {
                      return (
                        <EditSecondLevelForm
                          key={item.id}
                          item={item}
                          topicKeywords={topicKeywords}
                          topicParents={topicParents}
                          getFlattenedScannedImages={getFlattenedScannedImages}
                          updateSecondLevelKeyword={updateSecondLevelKeyword}
                          setEditingSubId={setEditingSubId}
                          setSyncNotification={setSyncNotification}
                        />
                      );
                    }

                    return (
                      <div 
                        key={item.id}
                        className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 flex gap-3 hover:border-slate-700 transition"
                      >
                        {item.imageUrl && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-800 shrink-0 bg-slate-950 relative group/thumb">
                            <img 
                              src={item.imageUrl.startsWith("/") ? `${item.imageUrl}?v=${imageVersion}` : item.imageUrl} 
                              alt={item.keyword}
                              className="w-full h-full object-cover transition duration-350 group-hover/thumb:scale-110"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="bg-slate-800 text-slate-300 text-[8px] font-bold px-1.5 py-0.5 rounded-md">
                              Chủ đề: {item.parentTopic}
                            </span>
                            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-bold px-1.5 py-0.5 rounded-md">
                              Từ khóa: {item.keyword}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-300 font-sans leading-relaxed">
                            {item.caption}
                          </p>
                          {item.imageUrl && (
                            <span className="text-[8px] text-slate-500 font-mono truncate max-w-full">
                              Ảnh: {item.imageUrl}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0 self-start">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubId(item.id);
                            }}
                            className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                            title={`Chỉnh sửa cấu hình này`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSecondLevelKeyword(item.id)}
                            className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                            title={`Xóa cấu hình này`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Form to add a new 2nd level mapping */}
              <AddSecondLevelForm
                topicKeywords={topicKeywords}
                topicParents={topicParents}
                getFlattenedScannedImages={getFlattenedScannedImages}
                addSecondLevelKeyword={addSecondLevelKeyword}
                setSyncNotification={setSyncNotification}
              />
            </div>
          )}
      </main>

      {/* Bottom section: Conversation Timeline Tracker */}
      {!isPresentationMode && (
        <section id="app_timeline" className="max-w-7xl w-full mx-auto p-4 pt-0">
        <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 backdrop-blur flex flex-col gap-3.5">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-900 pb-4 mb-2">
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <History className="w-4 h-4 text-rose-500 animate-pulse" />
                <span>Nhật ký & Dòng thời gian cuộc trò chuyện ({savedSessions.length})</span>
              </h3>
              <p className="text-[10px] text-slate-500 leading-none">
                {savedSessions.length > 0 ? "Bấm vào thẻ lịch sử bất kỳ để mở lại chi tiết cuộc thoại" : "Chưa có phiên đối thoại nào được lưu trữ"}
              </p>
            </div>

            {/* Logs Export Controls */}
            {savedSessions.length > 0 && (
              <div className="flex items-center flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={downloadAllLogsText}
                  className="text-[10px] font-bold bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow shadow-emerald-950/20"
                  title="Tải toàn bộ nội dung cuộc gọi dưới dạng báo cáo file TXT"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Xuất Báo Cáo (TXT)</span>
                </button>
                <button
                  type="button"
                  onClick={downloadAllLogsJson}
                  className="text-[10px] font-bold bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow shadow-blue-950/20"
                  title="Tải cấu trúc dữ liệu JSON để tích hợp hệ thống CRM"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất File Cấu Trúc (JSON)</span>
                </button>
                
                {/* Safe Iframe-Friendly Double-Click Clear Handler */}
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmClearLogs) {
                      setConfirmClearLogs(true);
                      setTimeout(() => setConfirmClearLogs(false), 4000);
                    } else {
                      clearAllLogs();
                    }
                  }}
                  className={`text-[10px] font-bold border px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow ${
                    confirmClearLogs
                      ? "bg-amber-600 border-amber-500 text-white animate-bounce"
                      : "bg-slate-900 hover:bg-rose-950/20 border-slate-800 hover:border-rose-900/50 text-slate-400 hover:text-rose-400"
                  }`}
                  title={confirmClearLogs ? "Bấm lại lần nữa để chắc chắn xóa toàn bộ" : "Xóa toàn bộ nhật ký lịch sử"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{confirmClearLogs ? "Bạn chắc chứ? Bấm lần nữa" : "Dọn Nhật Ký"}</span>
                </button>
              </div>
            )}
          </div>

          {savedSessions.length === 0 ? (
            <div className="py-6 text-center text-slate-600 text-xs italic bg-slate-950/20 rounded-xl border border-slate-900">
              Chưa có lịch sử phân tích. Hãy thực hiện nói hoặc chạy mô phỏng kịch bản để lưu trữ lộ trình cuộc gọi.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin snap-x">
              {savedSessions.map((session) => {
                const isActive = selectedHistoryId === session.id;
                return (
                  <button
                    key={session.id}
                    onClick={() => handleSelectHistorySession(session)}
                    className={`flex-none w-72 text-left p-4.5 rounded-xl border transition flex flex-col justify-between snap-start relative overflow-hidden group ${
                      isActive
                        ? "bg-rose-950/15 border-rose-500 ring-1 ring-rose-500/50"
                        : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80"
                    }`}
                  >
                    {/* Timestamp badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {session.timestamp}
                      </span>
                      <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wide">
                        {session.analysis.category}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-200 line-clamp-1 group-hover:text-rose-400 transition mb-1">
                      {session.analysis.topic}
                    </h4>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                      {session.analysis.summary}
                    </p>

                    {/* Miniature representation card image on the right */}
                    <div className="flex items-center gap-2 mt-auto border-t border-slate-800/80 pt-2.5">
                      <div className="w-8 h-8 rounded overflow-hidden bg-slate-950 shrink-0 border border-slate-800 flex items-center justify-center">
                        {session.analysis.topic === "Chủ đề khác hoặc dự án khác" ? (
                          <MessageSquare className="w-4 h-4 text-slate-500" />
                        ) : (session.customAiImageUrl || getLocalTopicImage(session.analysis.topic)) ? (
                          <img
                            src={
                              session.customAiImageUrl ||
                              getLocalTopicImage(session.analysis.topic)!
                            }
                            alt={session.analysis.topic}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-slate-500 animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-500 leading-none">Minh họa</p>
                        <p className="text-[11px] font-semibold text-slate-300 truncate mt-1">
                          {session.analysis.topic}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
      )}

      {/* Floating Toggle to exit presentation mode */}
      {isPresentationMode && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setIsPresentationMode(false)}
          className="fixed bottom-6 left-6 z-[90] px-4 py-2.5 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 hover:border-slate-700 transition font-semibold text-xs cursor-pointer"
        >
          <Settings className="w-4 h-4 text-rose-500 animate-spin [animation-duration:10s]" />
          <span>Hiện cấu hình phân loại (⚙️)</span>
        </motion.button>
      )}

      {/* Floating Dynamic Sync Notification */}
      {syncNotification && (
        <div className="fixed bottom-6 right-6 z-[101] max-w-sm w-[350px] bg-slate-950/95 border border-emerald-500/60 rounded-2xl p-4 shadow-2xl shadow-emerald-950/30 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex gap-3 items-center">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center justify-center h-10 w-10">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  {syncNotification.type === "success" ? "🔄 Đồng bộ hoàn tất" : "❌ Thất bại"}
                </span>
                <button 
                  onClick={() => setSyncNotification(null)}
                  className="text-slate-500 hover:text-slate-300 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-200 mt-1 leading-snug">
                {syncNotification.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

