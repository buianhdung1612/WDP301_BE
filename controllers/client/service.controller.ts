import express, { Request, Response } from "express";
import Service from "../../models/service.model";
import ServiceCategory from "../../models/category-service.model";

// [GET] /api/v1/client/services
export const listServices = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const categoryId = req.query.categoryId as string;
        const petType = req.query.petType as string;

        let filter: any = { deleted: false, status: "active" };
        if (categoryId) filter.categoryId = categoryId;
        if (petType) filter.petType = petType;

        const services = await Service.find(filter)
            .populate("categoryId")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Service.countDocuments(filter);

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

// [GET] /api/v1/client/services/:id
export const getService = async (req: Request, res: Response) => {
    try {
        const service = await Service.findById(req.params.id);

        if (!service || service.deleted || service.status === "inactive") {
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

// [GET] /api/v1/client/service-categories
export const getCategories = async (req: Request, res: Response) => {
    try {
        const categories = await ServiceCategory.find({
            deleted: false,
            status: "active"
        }).sort({ createdAt: 1 });

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
