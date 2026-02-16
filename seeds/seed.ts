import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../models/role.model";

dotenv.config();

const rolesData = [
    {
        name: "Nhân viên Cắt tỉa (Grooming)",
        description: "Chuyên thực hiện các dịch vụ cắt tỉa lông cho thú cưng",
        isStaff: true,
        serviceIds: [], // Sẽ được assign sau khi có services
        permissions: ["dashboard", "booking"],
        status: "active",
    },
    {
        name: "Nhân viên Vệ sinh (Bathing)",
        description: "Chuyên thực hiện các dịch vụ tắm và vệ sinh cho thú cưng",
        isStaff: true,
        serviceIds: [], // Sẽ được assign sau khi có services
        permissions: ["dashboard", "booking"],
        status: "active",
    },
    {
        name: "Kỹ thuật viên Toàn diện (All-in-one)",
        description: "Thành thạo tất cả các kỹ năng Spa, Cắt tỉa và Vệ sinh",
        isStaff: true,
        serviceIds: [], // Sẽ được assign sau khi có services
        permissions: ["dashboard", "booking", "service"],
        status: "active",
    }
];

const seedRoles = async () => {
    try {
        await mongoose.connect(`${process.env.DATABASE}`);
        console.log("Connected to DB for seeding...");

        // Clear existing staff roles to avoid duplicates if running multiple times
        // Or just insert new ones. The user asked for "data mẫu"
        await Role.insertMany(rolesData);

        console.log("Seed roles successfully!");
        process.exit();
    } catch (error) {
        console.error("Seed failed!", error);
        process.exit(1);
    }
};

seedRoles();
