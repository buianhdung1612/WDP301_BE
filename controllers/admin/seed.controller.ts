import { Request, Response } from 'express';
import Role from '../../models/role.model';
import Service from '../../models/service.model';
import CategoryService from '../../models/category-service.model';
import AccountAdmin from '../../models/account-admin.model';
import Breed from '../../models/breed.model';
import bcrypt from 'bcryptjs';

// [POST] /api/v1/admin/seed/roles-and-staff
export const seedRolesAndStaff = async (req: Request, res: Response) => {
    try {
        console.log('🚀 Starting seed process...');

        // 1. Lấy tất cả services
        const services = await Service.find({ deleted: false }).lean();
        console.log(`📋 Found ${services.length} services`);

        if (services.length === 0) {
            return res.status(400).json({
                code: 400,
                message: 'Không có dịch vụ nào trong hệ thống. Vui lòng tạo services trước!'
            });
        }

        // 2. Lấy categories
        const categories = await CategoryService.find({}).lean();
        const categoryMap: any = {};
        categories.forEach(cat => {
            categoryMap[cat._id.toString()] = cat.name;
        });

        // 3. Nhóm services theo category
        const servicesByCategory: any = {};
        services.forEach(service => {
            const catId = service.categoryId ? service.categoryId.toString() : 'uncategorized';
            if (!servicesByCategory[catId]) {
                servicesByCategory[catId] = [];
            }
            servicesByCategory[catId].push(service);
        });

        console.log('📦 Services grouped by category');

        // 4. Xóa roles cũ (nếu có)
        await Role.deleteMany({});
        console.log('🗑️  Cleared old roles');

        // 5. Tạo roles mới
        const rolesToCreate: any[] = [];

        // Role 1: Admin
        rolesToCreate.push({
            name: 'Quản trị viên',
            description: 'Quản lý toàn bộ hệ thống',
            isStaff: false,
            serviceIds: [],
            permissions: ['*'],
            status: 'active',
            deleted: false
        });

        // Role 2: Manager
        rolesToCreate.push({
            name: 'Quản lý',
            description: 'Quản lý nhân viên và lịch đặt',
            isStaff: false,
            serviceIds: [],
            permissions: ['dashboard', 'booking', 'staff', 'service', 'report'],
            status: 'active',
            deleted: false
        });

        // Role 3-N: Staff roles theo category
        for (const [catId, servs] of Object.entries(servicesByCategory)) {
            const catName = categoryMap[catId] || 'Khác';
            const serviceIds = (servs as any[]).map(s => s._id);

            rolesToCreate.push({
                name: `Nhân viên ${catName}`,
                description: `Chuyên thực hiện các dịch vụ ${catName.toLowerCase()}`,
                isStaff: true,
                serviceIds: serviceIds,
                permissions: ['dashboard', 'booking'],
                status: 'active',
                deleted: false
            });
        }

        // Role cuối: Nhân viên đa năng
        rolesToCreate.push({
            name: 'Nhân viên đa năng',
            description: 'Có thể thực hiện tất cả các dịch vụ',
            isStaff: true,
            serviceIds: services.map(s => s._id),
            permissions: ['dashboard', 'booking', 'service'],
            status: 'active',
            deleted: false
        });

        const createdRoles = await Role.insertMany(rolesToCreate);
        console.log(`✅ Created ${createdRoles.length} roles`);

        // 6. Xóa account-admin cũ (trừ admin chính)
        await AccountAdmin.deleteMany({ email: { $ne: 'admin@example.com' } });
        console.log('🗑️  Cleared old staff accounts');

        // 7. Tạo account-admin mẫu
        const accountsToCreate: any[] = [];
        const defaultPassword = await bcrypt.hash('123456', 10);

        // Admin account
        const adminRole = createdRoles.find(r => r.name === 'Quản trị viên');
        accountsToCreate.push({
            fullName: 'Admin Hệ thống',
            email: 'admin@petcare.com',
            password: defaultPassword,
            phone: '0901234567',
            roles: [adminRole?._id],
            status: 'active',
            deleted: false,
            search: 'admin he thong admin@petcare.com'
        });

        // Manager account
        const managerRole = createdRoles.find(r => r.name === 'Quản lý');
        accountsToCreate.push({
            fullName: 'Nguyễn Văn Quản Lý',
            email: 'manager@petcare.com',
            password: defaultPassword,
            phone: '0901234568',
            roles: [managerRole?._id],
            status: 'active',
            deleted: false,
            search: 'nguyen van quan ly manager@petcare.com'
        });

        // Staff accounts - 2 nhân viên cho mỗi staff role
        const staffRoles = createdRoles.filter(r => r.isStaff);
        const staffNames = [
            'Trần Thị', 'Lê Văn', 'Phạm Thị', 'Hoàng Văn',
            'Vũ Thị', 'Đặng Văn', 'Bùi Thị', 'Đỗ Văn',
            'Ngô Thị', 'Dương Văn', 'Hồ Thị', 'Võ Văn'
        ];

        let staffIndex = 0;
        for (const role of staffRoles) {
            for (let i = 0; i < 2; i++) {
                const name = staffNames[staffIndex % staffNames.length];
                const number = staffIndex + 1;
                accountsToCreate.push({
                    fullName: `${name} ${role.name.replace('Nhân viên ', '')} ${i + 1}`,
                    email: `staff${number}@petcare.com`,
                    password: defaultPassword,
                    phone: `090123${4569 + number}`,
                    roles: [role._id],
                    status: 'active',
                    deleted: false,
                    search: `${name} ${role.name.replace('Nhân viên ', '')} ${i + 1} staff${number}@petcare.com`
                });
                staffIndex++;
            }
        }

        const createdAccounts = await AccountAdmin.insertMany(accountsToCreate);
        console.log(`✅ Created ${createdAccounts.length} accounts`);

        // 8. Trả về kết quả
        res.json({
            code: 200,
            message: 'Seed thành công!',
            data: {
                roles: {
                    total: createdRoles.length,
                    admin: createdRoles.filter(r => !r.isStaff).length,
                    staff: createdRoles.filter(r => r.isStaff).length,
                    list: createdRoles.map(r => ({
                        name: r.name,
                        isStaff: r.isStaff,
                        serviceCount: r.serviceIds.length
                    }))
                },
                accounts: {
                    total: createdAccounts.length,
                    admin: 1,
                    manager: 1,
                    staff: createdAccounts.length - 2,
                    defaultPassword: '123456',
                    list: createdAccounts.map((a: any) => ({
                        fullName: a.fullName,
                        email: a.email,
                        phone: a.phone
                    }))
                }
            }
        });

    } catch (error) {
        console.error('❌ Seed failed:', error);
        res.status(500).json({
            code: 500,
            message: 'Lỗi khi seed dữ liệu',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
// [POST] /api/v1/admin/seed/breeds
export const seedBreeds = async (req: Request, res: Response) => {
    try {
        const dogBreeds = [
            "Poodle", "Corgi", "Golden Retriever", "Husky", "Alaska",
            "Becgie", "Phú Quốc", "Chihuahua", "Bulldog", "Shiba Inu",
            "Samoyed", "Pitbull", "Pug", "Doberman", "Bắc Kinh"
        ];

        const catBreeds = [
            "Anh lông ngắn", "Anh lông dài", "Mèo Ba Tư", "Mèo Munchkin",
            "Mèo Scottish Fold", "Mèo Ragdoll", "Mèo Siamese", "Mèo Bengal",
            "Mèo Sphynx", "Mèo Nga", "Mèo Mỹ lông ngắn", "Mèo mướp", "Mèo Vàng"
        ];

        const breedsToCreate: any[] = [];

        dogBreeds.forEach(name => {
            breedsToCreate.push({ name, type: "dog" });
        });

        catBreeds.forEach(name => {
            breedsToCreate.push({ name, type: "cat" });
        });

        await Breed.deleteMany({});
        const createdBreeds = await Breed.insertMany(breedsToCreate);

        res.json({
            code: 200,
            message: "Seed giống thú cưng thành công!",
            data: {
                total: createdBreeds.length,
                dogs: dogBreeds.length,
                cats: catBreeds.length
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi seed giống thú cưng"
        });
    }
};
