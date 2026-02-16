import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import AccountAdmin from '../../models/account-admin.model';
import Role from '../../models/role.model';
import { convertToSlug } from '../../helpers/slug.helper';

// [GET] /api/v1/admin/accounts
export const list = async (req: Request, res: Response) => {
    try {
        const find: any = {
            deleted: false
        };

        if (req.query.keyword) {
            const keyword = convertToSlug(`${req.query.keyword}`).replace(/-/g, " ");
            find.search = new RegExp(keyword, "i");
        }

        if (req.query.departmentId) {
            const roles = await Role.find({
                departmentId: req.query.departmentId,
                deleted: false
            }).select("_id");
            const roleIds = roles.map(r => r._id);
            find.roles = { $in: roleIds };
        }

        // Pagination
        const limitItems = parseInt(req.query.limit as string) || 20;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const skip = (page - 1) * limitItems;

        const [recordList, totalRecords] = await Promise.all([
            AccountAdmin.find(find)
                .select("-password")
                .sort({ createdAt: "desc" })
                .limit(limitItems)
                .skip(skip)
                .lean(),
            AccountAdmin.countDocuments(find)
        ]);

        // Populate roles with serviceIds for staff filtering
        const populatedList = await Promise.all(recordList.map(async (item) => {
            if (item.roles && item.roles.length > 0) {
                const roles = await Role.find({ _id: { $in: item.roles } })
                    .select("name isStaff serviceIds")
                    .lean();
                return { ...item, roles, rolesName: roles.map(r => r.name) };
            }
            return { ...item, roles: [], rolesName: [] };
        }));

        res.json({
            code: 200,
            message: "Danh sách quản trị viên",
            data: populatedList,
            pagination: {
                totalRecords,
                totalPages: Math.ceil(totalRecords / limitItems),
                currentPage: page,
                limit: limitItems
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi hệ thống"
        });
    }
};

// [POST] /api/v1/admin/accounts/create
export const create = async (req: Request, res: Response) => {
    try {
        const existAccount = await AccountAdmin.findOne({
            email: req.body.email,
            deleted: false
        });

        if (existAccount) {
            return res.status(400).json({
                code: 400,
                message: "Email đã được sử dụng bởi tài khoản khác!"
            });
        }

        req.body.search = convertToSlug(`${req.body.fullName} ${req.body.email}`).replace(/-/g, " ");

        // Hash password
        if (req.body.password) {
            req.body.password = await bcrypt.hash(req.body.password, 10);
        }

        const newRecord = new AccountAdmin(req.body);
        await newRecord.save();

        const result = newRecord.toObject();
        delete result.password;

        res.json({
            code: 201,
            message: "Tạo tài khoản thành công!",
            data: result
        });
    } catch (error) {
        res.status(400).json({
            code: 400,
            message: "Dữ liệu không hợp lệ!"
        });
    }
};

// [GET] /api/v1/admin/accounts/detail/:id
export const detail = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const account = await AccountAdmin.findOne({
            _id: id,
            deleted: false
        }).select("-password").lean();

        if (!account) {
            return res.status(404).json({
                code: 404,
                message: "Tài khoản không tồn tại"
            });
        }

        res.json({
            code: 200,
            data: account
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Id không hợp lệ"
        });
    }
};

// [PATCH] /api/v1/admin/accounts/edit/:id
export const edit = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        const existEmail = await AccountAdmin.findOne({
            email: req.body.email,
            _id: { $ne: id },
            deleted: false
        });

        if (existEmail) {
            return res.status(400).json({
                code: 400,
                message: "Email đã được sử dụng bởi tài khoản khác!"
            });
        }

        if (req.body.fullName || req.body.email) {
            const name = req.body.fullName || "";
            const email = req.body.email || "";
            req.body.search = convertToSlug(`${name} ${email}`).replace(/-/g, " ");
        }

        // Do not update password here
        delete req.body.password;

        await AccountAdmin.updateOne({
            _id: id,
            deleted: false
        }, req.body);

        res.json({
            code: 200,
            message: "Cập nhật thành công!"
        });
    } catch (error) {
        res.status(400).json({
            code: 400,
            message: "Dữ liệu không hợp lệ!"
        });
    }
};

// [PATCH] /api/v1/admin/accounts/change-password/:id
export const changePassword = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const password = await bcrypt.hash(req.body.password, 10);

        await AccountAdmin.updateOne({
            _id: id,
            deleted: false
        }, {
            password: password
        });

        res.json({
            code: 200,
            message: "Đổi mật khẩu thành công!"
        });
    } catch (error) {
        res.status(400).json({
            code: 400,
            message: "Dữ liệu không hợp lệ!"
        });
    }
};

// [DELETE] /api/v1/admin/accounts/delete/:id
export const deleteAccount = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        await AccountAdmin.updateOne({
            _id: id
        }, {
            deleted: true,
            deletedAt: new Date(),
        });

        res.json({
            code: 200,
            message: "Xóa tài khoản thành công!"
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Id không hợp lệ!"
        });
    }
};
// [GET] /api/v1/admin/accounts/staff-by-service
export const getStaffByService = async (req: Request, res: Response) => {
    try {
        const { serviceId } = req.query;

        if (!serviceId) {
            return res.status(400).json({
                code: 400,
                message: "Vui lòng cung cấp serviceId"
            });
        }

        // 1. Tìm các Roles có isStaff: true và chứa serviceId
        const roles = await Role.find({
            isStaff: true,
            serviceIds: serviceId,
            deleted: false,
            status: "active"
        }).select("_id");

        if (roles.length === 0) {
            return res.json({
                code: 200,
                data: []
            });
        }

        const roleIds = roles.map(r => r._id);

        // 2. Tìm các nhân viên có ít nhất một trong các role này
        const staff = await AccountAdmin.find({
            roles: { $in: roleIds },
            deleted: false,
            status: "active"
        }).select("-password").lean();

        res.json({
            code: 200,
            data: staff
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi hệ thống"
        });
    }
};
