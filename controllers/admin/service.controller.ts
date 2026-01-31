import express, { Request, Response } from "express";
import Service from "../../models/service.model";
import ServiceCategory from "../../models/category-service.model";

// [GET] /api/v1/admin/services
export const listServices = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const services = await Service.find({ deleted: false })
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
            message: "Lỗi khi lấy danh sách dịch vụ",
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// [GET] /api/v1/admin/services/:id
export const getService = async (req: Request, res: Response) => {
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

// [POST] /api/v1/admin/services
export const createService = async (req: Request, res: Response) => {
    try {
        const { categoryId, name, slug, description, duration, petType, pricingType, basePrice, priceList } = req.body;

        // Kiểm tra danh mục tồn tại
        const category = await ServiceCategory.findById(categoryId);
        if (!category) {
            return res.status(400).json({
                code: 400,
                message: "Danh mục dịch vụ không tồn tại"
            });
        }

        const newService = new Service({
            categoryId,
            name,
            slug,
            description,
            duration,
            petType,
            pricingType,
            basePrice,
            priceList,
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

// [PATCH] /api/v1/admin/services/:id
export const updateService = async (req: Request, res: Response) => {
    try {
        const { categoryId, name, slug, description, duration, petType, pricingType, basePrice, priceList, status } = req.body;

        const service = await Service.findById(req.params.id);
        if (!service || service.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Dịch vụ không tồn tại"
            });
        }

        // Cập nhật các trường
        if (categoryId) {
            const category = await ServiceCategory.findById(categoryId);
            if (!category) {
                return res.status(400).json({
                    code: 400,
                    message: "Danh mục dịch vụ không tồn tại"
                });
            }
            service.categoryId = categoryId;
        }

        if (name) service.name = name;
        if (slug) service.slug = slug;
        if (description) service.description = description;
        if (duration) service.duration = duration;
        if (petType) service.petType = petType;
        if (pricingType) service.pricingType = pricingType;
        if (basePrice) service.basePrice = basePrice;
        if (priceList) service.priceList = priceList;
        if (status) service.status = status;

        await service.save();

        res.json({
            code: 200,
            message: "Cập nhật dịch vụ thành công",
            data: service
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật dịch vụ"
        });
    }
};

// [DELETE] /api/v1/admin/services/:id
export const deleteService = async (req: Request, res: Response) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service || service.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Dịch vụ không tồn tại"
            });
        }

        service.deleted = true;
        service.deletedAt = new Date();
        await service.save();

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
