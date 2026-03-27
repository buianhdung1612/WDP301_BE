import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Service from './models/service.model';
import CategoryService from './models/category-service.model';
import Department from './models/department.model';

const convertToSlug = (text: string) => {
    return text.toString().toLowerCase()
        .replace(/á|à|ả|ạ|ã|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ/gi, 'a')
        .replace(/é|è|ẻ|ẹ|ẽ|ê|ế|ề|ể|ễ|ệ/gi, 'e')
        .replace(/i|í|ì|ỉ|ị|ĩ/gi, 'i')
        .replace(/ó|ò|ỏ|ọ|õ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ/gi, 'o')
        .replace(/ú|ù|ủ|ụ|ũ|ư|ứ|ừ|ử|ữ|ự/gi, 'u')
        .replace(/ý|ỳ|ỷ|ỵ|ỹ/gi, 'y')
        .replace(/đ/gi, 'd')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

const img = "https://res.cloudinary.com/dxyuuul0q/image/upload/v1769573827/lae7tlc4qkfd5vhpnwsw.jpg";

async function seedData() {
    try {
        await mongoose.connect(process.env.DATABASE as string);
        console.log("Connected to DB");

        const spaCat = await CategoryService.findOne({ name: "Spa & Chăm sóc", deleted: false });
        const cutCat = await CategoryService.findOne({ name: "Cắt tỉa", deleted: false });
        const comboCat = await CategoryService.findOne({ name: "Combo Tiết kiệm", deleted: false });
        let dept = await Department.findOne({ deleted: false });

        const servicesData = [
            // --- SPA & CARE ---
            {
                name: "Tắm sấy khử mùi chuyên sâu",
                categoryId: spaCat?._id,
                departmentId: dept?._id,
                duration: 60,
                minDuration: 45,
                maxExtensionMinutes: 20,
                pricingType: "by-weight",
                priceList: [{ label: "5", value: 150000 }, { label: "10", value: 250000 }, { label: "20", value: 400000 }],
                description: "Tắm sạch sâu, khử mùi hôi bằng hương thảo dược tự nhiên.",
                procedure: "<h3>Quy trình Tắm sấy</h3><ul><li>1. Chải lông toàn thân.</li><li>2. Tắm sạch bề mặt.</li><li>3. Tắm sâu bằng tinh chất.</li><li>4. Sấy khô và chải phồng.</li><li>5. Xịt dưỡng bóng lông.</li></ul>",
                images: [img]
            },
            {
                name: "Vệ sinh tai & Nhổ lông tai",
                categoryId: spaCat?._id,
                departmentId: dept?._id,
                duration: 20,
                minDuration: 15,
                maxExtensionMinutes: 10,
                pricingType: "fixed",
                basePrice: 80000,
                description: "Vệ sinh sâu tai để tránh viêm nhiễm cho thú cưng.",
                procedure: "<h3>Quy trình Vệ sinh tai</h3><ul><li>1. Nhỏ dung dịch vệ sinh tai.</li><li>2. Massage tai nhẹ nhàng.</li><li>3. Dùng nhíp nhổ bớt lông thừa.</li><li>4. Làm sạch bằng tăm bông chuyên dụng.</li></ul>",
                images: [img]
            },
            {
                name: "Cắt mài móng chân",
                categoryId: spaCat?._id,
                departmentId: dept?._id,
                duration: 15,
                minDuration: 10,
                maxExtensionMinutes: 5,
                pricingType: "fixed",
                basePrice: 60000,
                description: "Cắt ngắn móng an toàn và mài bóng bề mặt móng.",
                procedure: "<h3>Quy trình Cắt móng</h3><ul><li>1. Kiểm tra mạch máu ở móng.</li><li>2. Cắt móng bằng kìm bén.</li><li>3. Mài móng bằng máy mài điện để giảm độ sắc.</li></ul>",
                images: [img]
            },
            {
                name: "Vắt tuyến hôi",
                categoryId: spaCat?._id,
                departmentId: dept?._id,
                duration: 10,
                minDuration: 5,
                maxExtensionMinutes: 5,
                pricingType: "fixed",
                basePrice: 50000,
                description: "Giúp chó mèo không bị ngứa vùng hậu môn và giảm mùi hôi.",
                procedure: "<h3>Quy trình Vắt tuyến hôi</h3><ul><li>1. Kiểm tra tuyến hôi.</li><li>2. Thực hiện kỹ thuật vắt sạch dịch.</li><li>3. Vệ sinh và lau sạch sau khi vắt.</li></ul>",
                images: [img]
            },

            // --- CUTTING ---
            {
                name: "Cắt tỉa tạo kiểu toàn thân",
                categoryId: cutCat?._id,
                departmentId: dept?._id,
                duration: 120,
                minDuration: 90,
                maxExtensionMinutes: 40,
                pricingType: "by-weight",
                priceList: [{ label: "5", value: 350000 }, { label: "10", value: 500000 }, { label: "20", value: 750000 }],
                description: "Tạo hình thời trang và phong cách cho bộ lông.",
                procedure: "<h3>Quy trình Cắt tỉa tạo kiểu</h3><ul><li>1. Cắt thô xác định form dáng.</li><li>2. Tắm sấy thư giãn.</li><li>3. Tỉa chi tiết mặt, râu, chân.</li><li>4. Phun sương giữ nếp lông.</li></ul>",
                images: [img]
            },
            {
                name: "Cắt tỉa vệ sinh (Hygienic Clip)",
                categoryId: cutCat?._id,
                departmentId: dept?._id,
                duration: 35,
                minDuration: 25,
                maxExtensionMinutes: 10,
                pricingType: "fixed",
                basePrice: 150000,
                description: "Cắt tỉa lông vùng bàn chân, bụng, hậu môn để giữ vệ sinh.",
                procedure: "<h3>Quy trình Cắt tỉa vệ sinh</h3><ul><li>1. Tỉa lông bàn chân.</li><li>2. Vệ sinh lông bụng và hậu môn.</li><li>3. Cạo bớt lông vùng tai (theo yêu cầu).</li></ul>",
                images: [img]
            },
            {
                name: "Nhuộm lông thời trang",
                categoryId: cutCat?._id,
                departmentId: dept?._id,
                duration: 90,
                minDuration: 60,
                maxExtensionMinutes: 30,
                pricingType: "fixed",
                basePrice: 200000,
                description: "Thay đổi màu sắc cho tai, đuôi hoặc chân.",
                procedure: "<h3>Quy trình Nhuộm lông</h3><ul><li>1. Lựa chọn màu nhuộm an toàn.</li><li>2. Thoa màu và bọc ủ.</li><li>3. Tắm xả sạch màu thừa.</li><li>4. Sấy khô và hoàn thiện.</li></ul>",
                images: [img]
            },

            // --- COMBOS ---
            {
                name: "Combo Sạch Toàn Diện",
                categoryId: comboCat?._id,
                departmentId: dept?._id,
                duration: 100,
                minDuration: 80,
                maxExtensionMinutes: 30,
                pricingType: "by-weight",
                priceList: [{ label: "5", value: 250000 }, { label: "10", value: 380000 }, { label: "20", value: 550000 }],
                description: "Gói tiết kiệm bao gồm: Tắm sấy + Vệ sinh tai + Cắt móng.",
                procedure: "<h3>Quy trình Combo Sạch</h3><ul><li>1. Thực hiện các bước vệ sinh cơ bản.</li><li>2. Tắm sấy liều trình thư giãn.</li></ul>",
                images: [img]
            },
            {
                name: "Combo Grooming Đẳng Cấp",
                categoryId: comboCat?._id,
                departmentId: dept?._id,
                duration: 180,
                minDuration: 150,
                maxExtensionMinutes: 60,
                pricingType: "by-weight",
                priceList: [{ label: "5", value: 550000 }, { label: "10", value: 750000 }, { label: "20", value: 1050000 }],
                description: "Gói cao cấp kết hợp Full Grooming và Spa chăm sóc.",
                procedure: "<h3>Quy trình Combo Grooming</h3><p>Kết hợp cắt tỉa, tạo dáng và tắm dưỡng chuyên sâu trong 3 tiếng.</p>",
                images: [img]
            },
            {
                name: "Combo Thư Giãn",
                categoryId: comboCat?._id,
                departmentId: dept?._id,
                duration: 80,
                minDuration: 60,
                maxExtensionMinutes: 20,
                pricingType: "fixed",
                basePrice: 300000,
                description: "Tắm thảo dược, Massage body và vắt tuyến hôi.",
                procedure: "<h3>Quy trình Combo Thư Giãn</h3><ul><li>1. Ngâm bồn thảo dược.</li><li>2. Massage toàn thân.</li><li>3. Sấy khô và chăm sóc da nhạy cảm.</li></ul>",
                images: [img]
            }
        ];

        for (const s of servicesData) {
            const slug = convertToSlug(s.name);
            await Service.findOneAndUpdate(
                { name: s.name, deleted: false },
                { ...s, slug },
                { upsert: true, returnDocument: 'after' }
            );
            console.log(`Updated Service: ${s.name} (Slug: ${slug})`);
        }

        console.log("Seeding ALL services completed!");
        await mongoose.disconnect();
    } catch (e) {
        console.error("Error seeding services:", e);
    }
}

seedData();
