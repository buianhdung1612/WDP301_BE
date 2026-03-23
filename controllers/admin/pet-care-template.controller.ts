import { Request, Response } from "express";
import FoodTemplate from "../../models/food-template.model";
import ExerciseTemplate from "../../models/exercise-template.model";

// ===================== SEED DATA =====================

const FOOD_SEED_DATA = [
    // ══════════════════════════════════════════════════
    // CHÓ
    // ══════════════════════════════════════════════════

    // ─── CHÓ – Thức ăn tươi (Thịt) ──────────────────
    { name: "Thịt heo nạc luộc chín", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "all", description: "Luộc không gia vị, thái nhỏ vừa ăn" },
    { name: "Thịt gà luộc (bỏ xương)", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "all", description: "Bỏ hết xương nhỏ trước khi cho ăn" },
    { name: "Thịt bò luộc/xay", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "adult", description: "Giàu protein và sắt" },
    { name: "Gan luộc (heo/bò/gà)", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "all", description: "Chỉ 1–2 lần/tuần, tránh thừa vitamin A" },
    { name: "Trứng luộc chín", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "all", description: "Giàu protein, tốt cho lông" },
    { name: "Cá hấp (bỏ xương kỹ)", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "all", description: "Cá rô, cá tra, cá hồi – bỏ hết xương" },

    // ─── CHÓ – Thức ăn tươi (Rau củ / Tinh bột) ─────
    { name: "Gà luộc + Cơm trắng", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "all", description: "Bữa cơ bản, dễ tiêu hóa" },
    { name: "Thịt bò + Cà rốt + Bí đỏ luộc", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "adult", description: "Giàu beta-carotene và khoáng chất" },
    { name: "Gà + Khoai lang luộc", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "all", description: "Tinh bột tốt, giàu chất xơ" },
    { name: "Gà + Rau cải xanh luộc", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "all", description: "Bổ sung vitamin và chất xơ" },
    { name: "Cháo gà loãng (cho chó ốm)", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "all", description: "Dùng khi chó biếng ăn, tiêu chảy" },
    { name: "Cá hấp + Khoai lang nghiền", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "all", description: "Giàu Omega-3, tốt cho da lông" },
    { name: "Cơm trắng + Trứng + Cà rốt", group: "Thức ăn tươi", petType: "dog", brand: "", ageGroup: "all", description: "Bữa đơn giản, đủ chất" },

    // ─── CHÓ – Hạt khô ───────────────────────────────
    { name: "Royal Canin Mini Adult", group: "Hạt khô", petType: "dog", brand: "Royal Canin", ageGroup: "adult", description: "Chó nhỏ < 10kg" },
    { name: "Royal Canin Medium Adult", group: "Hạt khô", petType: "dog", brand: "Royal Canin", ageGroup: "adult", description: "Chó vừa 11–25kg" },
    { name: "Royal Canin Maxi Adult", group: "Hạt khô", petType: "dog", brand: "Royal Canin", ageGroup: "adult", description: "Chó lớn 26–44kg" },
    { name: "Royal Canin Mini Puppy", group: "Hạt khô", petType: "dog", brand: "Royal Canin", ageGroup: "puppy", description: "Chó con < 10kg" },
    { name: "Pedigree Adult Gà & Rau Củ", group: "Hạt khô", petType: "dog", brand: "Pedigree", ageGroup: "adult", description: "Phổ biến, dễ mua tại Việt Nam" },
    { name: "SmartHeart Adult (Gà & Lúa mì)", group: "Hạt khô", petType: "dog", brand: "SmartHeart", ageGroup: "adult", description: "Thương hiệu phổ biến tại VN, giá tốt" },
    { name: "SmartHeart Puppy", group: "Hạt khô", petType: "dog", brand: "SmartHeart", ageGroup: "puppy", description: "" },
    { name: "Ganador Adult (Gà & Cơm)", group: "Hạt khô", petType: "dog", brand: "Ganador", ageGroup: "adult", description: "Thương hiệu VN, giá phải chăng" },
    { name: "Ganador Puppy", group: "Hạt khô", petType: "dog", brand: "Ganador", ageGroup: "puppy", description: "" },
    { name: "Reflex Adult Dog", group: "Hạt khô", petType: "dog", brand: "Reflex", ageGroup: "adult", description: "Nhập khẩu Thổ Nhĩ Kỳ, grain-free tùy loại" },
    { name: "Purina Pro Plan Adult", group: "Hạt khô", petType: "dog", brand: "Purina", ageGroup: "adult", description: "" },
    { name: "Hills Science Diet Adult", group: "Hạt khô", petType: "dog", brand: "Hills", ageGroup: "adult", description: "" },
    { name: "ANF Lamb & Rice", group: "Hạt khô", petType: "dog", brand: "ANF", ageGroup: "all", description: "Tốt cho chó nhạy cảm tiêu hóa" },

    // ─── CHÓ – Pate / Ướt ────────────────────────────
    { name: "Pate chó SmartHeart (Gà)", group: "Pate / Ướt", petType: "dog", brand: "SmartHeart", ageGroup: "adult", description: "Đổi vị, tránh chó chán ăn" },
    { name: "Pate chó Pedigree (Gà & Gan)", group: "Pate / Ướt", petType: "dog", brand: "Pedigree", ageGroup: "adult", description: "" },
    { name: "Thịt đóng hộp chó (lon)", group: "Pate / Ướt", petType: "dog", brand: "", ageGroup: "adult", description: "Dùng xen kẽ với hạt khô" },
    { name: "Royal Canin Wet Chunks (túi)", group: "Pate / Ướt", petType: "dog", brand: "Royal Canin", ageGroup: "adult", description: "" },

    // ─── CHÓ – Snack ─────────────────────────────────
    { name: "Xương hàm bò sấy khô", group: "Snack", petType: "dog", brand: "", ageGroup: "adult", description: "Không cho chó nhỏ < 3 tháng" },
    { name: "Jerhigh Stick thưởng", group: "Snack", petType: "dog", brand: "Jerhigh", ageGroup: "all", description: "" },
    { name: "Bánh thưởng Dog Biscuit", group: "Snack", petType: "dog", brand: "", ageGroup: "adult", description: "" },
    { name: "Snack thịt gà sấy tự nhiên", group: "Snack", petType: "dog", brand: "", ageGroup: "all", description: "" },

    // ─── CHÓ – Đặc biệt ──────────────────────────────
    { name: "Sữa Puppy Beaphar (không lactose)", group: "Đặc biệt", petType: "dog", brand: "Beaphar", ageGroup: "puppy", description: "Chó con chưa ăn dặm" },
    { name: "Cháo phục hồi (chó ốm / hậu phẫu)", group: "Đặc biệt", petType: "dog", brand: "", ageGroup: "all", description: "Pha loãng, ấm, ăn từng muỗng nhỏ" },
    { name: "Hill's Prescription Diet i/d", group: "Đặc biệt", petType: "dog", brand: "Hills", ageGroup: "all", description: "Hỗ trợ tiêu hóa, dùng theo chỉ định bác sĩ" },

    // ─── CHÓ – Tự cung cấp ───────────────────────────
    { name: "Theo chế độ chủ cung cấp", group: "Tự cung cấp", petType: "dog", brand: "", ageGroup: "all", description: "" },
    { name: "Thức ăn kê toa bác sĩ thú y", group: "Tự cung cấp", petType: "dog", brand: "", ageGroup: "all", description: "" },

    // ══════════════════════════════════════════════════
    // MÈO
    // ══════════════════════════════════════════════════

    // ─── MÈO – Thức ăn tươi (Thịt / Cá) ─────────────
    { name: "Thịt gà xé nhỏ (không xương)", group: "Thức ăn tươi", petType: "cat", brand: "", ageGroup: "all", description: "Nguồn protein dễ tiêu hóa nhất cho mèo" },
    { name: "Cá rô hấp xé nhỏ (bỏ xương)", group: "Thức ăn tươi", petType: "cat", brand: "", ageGroup: "adult", description: "Mèo rất thích – bỏ hết xương nhỏ" },
    { name: "Cá tra luộc xé sợi", group: "Thức ăn tươi", petType: "cat", brand: "", ageGroup: "adult", description: "Giàu omega-3" },
    { name: "Cá hồi hấp (bỏ xương)", group: "Thức ăn tươi", petType: "cat", brand: "", ageGroup: "adult", description: "Tốt cho da và lông bóng mượt" },
    { name: "Thịt bò luộc xé nhỏ", group: "Thức ăn tươi", petType: "cat", brand: "", ageGroup: "adult", description: "" },
    { name: "Nội tạng gà/heo luộc (ít)", group: "Thức ăn tươi", petType: "cat", brand: "", ageGroup: "adult", description: "Chỉ 1–2 lần/tuần, tránh thừa đạm" },
    { name: "Trứng luộc chín (lòng đỏ)", group: "Thức ăn tươi", petType: "cat", brand: "", ageGroup: "all", description: "Giàu protein và biotin" },
    { name: "Tôm hấp bóc vỏ (không muối)", group: "Thức ăn tươi", petType: "cat", brand: "", ageGroup: "adult", description: "Lượng nhỏ thôi" },

    // ─── MÈO – Thức ăn tươi (Rau củ / Tinh bột phụ) ─
    { name: "Gà + Bí đỏ nghiền (ít)", group: "Thức ăn tươi", petType: "cat", brand: "", ageGroup: "all", description: "Mèo ít cần tinh bột, bí đỏ chỉ là phụ" },
    { name: "Gà + Cà rốt nghiền (ít)", group: "Thức ăn tươi", petType: "cat", brand: "", ageGroup: "all", description: "" },
    { name: "Cháo cá/gà loãng (mèo ốm)", group: "Thức ăn tươi", petType: "cat", brand: "", ageGroup: "all", description: "Ấm, loãng, không muối" },

    // ─── MÈO – Hạt khô ───────────────────────────────
    { name: "Royal Canin Kitten", group: "Hạt khô", petType: "cat", brand: "Royal Canin", ageGroup: "puppy", description: "Mèo con < 12 tháng" },
    { name: "Royal Canin Adult Indoor", group: "Hạt khô", petType: "cat", brand: "Royal Canin", ageGroup: "adult", description: "Mèo nuôi trong nhà" },
    { name: "Royal Canin Persian Adult", group: "Hạt khô", petType: "cat", brand: "Royal Canin", ageGroup: "adult", description: "Dành cho mèo Ba Tư" },
    { name: "Royal Canin British Shorthair", group: "Hạt khô", petType: "cat", brand: "Royal Canin", ageGroup: "adult", description: "Dành riêng cho mèo Anh lông ngắn" },
    { name: "Whiskas Adult Cá biển", group: "Hạt khô", petType: "cat", brand: "Whiskas", ageGroup: "adult", description: "Rất phổ biến tại Việt Nam" },
    { name: "Whiskas Kitten (Cá/Gà)", group: "Hạt khô", petType: "cat", brand: "Whiskas", ageGroup: "puppy", description: "" },
    { name: "Me-O Adult Cá Ngừ", group: "Hạt khô", petType: "cat", brand: "Me-O", ageGroup: "adult", description: "" },
    { name: "Catsrang Adult", group: "Hạt khô", petType: "cat", brand: "Catsrang", ageGroup: "adult", description: "Thương hiệu Hàn Quốc, phổ biến ở VN" },
    { name: "Reflex Cat Adult", group: "Hạt khô", petType: "cat", brand: "Reflex", ageGroup: "adult", description: "Nhập khẩu Thổ Nhĩ Kỳ" },
    { name: "Purina One Cat Adult", group: "Hạt khô", petType: "cat", brand: "Purina", ageGroup: "adult", description: "" },
    { name: "ANF Holistic Cat Chicken", group: "Hạt khô", petType: "cat", brand: "ANF", ageGroup: "adult", description: "Grain-free" },

    // ─── MÈO – Pate / Ướt ────────────────────────────
    { name: "Whiskas Pate Cá Biển (túi/lon)", group: "Pate / Ướt", petType: "cat", brand: "Whiskas", ageGroup: "adult", description: "" },
    { name: "Me-O Pate Cá Ngừ (lon)", group: "Pate / Ướt", petType: "cat", brand: "Me-O", ageGroup: "adult", description: "" },
    { name: "Royal Canin Wet Kitten (túi)", group: "Pate / Ướt", petType: "cat", brand: "Royal Canin", ageGroup: "puppy", description: "" },
    { name: "Fancy Feast Gà & Gan", group: "Pate / Ướt", petType: "cat", brand: "Fancy Feast", ageGroup: "adult", description: "" },

    // ─── MÈO – Snack (Súp thưởng) ────────────────────
    { name: "Churu Tuna (súp thưởng)", group: "Snack", petType: "cat", brand: "Churu", ageGroup: "all", description: "Mèo cực thích, bổ sung nước" },
    { name: "Churu Chicken (súp thưởng)", group: "Snack", petType: "cat", brand: "Churu", ageGroup: "all", description: "" },
    { name: "CIAO Soup Tuna (túi)", group: "Snack", petType: "cat", brand: "CIAO", ageGroup: "all", description: "Nhật Bản – mèo rất ưa thích" },
    { name: "Wanpy Cat Soup (gà/cá)", group: "Snack", petType: "cat", brand: "Wanpy", ageGroup: "all", description: "Giúp bổ sung nước hiệu quả" },
    { name: "Temptations Mix Snack", group: "Snack", petType: "cat", brand: "Temptations", ageGroup: "adult", description: "" },
    { name: "Snack thịt sấy mèo (natural)", group: "Snack", petType: "cat", brand: "", ageGroup: "all", description: "" },

    // ─── MÈO – Đặc biệt ──────────────────────────────
    { name: "Sữa Mèo CatMilk (không lactose)", group: "Đặc biệt", petType: "cat", brand: "Beaphar", ageGroup: "all", description: "Bổ sung khoáng, dành cho mọi lứa tuổi" },
    { name: "Cháo loãng phục hồi (mèo ốm)", group: "Đặc biệt", petType: "cat", brand: "", ageGroup: "all", description: "Ấm, loãng, ăn từng muỗng nhỏ" },
    { name: "Royal Canin Renal Wet (thận)", group: "Đặc biệt", petType: "cat", brand: "Royal Canin", ageGroup: "senior", description: "Dùng theo chỉ định bác sĩ" },
    { name: "Thức ăn mèo mang thai / cho con bú", group: "Đặc biệt", petType: "cat", brand: "", ageGroup: "all", description: "Cao protein, bổ sung DHA và canxi" },

    // ─── MÈO – Tự cung cấp ───────────────────────────
    { name: "Theo chế độ chủ cung cấp", group: "Tự cung cấp", petType: "cat", brand: "", ageGroup: "all", description: "" },
    { name: "Thức ăn kê toa bác sĩ thú y", group: "Tự cung cấp", petType: "cat", brand: "", ageGroup: "all", description: "" },
];

