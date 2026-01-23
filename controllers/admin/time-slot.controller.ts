import express, { Request, Response } from "express";
import TimeSlot from "../../models/time-slot.model";
import Service from "../../models/service.model";

// [GET] /api/v1/admin/time-slots
export const listTimeSlots = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const serviceId = req.query.serviceId as string;
        const date = req.query.date as string;

        let filter: any = { deleted: false };
        if (serviceId) filter.serviceId = serviceId;
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            filter.date = { $gte: startDate, $lt: endDate };
        }

        const slots = await TimeSlot.find(filter)
            .skip(skip)
            .limit(limit)
            .sort({ date: 1, startTime: 1 });

        const total = await TimeSlot.countDocuments(filter);

        res.json({
            code: 200,
            message: "Danh sách khung giờ",
            data: slots,
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
            message: "Lỗi khi lấy danh sách khung giờ"
        });
    }
};

// [POST] /api/v1/admin/time-slots
export const createTimeSlot = async (req: Request, res: Response) => {
    try {
        const { serviceId, date, startTime, endTime, maxCapacity, staffId, notes } = req.body;

        // Kiểm tra dịch vụ tồn tại
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(400).json({
                code: 400,
                message: "Dịch vụ không tồn tại"
            });
        }

        const newSlot = new TimeSlot({
            serviceId,
            date,
            startTime,
            endTime,
            maxCapacity,
            staffId,
            notes,
            status: "available"
        });

        await newSlot.save();

        res.status(201).json({
            code: 201,
            message: "Tạo khung giờ thành công",
            data: newSlot
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi tạo khung giờ",
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// [PATCH] /api/v1/admin/time-slots/:id
export const updateTimeSlot = async (req: Request, res: Response) => {
    try {
        const { startTime, endTime, maxCapacity, staffId, status, notes } = req.body;
        const slot = await TimeSlot.findById(req.params.id);

        if (!slot || slot.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Khung giờ không tồn tại"
            });
        }

        if (startTime) slot.startTime = startTime;
        if (endTime) slot.endTime = endTime;
        if (maxCapacity) slot.maxCapacity = maxCapacity;
        if (staffId) slot.staffId = staffId;
        if (status) slot.status = status;
        if (notes) slot.notes = notes;

        await slot.save();

        res.json({
            code: 200,
            message: "Cập nhật khung giờ thành công",
            data: slot
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật khung giờ"
        });
    }
};

// [DELETE] /api/v1/admin/time-slots/:id
export const deleteTimeSlot = async (req: Request, res: Response) => {
    try {
        const slot = await TimeSlot.findById(req.params.id);

        if (!slot || slot.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Khung giờ không tồn tại"
            });
        }

        slot.deleted = true;
        slot.deletedAt = new Date();
        await slot.save();

        res.json({
            code: 200,
            message: "Xóa khung giờ thành công"
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa khung giờ"
        });
    }
};
