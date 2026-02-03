import { Request, Response } from 'express';
import Role from '../../models/role.model';
import { convertToSlug } from '../../helpers/slug.helper';

// [GET] /api/v1/admin/roles
export const list = async (req: Request, res: Response) => {
    try {
        const find: any = {
            deleted: false
        };

        if (req.query.keyword) {
            const keyword = convertToSlug(`${req.query.keyword}`).replace(/-/g, " ");
            find.search = new RegExp(keyword, "i");
        }

        // Pagination
        const limitItems = parseInt(req.query.limit as string) || 20;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const skip = (page - 1) * limitItems;

        const [recordList, totalRecords] = await Promise.all([
            Role.find(find)
                .sort({ createdAt: "desc" })
                .limit(limitItems)
                .skip(skip)
                .lean(),
            Role.countDocuments(find)
        ]);

        res.json({
            code: 200,
            message: "Danh sách nhóm quyền",
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

// [POST] /api/v1/admin/roles/create
export const create = async (req: Request, res: Response) => {
    try {
        req.body.search = convertToSlug(req.body.name).replace(/-/g, " ");

        const newRecord = new Role(req.body);
        await newRecord.save();

        res.json({
            code: 201,
            message: "Tạo nhóm quyền thành công!",
            data: newRecord
        });
    } catch (error) {
        res.status(400).json({
            code: 400,
            message: "Dữ liệu không hợp lệ!"
        });
    }
};

// [GET] /api/v1/admin/roles/detail/:id
export const detail = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const role = await Role.findOne({
            _id: id,
            deleted: false
        }).lean();

        if (!role) {
            return res.status(404).json({
                code: 404,
                message: "Nhóm quyền không tồn tại"
            });
        }

        res.json({
            code: 200,
            data: role
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Id không hợp lệ"
        });
    }
};

// [PATCH] /api/v1/admin/roles/edit/:id
export const edit = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        if (req.body.name) {
            req.body.search = convertToSlug(req.body.name).replace(/-/g, " ");
        }

        await Role.updateOne({
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

// [DELETE] /api/v1/admin/roles/delete/:id
export const deleteRole = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        await Role.updateOne({
            _id: id
        }, {
            deleted: true,
            deletedAt: new Date(),
        });

        res.json({
            code: 200,
            message: "Xóa nhóm quyền thành công!"
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Id không hợp lệ!"
        });
    }
};