const EXERCISE_SEED_DATA = [
    // ══════════════════════════════════════════════════
    // CHÓ
    // ══════════════════════════════════════════════════

    // Nhẹ nhàng
    { name: "Dắt bộ sân trong (vòng quanh khu)", petType: "dog", durationMinutes: 20, intensity: "low", description: "Buổi sáng sớm hoặc chiều mát, tránh nắng" },
    { name: "Dắt bộ chậm ngoài đường (chó già/ốm)", petType: "dog", durationMinutes: 15, intensity: "low", description: "Đi nhẹ, không kéo dây" },
    { name: "Huấn luyện lệnh cơ bản (ngồi, nằm, lại đây)", petType: "dog", durationMinutes: 20, intensity: "low", description: "Kết hợp thưởng snack nhỏ, giúp kỷ luật và gắn kết" },
    { name: "Nose work – tìm đồ bằng mũi", petType: "dog", durationMinutes: 20, intensity: "low", description: "Giấu đồ ăn/đồ chơi quanh phòng, kích thích trí não cực tốt" },
    { name: "Chơi nhẹ trong phòng (chó con / hậu phẫu)", petType: "dog", durationMinutes: 15, intensity: "low", description: "Không chạy mạnh, tránh va đập" },
    { name: "Nghỉ ngơi có kiểm soát (chó ốm / già)", petType: "dog", durationMinutes: 0, intensity: "low", description: "Cho uống nước, massage nhẹ, kiểm tra thân nhiệt" },

    // Vừa phải
    { name: "Chạy bộ nhẹ xung quanh sân", petType: "dog", durationMinutes: 30, intensity: "medium", description: "Tránh giờ nắng gắt 10h–15h, mang theo nước uống" },
    { name: "Chơi ném bóng (fetch) ngoài sân", petType: "dog", durationMinutes: 20, intensity: "medium", description: "Khu sân cỏ hoặc hành lang rộng" },
    { name: "Chơi kéo co dây thừng", petType: "dog", durationMinutes: 15, intensity: "medium", description: "Tốt cho cơ hàm và phản xạ, tránh chó nhỏ < 5 tháng" },
    { name: "Chạy theo xe đạp / scooter chậm", petType: "dog", durationMinutes: 20, intensity: "medium", description: "Chỉ chó lớn khỏe, đường bằng phẳng, buổi mát" },
    { name: "Chơi tự do với chó khác (có giám sát)", petType: "dog", durationMinutes: 25, intensity: "medium", description: "Giám sát chặt để tránh cắn nhau, phù hợp chó xã hội tốt" },

    // Cường độ cao
    { name: "Chạy sprint ngắn (agility đơn giản)", petType: "dog", durationMinutes: 15, intensity: "high", description: "Dành cho chó trẻ khỏe như Poodle, Corgi, Golden, Labrador" },
    { name: "Bơi lội (hồ/bồn có kiểm soát)", petType: "dog", durationMinutes: 15, intensity: "high", description: "Chỉ giống ưa nước (Labrador, Golden...), phải giám sát liên tục" },
    { name: "Vượt chướng ngại vật (agility)", petType: "dog", durationMinutes: 20, intensity: "high", description: "Nhảy rào, chui ống – kích thích thể chất và trí tuệ" },

    // ══════════════════════════════════════════════════
    // MÈO
    // ══════════════════════════════════════════════════

    // Nhẹ nhàng
    { name: "Khám phá hộp / đường hầm bìa cứng", petType: "cat", durationMinutes: 20, intensity: "low", description: "Mèo thích không gian nhỏ – kích thích bản năng ẩn náu" },
    { name: "Chơi puzzle treat – ô tìm thức ăn", petType: "cat", durationMinutes: 15, intensity: "low", description: "Giấu snack trong khay ô, kích thích trí não" },
    { name: "Nhìn chim/cá qua cửa sổ (enrichment thụ động)", petType: "cat", durationMinutes: 30, intensity: "low", description: "Bật YouTube 'chim/cá cho mèo xem' hoặc mở cửa sổ có lưới" },
    { name: "Massage, chải lông thư giãn", petType: "cat", durationMinutes: 15, intensity: "low", description: "Tăng gắn kết, phát hiện u cục hoặc dấu hiệu bất thường" },
    { name: "Nghỉ ngơi có kiểm soát (mèo ốm / già)", petType: "cat", durationMinutes: 0, intensity: "low", description: "Giữ ấm, cung cấp nước, theo dõi hô hấp" },

    // Vừa phải
    { name: "Chơi cần câu lông vũ", petType: "cat", durationMinutes: 15, intensity: "medium", description: "Kích thích bản năng săn mồi – vẫy nhẹ nhàng, không cắm thẳng mắt mèo" },
    { name: "Chơi đồ chơi con chuột (tự chạy pin)", petType: "cat", durationMinutes: 15, intensity: "medium", description: "Mèo có thể tự chơi, ít cần người hỗ trợ" },
    { name: "Leo trèo cột cào mèo / kệ cao", petType: "cat", durationMinutes: 20, intensity: "medium", description: "Tăng cường cơ bắp và móng vuốt khỏe" },
    { name: "Chạy quanh phòng theo đồ chơi", petType: "cat", durationMinutes: 10, intensity: "medium", description: "" },

    // Cường độ cao
    { name: "Đuổi tia laser (có kiểm soát)", petType: "cat", durationMinutes: 10, intensity: "high", description: "Kết thúc bằng đồ chơi thật để mèo không thất vọng/strees" },
    { name: "Săn mồi giả cường độ cao (wand/lure)", petType: "cat", durationMinutes: 10, intensity: "high", description: "Phù hợp mèo trẻ khỏe, tránh chơi quá mức" },

    // ══════════════════════════════════════════════════
    // CHUNG
    // ══════════════════════════════════════════════════
    { name: "Tắm & vệ sinh lông toàn thân", petType: "all", durationMinutes: 30, intensity: "low", description: "Kiểm tra da, tai, móng, mắt khi tắm" },
    { name: "Chải lông / Cắt tỉa lông nhẹ", petType: "all", durationMinutes: 15, intensity: "low", description: "Tăng gắn kết và phát hiện ký sinh trùng" },
    { name: "Kiểm tra sức khỏe tổng quát (theo dõi)", petType: "all", durationMinutes: 10, intensity: "low", description: "Quan sát ăn uống, vệ sinh, hơi thở, hoạt động" },
];

