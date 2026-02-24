import { Request, Response } from "express";
import Service from "../../models/service.model";
import ServiceCategory from "../../models/category-service.model";
import { buildCategoryTree } from "../../helpers/category.helper";
import { convertToSlug } from "../../helpers/slug.helper";

// --- CATEGORY CONTROLLERS ---

// [GET] /api/v1/admin/service/categories
export const categoryList = async (req: Request, res: Response) => {
    try {
        const categories = await ServiceCategory.find({ deleted: false })
            .sort({ createdAt: -1 });

        res.json({
            code: 200,
            message: "Danh sách danh mục dịch vụ",
            data: categories
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách danh mục dịch vụ"
        });
    }
};

// [GET] /api/v1/admin/service/categories/tree
export const categoryTree = async (req: Request, res: Response) => {
    try {
        const categories = await ServiceCategory.find({ deleted: false }).lean();
        const tree = buildCategoryTree(categories);

        res.json({
            code: 200,
            message: "Cây danh mục dịch vụ",
            data: tree
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy cây danh mục dịch vụ"
        });
    }
};

// [GET] /api/v1/admin/services/categories/detail/:id
export const categoryDetail = async (req: Request, res: Response) => {
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

// [POST] /api/v1/admin/services/categories
export const categoryCreate = async (req: Request, res: Response) => {
    try {
        const { name, description, avatar, parentId, bookingTypes, petTypes } = req.body;

        let slug = req.body.slug || convertToSlug(name);

        // Kiểm tra trùng slug và tự động thêm hậu tố nếu cần
        let slugCheck = await ServiceCategory.findOne({ slug, deleted: false });
        let count = 1;
        const originalSlug = slug;
        while (slugCheck) {
            slug = `${originalSlug}-${count}`;
            slugCheck = await ServiceCategory.findOne({ slug, deleted: false });
            count++;
        }

        const newCategory = new ServiceCategory({
            name,
            slug,
            description,
            avatar,
            parentId: parentId || "",
            bookingTypes,
            petTypes,
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

// [PATCH] /api/v1/admin/services/categories/:id
export const categoryEdit = async (req: Request, res: Response) => {
    try {
        const category = await ServiceCategory.findById(req.params.id);

        if (!category || category.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Danh mục dịch vụ không tồn tại"
            });
        }

        if (req.body.name && !req.body.slug) {
            req.body.slug = convertToSlug(req.body.name);
        }

        if (req.body.slug && req.body.slug !== category.slug) {
            let slug = req.body.slug;
            let slugCheck = await ServiceCategory.findOne({
                slug,
                _id: { $ne: req.params.id },
                deleted: false
            });
            let count = 1;
            const originalSlug = slug;
            while (slugCheck) {
                slug = `${originalSlug}-${count}`;
                slugCheck = await ServiceCategory.findOne({
                    slug,
                    _id: { $ne: req.params.id },
                    deleted: false
                });
                count++;
            }
            req.body.slug = slug;
        }

        await ServiceCategory.updateOne({ _id: req.params.id }, req.body);

        const updatedCategory = await ServiceCategory.findById(req.params.id);

        res.json({
            code: 200,
            message: "Cập nhật danh mục dịch vụ thành công",
            data: updatedCategory
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật danh mục dịch vụ"
        });
    }
};

// [DELETE] /api/v1/admin/services/categories/:id
export const categoryDelete = async (req: Request, res: Response) => {
    try {
        await ServiceCategory.updateOne({ _id: req.params.id }, {
            deleted: true,
            deletedAt: new Date()
        });

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


// --- SERVICE CONTROLLERS ---

// [GET] /api/v1/admin/services
export const serviceList = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const services = await Service.find({ deleted: false })
            .populate("categoryId", "name")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Service.countDocuments({ deleted: false });

        res.json({
            code: 200,
            message: "Danh sách dịch vụ",
            data: services,
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
            message: "Lỗi khi lấy danh sách dịch vụ"
        });
    }
};

// [GET] /api/v1/admin/services/detail/:id
export const serviceDetail = async (req: Request, res: Response) => {
    try {
        const service = await Service.findById(req.params.id);

        if (!service || service.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Dịch vụ không tồn tại"
            });
        }

        res.json({
            code: 200,
            message: "Chi tiết dịch vụ",
            data: service
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy chi tiết dịch vụ"
        });
    }
};

// [POST] /api/v1/admin/services/create
export const serviceCreate = async (req: Request, res: Response) => {
    try {
        const {
            categoryId, name, description, duration, petTypes,
            pricingType, basePrice, priceList, minDuration,
            maxDuration, surchargeType, surchargeValue, images
        } = req.body;

        const category = await ServiceCategory.findById(categoryId);
        if (!category) {
            return res.status(400).json({
                code: 400,
                message: "Danh mục dịch vụ không tồn tại"
            });
        }

        let slug = req.body.slug || convertToSlug(name);
        let slugCheck = await Service.findOne({ slug, deleted: false });
        let count = 1;
        const originalSlug = slug;
        while (slugCheck) {
            slug = `${originalSlug}-${count}`;
            slugCheck = await Service.findOne({ slug, deleted: false });
            count++;
        }

        const newService = new Service({
            categoryId,
            name,
            slug,
            description,
            duration,
            petTypes,
            pricingType,
            basePrice,
            priceList,
            minDuration,
            maxDuration,
            surchargeType,
            surchargeValue,
            images,
            status: "active"
        });

        await newService.save();

        res.status(201).json({
            code: 201,
            message: "Tạo dịch vụ thành công",
            data: newService
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi tạo dịch vụ",
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// [PATCH] /api/v1/admin/services/edit/:id
export const serviceEdit = async (req: Request, res: Response) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service || service.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Dịch vụ không tồn tại"
            });
        }

        if (req.body.categoryId) {
            const category = await ServiceCategory.findById(req.body.categoryId);
            if (!category) {
                return res.status(400).json({
                    code: 400,
                    message: "Danh mục dịch vụ không tồn tại"
                });
            }
        }

        const {
            name, slug, categoryId, description, duration,
            petTypes, pricingType, basePrice, priceList, minDuration,
            maxDuration, surchargeType, surchargeValue, status, images
        } = req.body;

        const updateData: any = {
            name, slug, categoryId, description, duration,
            petTypes, pricingType, basePrice, priceList, minDuration,
            maxDuration, surchargeType, surchargeValue, status, images
        };

        // Xóa các trường undefined để tránh ghi đè dữ liệu cũ bằng null/undefined nếu không truyền
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        if (updateData.name && !updateData.slug) {
            updateData.slug = convertToSlug(updateData.name);
        }

        if (updateData.slug && updateData.slug !== service.slug) {
            let slugVal = updateData.slug;
            let slugCheck = await Service.findOne({
                slug: slugVal,
                _id: { $ne: req.params.id },
                deleted: false
            });
            let count = 1;
            const originalSlug = slugVal;
            while (slugCheck) {
                slugVal = `${originalSlug}-${count}`;
                slugCheck = await Service.findOne({
                    slug: slugVal,
                    _id: { $ne: req.params.id },
                    deleted: false
                });
                count++;
            }
            updateData.slug = slugVal;
        }

        await Service.updateOne({ _id: req.params.id }, updateData);
        const updatedService = await Service.findById(req.params.id);

        res.json({
            code: 200,
            message: "Cập nhật dịch vụ thành công",
            data: updatedService
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật dịch vụ"
        });
    }
};

// [DELETE] /api/v1/admin/services/delete/:id
export const serviceDelete = async (req: Request, res: Response) => {
    try {
        await Service.updateOne({ _id: req.params.id }, {
            deleted: true,
            deletedAt: new Date()
        });

        res.json({
            code: 200,
            message: "Xóa dịch vụ thành công"
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa dịch vụ"
        });
    }
};
