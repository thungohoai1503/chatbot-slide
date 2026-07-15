const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.resolve(__dirname, "../../../01_NyAh-PhuDinh");
const OUTPUT_DIR = path.resolve(__dirname, "../public/images");
const OUTPUT_JSON = path.resolve(__dirname, "../public/topics.json");

const FOLDER_NAME_MAP = {
  an_ninh: "An ninh",
  camera_giam_sat: "Camera giám sát",
  khoa_thong_minh: "Khóa thông minh",
  canh_quan: "Cảnh quan",
  khuon_vien: "Khuôn viên",
  san_thuong: "Sân thượng",
  san_vuon: "Sân vườn",
  chinh_sach: "Chính sách",
  chiet_khau: "Chiết khấu",
  ngan_hang: "Ngân hàng",
  thanh_toan: "Thanh toán",
  chu_dau_tu: "Chủ đầu tư",
  nha_dat: "Nhã Đạt",
  gia_ban: "Giá bán",
  mat_bang: "Mặt bằng",
  ngoai_that: "Ngoại thất",
  noi_that: "Nội thất",
  cosmo_gen_2: "Cosmo Gen 2",
  fusion_gen_5: "Fusion Gen 5",
  opus: "Opus",
  signature_by_codinachs: "Signature by Codinachs",
  bep: "Bếp",
  gara: "Gara",
  phong_khach: "Phòng khách",
  phong_ngu: "Phòng ngủ",
  wc: "WC",
  khac: "Khác",
  mat_tien: "Mặt tiền",
  phoi_canh: "Phối cảnh",
  showroom: "Showroom",
  "van phong": "Văn phòng",
  "tang-2": "Tầng 2",
  tang_1_gara_phong_khach: "Tầng 1 - Gara & Phòng khách",
  tang_2_lung_phong_ngu_ong_ba: "Tầng 2 lửng - Phòng ngủ ông bà",
  tang_3_bep_phong_an: "Tầng 3 - Bếp & Phòng ăn",
  tang_4_master_suite: "Tầng 4 - Master Suite",
  tang_5_phong_ngu_tre_em: "Tầng 5 - Phòng ngủ trẻ em",
  tang_6_ban_cong: "Tầng 6 - Ban công",
  phap_ly: "Pháp lý",
  giay_phep: "Giấy phép",
  so_hong: "Sổ hồng",
  tien_do: "Tiến độ",
  xay_dung: "Xây dựng",
  tien_ich: "Tiện ích",
  cong_vao: "Cổng vào",
  cong_vien: "Công viên",
  ho_boi: "Hồ bơi",
  landmark_coffee: "Landmark Coffee",
  "lanscape-khuon-vien-anh-chup": "Khuôn viên (ảnh chụp)",
  san_choi_tre_em: "Sân chơi trẻ em",
  san_the_thao: "Sân thể thao",
  tong_quan: "Tổng quan",
  vi_tri: "Vị trí",
  ban_do: "Bản đồ",
  duong_di: "Đường đi",
  thang_xoan: "Thang xoắn",
};

