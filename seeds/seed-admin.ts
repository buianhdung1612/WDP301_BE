import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../models/role.model";
import AccountAdmin from "../models/account-admin.model";
import bcrypt from "bcryptjs";
import { permissionList } from "../configs/variable.config";

dotenv.config();

const allPermissions = permissionList.map(p => p.id);

const rolesData = [
    {
        name: "Super Admin",
        description: "Toàn quyền quản trị hệ thống",
        isStaff: false,
        permissions: allPermissions,
        status: "active",
    },
    {
        name: "Quản lý chi nhánh",
        description: "Quản lý nhân viên và đơn hàng tại chi nhánh",
        isStaff: false,
        permissions: allPermissions,
        status: "active",
    },
    {
        name: "Quản lý dịch vụ",
        description: "Quản lý dịch vụ, danh mục dịch vụ và giống thú cưng",
        isStaff: false,
        permissions: ["dashboard_view", "service_view", "service_category_view", "breed_view", "booking_view"],
        status: "active",
    },
    {
        name: "Chăm sóc khách hàng",
        description: "Hỗ trợ khách hàng và giải quyết khiếu nại",
        isStaff: false,
        permissions: ["booking_view", "account_user_view"],
        status: "active",
    },
    {
        name: "Nhân viên Content",
        description: "Quản lý bài viết và sản phẩm",
        isStaff: false,
        permissions: ["blog_view", "product_view", "product_category_view"],
        status: "active",
    }
];

const seedAdminAccounts = async () => {
    try {
        await mongoose.connect(`${process.env.DATABASE}`);
        console.log("Connected to DB for seeding admin accounts...");

        // 1. Create Roles
        const existingRoles = await Role.find({ name: { $in: rolesData.map(r => r.name) } });
        const rolesToInsert = rolesData.filter(r => !existingRoles.some(er => er.name === r.name));

        let allRoles = [...existingRoles];
        if (rolesToInsert.length > 0) {
            const insertedRoles = await Role.insertMany(rolesToInsert as any[]);
            allRoles = [...allRoles, ...insertedRoles];
        }
        console.log("Roles seeded/checked.");

        // 2. Create Admin Accounts
        const hashedPassword = await bcrypt.hash("123456", 10);

        const superAdminRole = allRoles.find(r => r.name === "Super Admin");
        const managerRole = allRoles.find(r => r.name === "Quản lý chi nhánh");
        const supportRole = allRoles.find(r => r.name === "Chăm sóc khách hàng");
        const contentRole = allRoles.find(r => r.name === "Nhân viên Content");

        const adminsData = [
            {
                fullName: "Angelique Morse",
                email: "benny89@yahoo.com",
                password: hashedPassword,
                phoneNumber: "+46 8 123 456",
                roles: [contentRole?._id],
                status: "inactive",
                avatar: "https://api-dev-minimal-v510.vercel.app/assets/images/avatar/avatar-1.webp"
            },
            {
                fullName: "Ariana Lang",
                email: "avery43@hotmail.com",
                password: hashedPassword,
                phoneNumber: "+54 11 1234-5678",
                roles: [superAdminRole?._id],
                status: "active",
                avatar: "https://api-dev-minimal-v510.vercel.app/assets/images/avatar/avatar-2.webp"
            },
            {
                fullName: "Aspen Schmitt",
                email: "mireya13@hotmail.com",
                password: hashedPassword,
                phoneNumber: "+34 91 123 4567",
                roles: [managerRole?._id],
                status: "inactive",
                avatar: "https://api-dev-minimal-v510.vercel.app/assets/images/avatar/avatar-3.webp"
            },
            {
                fullName: "Brycen Jimenez",
                email: "tyrel.greenholt@gmail.com",
                password: hashedPassword,
                phoneNumber: "+52 55 1234 5678",
                roles: [supportRole?._id],
                status: "active",
                avatar: "https://api-dev-minimal-v510.vercel.app/assets/images/avatar/avatar-4.webp"
            },
            {
                fullName: "Chase Day",
                email: "joana.simonis84@gmail.com",
                password: hashedPassword,
                phoneNumber: "+86 10 1234 5678",
                roles: [contentRole?._id],
                status: "active",
                avatar: "https://api-dev-minimal-v510.vercel.app/assets/images/avatar/avatar-5.webp"
            }
        ];

        // Clear existing to make it clean for test
        await AccountAdmin.deleteMany({ email: { $in: adminsData.map(a => a.email) } });
        await AccountAdmin.insertMany(adminsData);

        console.log("Admin accounts seeded successfully!");
        process.exit();
    } catch (error) {
        console.error("Seed failed!", error);
        process.exit(1);
    }
};

seedAdminAccounts();
