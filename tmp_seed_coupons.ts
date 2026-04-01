import mongoose from 'mongoose';
import Coupon from './models/coupon.model';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URL = process.env.DATABASE || "mongodb://localhost:27017/TeddyPet";

const seedCoupons = async () => {
    try {
        await mongoose.connect(MONGO_URL);
        console.log("Connected to MongoDB...");

        const now = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(now.getMonth() + 1);

        const lastMonth = new Date();
        lastMonth.setMonth(now.getMonth() - 1);

        const coupons = [
            {
                code: "WDP301",
                name: "Giảm 20% cho dự án WDP",
                description: "Mã giảm giá đặc biệt cho người dùng hệ thống WDP301",
                typeDiscount: "percentage",
                value: 20,
                minOrderValue: 200000,
                maxDiscountValue: 100000,
                usageLimit: 100,
                startDate: now,
                endDate: nextMonth,
                typeDisplay: "public",
                status: "active"
            },
            {
                code: "TEDDY50K",
                name: "Giảm ngay 50k",
                description: "Ưu đãi giảm trực tiếp 50.000đ cho đơn hàng từ 300k",
                typeDiscount: "fixed",
                value: 50000,
                minOrderValue: 300000,
                usageLimit: 50,
                startDate: now,
                endDate: nextMonth,
                typeDisplay: "public",
                status: "active"
            },
            {
                code: "NEWBIE",
                name: "Chào mừng bạn mới",
                description: "Giảm 10% cho đơn hàng đầu tiên",
                typeDiscount: "percentage",
                value: 10,
                minOrderValue: 0,
                maxDiscountValue: 50000,
                usageLimit: 1000,
                startDate: now,
                endDate: nextMonth,
                typeDisplay: "public",
                status: "active"
            },
            {
                code: "VIP100",
                name: "Tri ân khách hàng VIP",
                description: "Giảm ngay 100.000đ cho đơn hàng lớn",
                typeDiscount: "fixed",
                value: 100000,
                minOrderValue: 1000000,
                usageLimit: 20,
                startDate: now,
                endDate: nextMonth,
                typeDisplay: "private",
                status: "active"
            },
            {
                code: "HETHAN",
                name: "Mã đã hết hạn",
                description: "Mã này dùng để test trường hợp hết hạn sử dụng",
                typeDiscount: "percentage",
                value: 50,
                minOrderValue: 100000,
                maxDiscountValue: 200000,
                usageLimit: 10,
                startDate: lastMonth,
                endDate: lastMonth, // Đã hết hạn
                typeDisplay: "public",
                status: "active"
            }
        ];

        for (const c of coupons) {
            await Coupon.updateOne(
                { code: c.code },
                { $set: c },
                { upsert: true }
            );
            console.log(`- Seeded coupon: ${c.code}`);
        }

        console.log("Seed finished successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Error seeding coupons:", err);
        process.exit(1);
    }
};

seedCoupons();
