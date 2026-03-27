import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Service from './models/service.model';
import CategoryService from './models/category-service.model';
import Department from './models/department.model';

async function seedData() {
    try {
        await mongoose.connect(process.env.DATABASE as string);
        console.log("Connected to DB");

        const spaCat = await CategoryService.findOne({ name: "Spa & Chăm sóc", deleted: false });
        const cutCat = await CategoryService.findOne({ name: "Cắt tỉa", deleted: false });
        const comboCat = await CategoryService.findOne({ name: "Combo Tiết kiệm", deleted: false });

        console.log("SPA CAT ID:", spaCat?._id);
        console.log("CUT CAT ID:", cutCat?._id);
        console.log("COMBO CAT ID:", comboCat?._id);

        const mapping = [
            { name: "Tắm sấy khử mùi chuyên sâu", cat: spaCat?._id },
            { name: "Vệ sinh tai & Nhổ lông tai", cat: spaCat?._id },
            { name: "Cắt mài móng chân", cat: spaCat?._id },
            { name: "Vắt tuyến hôi", cat: spaCat?._id },
            { name: "Cắt tỉa tạo kiểu toàn thân", cat: cutCat?._id },
            { name: "Cắt tỉa vệ sinh (Hygienic Clip)", cat: cutCat?._id },
            { name: "Nhuộm lông thời trang", cat: cutCat?._id },
            { name: "Combo Sạch Toàn Diện", cat: comboCat?._id },
            { name: "Combo Grooming Đẳng Cấp", cat: comboCat?._id },
            { name: "Combo Thư Giãn", cat: comboCat?._id }
        ];

        for (const item of mapping) {
            if (item.cat) {
                const res = await Service.updateOne(
                    { name: item.name, deleted: false },
                    { $set: { categoryId: item.cat } }
                );
                console.log(`Update ${item.name}:`, res.modifiedCount > 0 ? "SUCCESS" : "NO_CHANGE/NOT_FOUND");
            } else {
                console.log(`ERROR: Category not found for service ${item.name}`);
            }
        }

        console.log("Fixing categories completed!");
        await mongoose.disconnect();
    } catch (e) {
        console.error("Error:", e);
    }
}

seedData();
