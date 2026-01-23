import express, { Request, Response } from "express";
import ServiceCategory from "../../models/service-category.model";

// [GET] /api/v1/admin/service-categories
export const listCategories = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const categories = await ServiceCategory.find({ deleted: false })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await ServiceCategory.countDocuments({ deleted: false });

        res.json({
            code: 200,
            message: "Danh sách danh mục dịch vụ",
            data: categories,
            pagination: {
                currentPage: page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách danh mục dịch vụ"
        });
    }
};

// [GET] /api/v1/admin/service-categories/:id
export const getCategory = async (req: Request, res: Response) => {
    try {
        const category = await ServiceCategory.findById(req.params.id);

        if (!category || category.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Danh mục dịch vụ không tồn tại"
            });
        }

        res.json({
            code: 200,
            message: "Chi tiết danh mục dịch vụ",
            data: category
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy chi tiết danh mục dịch vụ"
        });
    }
};

// [POST] /api/v1/admin/service-categories
export const createCategory = async (req: Request, res: Response) => {
    try {
        const { name, slug, description, icon } = req.body;

        // Kiểm tra slug trùng
        const existingCategory = await ServiceCategory.findOne({ slug, deleted: false });
        if (existingCategory) {
            return res.status(400).json({
                code: 400,
                message: "Slug danh mục này đã tồn tại"
            });
        }

        const newCategory = new ServiceCategory({
            name,
            slug,
            description,
            icon,
            status: "active"
        });

        await newCategory.save();

        res.status(201).json({
            code: 201,
            message: "Tạo danh mục dịch vụ thành công",
            data: newCategory
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi tạo danh mục dịch vụ",
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// [PATCH] /api/v1/admin/service-categories/:id
export const updateCategory = async (req: Request, res: Response) => {
    try {
        const { name, slug, description, icon, status } = req.body;
        const category = await ServiceCategory.findById(req.params.id);

        if (!category || category.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Danh mục dịch vụ không tồn tại"
            });
        }

        // Kiểm tra slug trùng (nếu thay đổi)
        if (slug && slug !== category.slug) {
            const existingCategory = await ServiceCategory.findOne({ slug, deleted: false });
            if (existingCategory) {
                return res.status(400).json({
                    code: 400,
                    message: "Slug danh mục này đã tồn tại"
                });
            }
        }

        if (name) category.name = name;
        if (slug) category.slug = slug;
        if (description) category.description = description;
        if (icon) category.icon = icon;
        if (status) category.status = status;

        await category.save();

        res.json({
            code: 200,
            message: "Cập nhật danh mục dịch vụ thành công",
            data: category
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật danh mục dịch vụ"
        });
    }
};

// [DELETE] /api/v1/admin/service-categories/:id
export const deleteCategory = async (req: Request, res: Response) => {
    try {
        const category = await ServiceCategory.findById(req.params.id);

        if (!category || category.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Danh mục dịch vụ không tồn tại"
            });
        }

        category.deleted = true;
        category.deletedAt = new Date();
        await category.save();

        res.json({
            code: 200,
            message: "Xóa danh mục dịch vụ thành công"
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa danh mục dịch vụ"
        });
    }
};
