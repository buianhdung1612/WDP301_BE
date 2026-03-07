import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import AccountUser from '../../models/account-user.model';
import { convertToSlug } from '../../helpers/slug.helper';

// [GET] /api/v1/admin/accounts-user
export const list = async (req: Request, res: Response) => {
    try {
        const find: any = {
            deleted: false
        };

        if (req.query.keyword) {
            const keyword = convertToSlug(`${req.query.keyword}`).replace(/-/g, " ");
            find.search = new RegExp(keyword, "i");
        }

        if (req.query.createdBy) {
            find.createdBy = req.query.createdBy;
        }

        // Pagination
        const limitItems = parseInt(req.query.limit as string) || 20;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const skip = (page - 1) * limitItems;

        const [recordList, totalRecords] = await Promise.all([
            AccountUser.find(find)
                .select("-password")
                .sort({ createdAt: "desc" })
                .limit(limitItems)
                .skip(skip)
                .lean(),
            AccountUser.countDocuments(find)
        ]);

        res.json({
            code: 200,
            message: "Danh sách tài khoản khách hàng",
            data: recordList,
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

// [POST] /api/v1/admin/accounts-user/create
export const create = async (req: Request, res: Response) => {
    try {
        const existAccount = await AccountUser.findOne({
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

        const newRecord = new AccountUser(req.body);
        await newRecord.save();

        const result = newRecord.toObject();
        delete result.password;

        res.json({
            code: 201,
            message: "Tạo tài khoản khách hàng thành công!",
            data: result
        });
    } catch (error) {
        res.status(400).json({
            code: 400,
            message: "Dữ liệu không hợp lệ!"
        });
    }
};

// [GET] /api/v1/admin/accounts-user/detail/:id
export const detail = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const account = await AccountUser.findOne({
            _id: id,
            deleted: false
        }).select("-password").lean();

        if (!account) {
            return res.status(404).json({
                code: 404,
                message: "Tài khoản khách hàng không tồn tại"
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

// [PATCH] /api/v1/admin/accounts-user/edit/:id
export const edit = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        const existEmail = await AccountUser.findOne({
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

        await AccountUser.updateOne({
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

// [PATCH] /api/v1/admin/accounts-user/change-password/:id
export const changePassword = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const password = await bcrypt.hash(req.body.password, 10);

        await AccountUser.updateOne({
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

// [DELETE] /api/v1/admin/accounts-user/delete/:id
export const deleteAccount = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        await AccountUser.updateOne({
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
