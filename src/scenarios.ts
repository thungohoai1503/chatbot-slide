export interface ConversationScenario {
  id: string;
  title: string;
  icon: string;
  description: string;
  conversation: string;
}

export const SCENARIOS: ConversationScenario[] = [
  {
    id: "Nyah-location",
    title: "Vị trí dự án Nyah Phú Định",
    icon: "📍",
    description: "Khảo sát vị trí Phú Định quận 8, kết nối giao thông và tiện ích xung quanh dự án.",
    conversation: "Chào em, anh đang tìm hiểu về dự án Nyah Phú Định. Em có thể giới thiệu chi tiết cho anh về vị trí của dự án này ở Quận 8 nằm chính xác khúc nào đường Trương Đình Hội không? Từ đây di chuyển sang Quận 1, Quận 4 hay Phú Mỹ Hưng có thuận tiện và có sợ bị ngập nước hay kẹt xe vào giờ cao điểm không em?",
  },
  {
    id: "cosmo-specs",
    title: "Mẫu nhà Cosmo Gen 2",
    icon: "🏠",
    description: "Diện tích đất: Rộng 5m x Dài 9m. Sử dụng: 250m² (6 tầng). Cấu trúc: 1 trệt + 1 lửng + 3 lầu + 1 tầng đa năng.",
    conversation: "Chào em, chị đang tìm hiểu về mẫu nhà phố Cosmo Gen 2. Em có thể tư vấn giúp chị xem có đúng mẫu thiết kế này có diện tích đất rộng 5m x dài 9m không em? Nghe nói tổng diện tích sử dụng lên tới 250m² với quy mô xây dựng gồm 1 trệt, 1 lửng, 3 lầu và 1 tầng đa năng (tổng cộng là 6 tầng) đúng không? Thiết kế các tầng bố trí thế nào để tối ưu không gian vậy em?",
  },
  {
    id: "kitchen",
    title: "Nội thất nhà bếp",
    icon: "🍳",
    description: "Thiết kế tủ bếp kịch trần tối ưu, thiết bị nhà bếp, vị trí lắp đặt thiết bị và cấu trúc nhà bếp.",
    conversation: "Chào em, anh sắp nhận bàn giao căn hộ Cosmo Gen 2 loại 2 phòng ngủ diện tích 45 mét vuông. Anh muốn thiết kế lại không gian bếp dạng chữ L kịch trần để tối ưu hóa lưu trữ và nhìn thông thoáng với phòng khách. Em có thể tư vấn cho anh về chất liệu gỗ tủ bếp, cấu trúc nhà bếp, cũng như việc lắp đặt các thiết bị gia dụng fullsize như tủ lạnh side-by-side hay tủ lạnh lớn và tích hợp giặt sấy tại bếp sao cho tối ưu diện tích và hợp phong thủy không em?",
  },
  {
    id: "distance-query",
    title: "Hỏi khoảng cách & Lộ trình",
    icon: "🛣️",
    description: "Tự động phát hiện khoảng cách từ dự án Nyah Phú Định tới Aeon Mall Bình Tân và các tiện ích xung quanh.",
    conversation: "Chào em, cho chị hỏi từ dự án Nyah Phú Định đi đến đại siêu thị Aeon Mall Bình Tân thì cách bao xa và di chuyển bằng xe máy mất khoảng bao lâu hả em?",
  },
];