// ===================== CONTROLLERS =====================

// [GET] /api/v1/admin/pet-care-template/food
export const listFoodTemplates = async (req: Request, res: Response) => {
    try {
        const { petType, group, isActive } = req.query;
        const filter: any = { deleted: false };
        if (petType && petType !== "all") filter.petType = { $in: [petType, "all"] };
        if (group) filter.group = group;
        if (isActive !== undefined) filter.isActive = isActive === "true";

        const items = await FoodTemplate.find(filter)
            .sort({ petType: 1, group: 1, name: 1 })
            .lean();

        return res.json({ code: 200, data: items });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// [POST] /api/v1/admin/pet-care-template/food
export const createFoodTemplate = async (req: Request, res: Response) => {
    try {
        const { name, group, petType, brand, ageGroup, description, isActive } = req.body;
        if (!name || !group) return res.status(400).json({ code: 400, message: "Tên và nhóm không được để trống" });

        const exists = await FoodTemplate.findOne({ name: name.trim(), petType: petType || "all", deleted: false });
        if (exists) return res.status(409).json({ code: 409, message: "Thức ăn này đã tồn tại" });

        const item = await FoodTemplate.create({ name: name.trim(), group, petType, brand, ageGroup, description, isActive: isActive ?? true });
        return res.status(201).json({ code: 201, data: item });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// [PATCH] /api/v1/admin/pet-care-template/food/:id
export const updateFoodTemplate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, group, petType, brand, ageGroup, description, isActive } = req.body;
        const item = await FoodTemplate.findOneAndUpdate(
            { _id: id, deleted: false },
            { name, group, petType, brand, ageGroup, description, isActive },
            { new: true, runValidators: true }
        );
        if (!item) return res.status(404).json({ code: 404, message: "Không tìm thấy" });
        return res.json({ code: 200, data: item });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// [DELETE] /api/v1/admin/pet-care-template/food/:id
export const deleteFoodTemplate = async (req: Request, res: Response) => {
    try {
        const item = await FoodTemplate.findOneAndUpdate(
            { _id: req.params.id, deleted: false },
            { deleted: true, deletedAt: new Date() },
            { new: true }
        );
        if (!item) return res.status(404).json({ code: 404, message: "Không tìm thấy" });
        return res.json({ code: 200, message: "Đã xóa" });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// ─── EXERCISE ────────────────────────────────────────────────────────

// [GET] /api/v1/admin/pet-care-template/exercise
export const listExerciseTemplates = async (req: Request, res: Response) => {
    try {
        const { petType, intensity } = req.query;
        const filter: any = { deleted: false };
        if (petType && petType !== "all") filter.petType = { $in: [petType, "all"] };
        if (intensity) filter.intensity = intensity;

        const items = await ExerciseTemplate.find(filter)
            .sort({ petType: 1, intensity: 1, name: 1 })
            .lean();

        return res.json({ code: 200, data: items });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// [POST] /api/v1/admin/pet-care-template/exercise
export const createExerciseTemplate = async (req: Request, res: Response) => {
    try {
        const { name, petType, durationMinutes, intensity, description, isActive } = req.body;
        if (!name) return res.status(400).json({ code: 400, message: "Tên không được để trống" });

        const exists = await ExerciseTemplate.findOne({ name: name.trim(), petType: petType || "all", deleted: false });
        if (exists) return res.status(409).json({ code: 409, message: "Bài vận động này đã tồn tại" });

        const item = await ExerciseTemplate.create({ name: name.trim(), petType, durationMinutes, intensity, description, isActive: isActive ?? true });
        return res.status(201).json({ code: 201, data: item });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// [PATCH] /api/v1/admin/pet-care-template/exercise/:id
export const updateExerciseTemplate = async (req: Request, res: Response) => {
    try {
        const { name, petType, durationMinutes, intensity, description, isActive } = req.body;
        const item = await ExerciseTemplate.findOneAndUpdate(
            { _id: req.params.id, deleted: false },
            { name, petType, durationMinutes, intensity, description, isActive },
            { new: true, runValidators: true }
        );
        if (!item) return res.status(404).json({ code: 404, message: "Không tìm thấy" });
        return res.json({ code: 200, data: item });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// [DELETE] /api/v1/admin/pet-care-template/exercise/:id
export const deleteExerciseTemplate = async (req: Request, res: Response) => {
    try {
        const item = await ExerciseTemplate.findOneAndUpdate(
            { _id: req.params.id, deleted: false },
            { deleted: true, deletedAt: new Date() },
            { new: true }
        );
        if (!item) return res.status(404).json({ code: 404, message: "Không tìm thấy" });
        return res.json({ code: 200, message: "Đã xóa" });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// ─── SEED ────────────────────────────────────────────────────────────

// [POST] /api/v1/admin/pet-care-template/seed
export const seedPetCareTemplates = async (_req: Request, res: Response) => {
    try {
        let foodInserted = 0;
        let exerciseInserted = 0;

        for (const item of FOOD_SEED_DATA) {
            const exists = await FoodTemplate.findOne({ name: item.name, petType: item.petType, deleted: false });
            if (!exists) {
                await FoodTemplate.create({ ...item, isActive: true });
                foodInserted++;
            }
        }

        for (const item of EXERCISE_SEED_DATA) {
            const exists = await ExerciseTemplate.findOne({ name: item.name, petType: item.petType, deleted: false });
            if (!exists) {
                await ExerciseTemplate.create({ ...item, isActive: true });
                exerciseInserted++;
            }
        }

        return res.json({
            code: 200,
            message: `Đã seed xong: ${foodInserted} thức ăn mới, ${exerciseInserted} bài vận động mới.`,
            data: { foodInserted, exerciseInserted },
        });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message });
    }
};
