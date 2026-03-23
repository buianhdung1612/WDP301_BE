import { Request, Response } from "express";
import Service from "../../models/service.model";
import ServiceCategory from "../../models/category-service.model";
import { buildCategoryTree } from "../../helpers/category.helper";
import { convertToSlug } from "../../helpers/slug.helper";
import Booking from "../../models/booking.model";

// --- CATEGORY CONTROLLERS ---

// [GET] /api/v1/admin/service/categories
export const categoryList = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const find: any = { deleted: req.query.is_trash === "true" ? true : false };

        if (req.query.keyword) {
            const keyword = convertToSlug(`${req.query.keyword}`).replace(/-/g, " ");
            find.name = new RegExp(keyword, "i");
        }

        if (req.query.status) {
            find.status = req.query.status;
        }

        const [categories, total, deletedCount] = await Promise.all([
            ServiceCategory.find(find)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            ServiceCategory.countDocuments(find),
            ServiceCategory.countDocuments({ deleted: true })
        ]);

        res.json({
            code: 200,
            message: "Danh sách danh mục dịch vụ",
            data: {
                recordList: categories,
                pagination: {
                    currentPage: page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    deletedCount
                }
            }
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
        const id = req.params.id;

        // Kiểm tra xem có danh mục con không
        const hasChildCategory = await ServiceCategory.exists({
            parentId: id,
            deleted: false
        });

        if (hasChildCategory) {
            return res.status(400).json({
                code: 400,
                message: "Không thể xóa danh mục này vì vẫn còn danh mục con bên trong!"
            });
        }

        // Kiểm tra xem có dịch vụ nào thuộc danh mục này không
        const hasService = await Service.exists({
            categoryId: id,
            deleted: false
        });

        if (hasService) {
            return res.status(400).json({
                code: 400,
                message: "Không thể xóa danh mục này vì vẫn còn dịch vụ đang thuộc danh mục!"
            });
        }

        await ServiceCategory.updateOne({ _id: id }, {
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

export const categoryRestore = async (req: Request, res: Response) => {
    try {
        await ServiceCategory.updateOne({ _id: req.params.id }, { $set: { deleted: false }, $unset: { deletedAt: 1 } });
        res.json({ code: 200, message: "Khôi phục danh mục thành công!" });
    } catch (e) {
        res.status(500).json({ code: 500, message: "Lỗi hệ thống!" });
    }
};

export const categoryForceDelete = async (req: Request, res: Response) => {
    try {
        await ServiceCategory.deleteOne({ _id: req.params.id });
        res.json({ code: 200, message: "Xóa vĩnh viễn danh mục thành công!" });
    } catch (e) {
        res.status(500).json({ code: 500, message: "Lỗi hệ thống!" });
    }
};


// --- SERVICE CONTROLLERS ---

// [GET] /api/v1/admin/services
export const serviceList = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const find: any = { deleted: req.query.is_trash === "true" ? true : false };

        const keyword = req.query.keyword || req.query.q;
        if (keyword) {
            const slugKeyword = convertToSlug(`${keyword}`).replace(/-/g, " ");
            const regex = new RegExp(`${keyword}`, "i");
            find.$or = [
                { name: regex },
                { slug: new RegExp(convertToSlug(`${keyword}`), "i") },
                { search: new RegExp(slugKeyword, "i") }
            ];
        }

        if (req.query.status) {
            find.status = req.query.status;
        }

        const [services, total, deletedCount] = await Promise.all([
            Service.find(find)
                .populate("categoryId", "name")
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            Service.countDocuments(find),
            Service.countDocuments({ deleted: true })
        ]);

        res.json({
            code: 200,
            message: "Danh sách dịch vụ",
            data: {
                recordList: services,
                pagination: {
                    currentPage: page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    deletedCount
                }
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
            pricingType, basePrice, priceList, images,
            minDuration, maxDuration, procedure
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
            images,
            minDuration,
            maxDuration,
            procedure,
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
            petTypes, pricingType, basePrice, priceList, status, images,
            minDuration, maxDuration, procedure
        } = req.body;

        const updateData: any = {
            name, slug, categoryId, description, duration,
            petTypes, pricingType, basePrice, priceList, status, images,
            minDuration, maxDuration, procedure
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
        const id = req.params.id;

        // Kiểm tra xem có lịch đặt nào dùng dịch vụ này không
        const hasBooking = await Booking.exists({
            serviceId: id,
            deleted: false
        });

        if (hasBooking) {
            return res.status(400).json({
                code: 400,
                message: "Không thể xóa dịch vụ này vì đang có khách đặt lịch sử dụng!"
            });
        }

        await Service.updateOne({ _id: id }, {
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

export const serviceRestore = async (req: Request, res: Response) => {
    try {
        await Service.updateOne({ _id: req.params.id }, { $set: { deleted: false }, $unset: { deletedAt: 1 } });
        res.json({ code: 200, message: "Khôi phục dịch vụ thành công!" });
    } catch (e) {
        res.status(500).json({ code: 500, message: "Lỗi hệ thống!" });
    }
};

export const serviceForceDelete = async (req: Request, res: Response) => {
    try {
        await Service.deleteOne({ _id: req.params.id });
        res.json({ code: 200, message: "Xóa vĩnh viễn dịch vụ thành công!" });
    } catch (e) {
        res.status(500).json({ code: 500, message: "Lỗi hệ thống!" });
    }
};
