import mongoose from "mongoose";
import dotenv from "dotenv";
import ServiceCategory from "../models/service-category.model";
import Service from "../models/service.model";

dotenv.config();

const seedData = async () => {
    try {
        // Kết nối DB
        await mongoose.connect(process.env.DATABASE || "mongodb://localhost:27017/pet-shop");
        console.log("✅ Kết nối DB thành công");

        // Xóa dữ liệu cũ
        await ServiceCategory.deleteMany({ deleted: false });
        await Service.deleteMany({ deleted: false });
        console.log("🗑️ Xóa dữ liệu cũ");

        // ============= TẠO DANH MỤC =============

        // 1. Tắm spa
        const tamSpaCategory = await ServiceCategory.create({
            name: "Tắm Spa",
            slug: "tam-spa",
            description: "Dịch vụ tắm và chăm sóc lông toàn diện",
            status: "active"
        });
        console.log("✅ Tạo danh mục: Tắm Spa");

        // 2. Khách sạn
        const khachSanCategory = await ServiceCategory.create({
            name: "Khách sạn",
            slug: "khach-san",
            description: "Dịch vụ lưu trú cho thú cưng",
            status: "active"
        });
        console.log("✅ Tạo danh mục: Khách sạn");

        // 3. Vận chuyển
        const vanChuyenCategory = await ServiceCategory.create({
            name: "Vận chuyển",
            slug: "van-chuyen",
            description: "Dịch vụ đưa đón thú cưng",
            status: "active"
        });
        console.log("✅ Tạo danh mục: Vận chuyển");

        // 4. Tư vấn
        const tuVanCategory = await ServiceCategory.create({
            name: "Tư vấn",
            slug: "tu-van",
            description: "Dịch vụ tư vấn sức khỏe và chăm sóc",
            status: "active"
        });
        console.log("✅ Tạo danh mục: Tư vấn");

        // ============= TẠO DỊCH VỤ =============

        // Danh mục Tắm Spa
        await Service.create({
            categoryId: tamSpaCategory._id.toString(),
            name: "Tắm spa chó",
            slug: "tam-spa-cho",
            description: "Tắm, cắt lông, làm đẹp toàn diện cho chó",
            duration: 60,
            petType: ["dog"],
            pricingType: "by-weight",
            priceList: [
                { label: "< 5kg", value: 150000 },
                { label: "5-10kg", value: 250000 },
                { label: "10-20kg", value: 350000 },
                { label: "> 20kg", value: 500000 }
            ],
            status: "active"
        });

        await Service.create({
            categoryId: tamSpaCategory._id.toString(),
            name: "Tắm spa mèo",
            slug: "tam-spa-meo",
            description: "Tắm, cắt lông, làm đẹp toàn diện cho mèo",
            duration: 45,
            petType: ["cat"],
            pricingType: "by-weight",
            priceList: [
                { label: "< 5kg", value: 200000 },
                { label: "> 5kg", value: 300000 }
            ],
            status: "active"
        });

        await Service.create({
            categoryId: tamSpaCategory._id.toString(),
            name: "Cắt lông định hình",
            slug: "cat-long-dinh-hinh",
            description: "Cắt lông theo kiểu định hình chuyên nghiệp",
            duration: 90,
            petType: ["dog", "cat"],
            pricingType: "by-weight",
            priceList: [
                { label: "< 5kg", value: 200000 },
                { label: "5-10kg", value: 300000 },
                { label: "10-20kg", value: 400000 },
                { label: "> 20kg", value: 600000 }
            ],
            status: "active"
        });

        console.log("✅ Tạo 3 dịch vụ Tắm Spa");

        // Danh mục Khách sạn
        await Service.create({
            categoryId: khachSanCategory._id.toString(),
            name: "Khách sạn chuồng M",
            slug: "khach-san-chuong-m",
            description: "Phòng chuồng M cho chó nhỏ (< 10kg)",
            duration: 1440, // 1 ngày
            petType: ["dog"],
            pricingType: "fixed",
            basePrice: 150000,
            maxCapacity: 2,
            status: "active"
        });

        await Service.create({
            categoryId: khachSanCategory._id.toString(),
            name: "Khách sạn chuồng L",
            slug: "khach-san-chuong-l",
            description: "Phòng chuồng L cho chó vừa (10-20kg)",
            duration: 1440,
            petType: ["dog"],
            pricingType: "fixed",
            basePrice: 200000,
            maxCapacity: 1,
            status: "active"
        });

        await Service.create({
            categoryId: khachSanCategory._id.toString(),
            name: "Khách sạn chuồng XL",
            slug: "khach-san-chuong-xl",
            description: "Phòng chuồng XL cho chó to (> 20kg)",
            duration: 1440,
            petType: ["dog"],
            pricingType: "fixed",
            basePrice: 250000,
            maxCapacity: 1,
            status: "active"
        });

        await Service.create({
            categoryId: khachSanCategory._id.toString(),
            name: "Khách sạn VIP mèo",
            slug: "khach-san-vip-meo",
            description: "Phòng VIP riêng cho mèo",
            duration: 1440,
            petType: ["cat"],
            pricingType: "fixed",
            basePrice: 300000,
            maxCapacity: 1,
            status: "active"
        });

        console.log("✅ Tạo 4 dịch vụ Khách sạn");

        // Danh mục Vận chuyển
        await Service.create({
            categoryId: vanChuyenCategory._id.toString(),
            name: "Vận chuyển xe máy",
            slug: "van-chuyen-xe-may",
            description: "Đưa đón bằng xe máy (miễn phí < 10km)",
            duration: 30,
            petType: ["dog", "cat"],
            pricingType: "by-distance",
            priceList: [
                { label: "< 10km", value: 0 },
                { label: "> 10km", value: 10000 } // 10k/km
            ],
            status: "active"
        });

        await Service.create({
            categoryId: vanChuyenCategory._id.toString(),
            name: "Vận chuyển xe ô tô",
            slug: "van-chuyen-xe-oto",
            description: "Đưa đón bằng xe ô tô (miễn phí < 10km)",
            duration: 30,
            petType: ["dog", "cat"],
            pricingType: "by-distance",
            priceList: [
                { label: "< 10km", value: 0 },
                { label: "> 10km", value: 15000 } // 15k/km
            ],
            status: "active"
        });

        console.log("✅ Tạo 2 dịch vụ Vận chuyển");

        // Danh mục Tư vấn
        await Service.create({
            categoryId: tuVanCategory._id.toString(),
            name: "Tư vấn sức khỏe",
            slug: "tu-van-suc-khoe",
            description: "Tư vấn về sức khỏe và chăm sóc thú cưng",
            duration: 30,
            petType: ["dog", "cat"],
            pricingType: "fixed",
            basePrice: 100000,
            status: "active"
        });

        await Service.create({
            categoryId: tuVanCategory._id.toString(),
            name: "Tư vấn dinh dưỡng",
            slug: "tu-van-dinh-duong",
            description: "Tư vấn chế độ ăn uống khoa học",
            duration: 30,
            petType: ["dog", "cat"],
            pricingType: "fixed",
            basePrice: 150000,
            status: "active"
        });

        console.log("✅ Tạo 2 dịch vụ Tư vấn");

        console.log("\n🎉 Seed data thành công!\n");
        console.log("📊 Tóm tắt:");
        console.log("  - Danh mục: 4");
        console.log("  - Dịch vụ: 11");

        process.exit(0);
    } catch (error) {
        console.error("❌ Lỗi:", error);
        process.exit(1);
    }
};

seedData();