const KEYWORD_MAP = {
  an_ninh: ["an ninh", "bảo vệ", "security", "an toàn"],
  camera_giam_sat: ["camera", "giám sát", "quan sát", "cctv"],
  khoa_thong_minh: ["khóa", "thông minh", "smart lock", "vân tay", "fingerprint"],
  canh_quan: ["cảnh quan", "landscape", "cây xanh", "thiên nhiên"],
  khuon_vien: ["khuôn viên", "sân", "khu vực chung"],
  san_thuong: ["sân thượng", "tầng thượng", "rooftop", "terrace"],
  san_vuon: ["sân vườn", "vườn", "garden"],
  chinh_sach: ["chính sách", "ưu đãi", "policy", "khuyến mãi"],
  chiet_khau: ["chiết khấu", "giảm giá", "discount", "ưu đãi"],
  ngan_hang: ["ngân hàng", "vay", "bank", "tín dụng", "lãi suất", "trả góp"],
  thanh_toan: ["thanh toán", "payment", "trả tiền", "đóng tiền", "tiến độ thanh toán"],
  chu_dau_tu: ["chủ đầu tư", "developer", "nhã đạt", "nha dat", "công ty"],
  nha_dat: ["nhã đạt", "nha dat", "nhadat", "chủ đầu tư"],
  gia_ban: ["giá", "bán", "price", "bảng giá", "chi phí", "bao nhiêu tiền", "giá bán"],
  mat_bang: ["mặt bằng", "phân lô", "layout", "sơ đồ", "bản đồ lô", "diện tích"],
  ngoai_that: ["ngoại thất", "exterior", "bên ngoài", "mặt ngoài"],
  noi_that: ["nội thất", "interior", "bên trong", "thiết kế trong"],
  cosmo_gen_2: ["cosmo", "cosmo gen 2", "dòng cosmo"],
  fusion_gen_5: ["fusion", "fusion gen 5", "dòng fusion"],
  opus: ["opus", "dòng opus"],
  signature_by_codinachs: ["signature", "codinachs", "dòng signature"],
  bep: ["bếp", "kitchen", "nấu ăn", "phòng bếp", "phòng ăn"],
  gara: ["gara", "garage", "để xe", "đậu xe", "ô tô"],
  phong_khach: ["phòng khách", "living room", "tiếp khách", "sinh hoạt"],
  phong_ngu: ["phòng ngủ", "bedroom", "ngủ", "nghỉ ngơi", "master bedroom"],
  wc: ["wc", "toilet", "nhà vệ sinh", "phòng tắm", "bathroom"],
  mat_tien: ["mặt tiền", "facade", "trước nhà"],
  phoi_canh: ["phối cảnh", "perspective", "render", "3d"],
  showroom: ["showroom", "nhà mẫu", "phòng trưng bày"],
  "van phong": ["văn phòng", "office", "làm việc"],
  phap_ly: ["pháp lý", "legal", "giấy tờ", "hợp đồng"],
  giay_phep: ["giấy phép", "permit", "phép xây dựng", "giấy phép xây dựng"],
  so_hong: ["sổ hồng", "sổ đỏ", "quyền sở hữu", "chứng nhận"],
  tien_do: ["tiến độ", "progress", "xây dựng", "thi công"],
  xay_dung: ["xây dựng", "thi công", "construction", "công trình"],
  tien_ich: ["tiện ích", "amenity", "facilities", "dịch vụ"],
  cong_vao: ["cổng", "lối vào", "entrance", "gate"],
  cong_vien: ["công viên", "park", "vườn hoa"],
  ho_boi: ["hồ bơi", "bể bơi", "swimming pool", "pool"],
  landmark_coffee: ["coffee", "cà phê", "cafe", "landmark"],
  "lanscape-khuon-vien-anh-chup": ["khuôn viên", "ảnh chụp", "thực tế"],
  san_choi_tre_em: ["sân chơi", "trẻ em", "playground", "kids", "thiếu nhi"],
  san_the_thao: ["thể thao", "sport", "gym", "tập", "sân thể thao"],
  tong_quan: ["tổng quan", "overview", "giới thiệu", "dự án", "ny'ah", "nyah", "phú định"],
  vi_tri: ["vị trí", "location", "ở đâu", "địa chỉ", "bản đồ"],
  ban_do: ["bản đồ", "map", "vị trí"],
  duong_di: ["đường đi", "direction", "di chuyển", "route"],
  thang_xoan: ["thang xoắn", "cầu thang", "staircase", "thang"],
  tang_1_gara_phong_khach: ["tầng 1", "gara", "phòng khách", "tầng trệt"],
  tang_2_lung_phong_ngu_ong_ba: ["tầng 2", "tầng lửng", "phòng ngủ ông bà", "ông bà"],
  tang_3_bep_phong_an: ["tầng 3", "bếp", "phòng ăn"],
  tang_4_master_suite: ["tầng 4", "master", "suite", "phòng ngủ chính"],
  tang_5_phong_ngu_tre_em: ["tầng 5", "trẻ em", "phòng ngủ con"],
  tang_6_ban_cong: ["tầng 6", "ban công", "sân thượng", "tầng thượng"],
};

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

function getFolderDisplayName(folderName) {
  return FOLDER_NAME_MAP[folderName] || folderName.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getKeywords(folderName) {
  return KEYWORD_MAP[folderName] || [folderName.replace(/[_-]/g, " ")];
}

function buildTopicPath(parts) {
  return parts.map(p => getFolderDisplayName(p)).join(" - ");
}

function collectKeywordsFromPath(parts) {
  const keywords = new Set();
  for (const p of parts) {
    for (const kw of getKeywords(p)) {
      keywords.add(kw);
    }
  }
  return [...keywords];
}

function scanDirectory(dir, relativeParts = []) {
  const topics = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const images = entries
    .filter(e => e.isFile() && IMAGE_EXTS.has(path.extname(e.name).toLowerCase()))
    .map(e => e.name);

  const subdirs = entries.filter(e => e.isDirectory());

  if (images.length > 0) {
    const topicId = relativeParts.length > 0 ? relativeParts.join("__") : "root";
    const topicName = relativeParts.length > 0 ? buildTopicPath(relativeParts) : "Tổng quan Ny'ah Phú Định";
    const topicPath = relativeParts.join("/");
    const keywords = relativeParts.length > 0
      ? collectKeywordsFromPath(relativeParts)
      : ["tổng quan", "dự án", "ny'ah", "nyah", "phú định", "overview"];

    topics.push({
      id: topicId,
      name: topicName,
      path: topicPath,
      keywords,
      images: images.map(img => topicPath ? `${topicPath}/${img}` : img),
    });
  }

  for (const sub of subdirs) {
    const subTopics = scanDirectory(
      path.join(dir, sub.name),
      [...relativeParts, sub.name]
    );
    topics.push(...subTopics);
  }

  return topics;
}

function copyImages(sourceDir, destDir) {
  let count = 0;
  function walk(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        walk(srcPath, destPath);
      } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        count++;
      }
    }
  }
  walk(sourceDir, destDir);
  return count;
}

console.log(`Scanning: ${SOURCE_DIR}`);
console.log(`Output images: ${OUTPUT_DIR}`);
console.log(`Output JSON: ${OUTPUT_JSON}`);
console.log("");

const topics = scanDirectory(SOURCE_DIR);
console.log(`Found ${topics.length} topics`);

const totalImages = topics.reduce((sum, t) => sum + t.images.length, 0);
console.log(`Total images: ${totalImages}`);
console.log("");

for (const t of topics) {
  console.log(`  [${t.id}] ${t.name} (${t.images.length} images)`);
}

console.log("\nCopying images...");
const copied = copyImages(SOURCE_DIR, OUTPUT_DIR);
console.log(`Copied ${copied} images`);

const output = {
  generatedAt: new Date().toISOString(),
  sourceDir: "01_NyAh-PhuDinh",
  totalTopics: topics.length,
  totalImages,
  topics,
};

fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2), "utf-8");
console.log(`\nWritten: ${OUTPUT_JSON}`);
console.log("Done!");
