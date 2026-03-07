import { Request, Response } from "express";
import Shift from "../../models/shift.model";
import WorkSchedule from "../../models/work-schedule.model";

// [GET] /api/v1/admin/shifts
export const index = async (req: Request, res: Response) => {
    try {
        const filter: any = {};

        if (req.query.status !== undefined) {
            filter.status = req.query.status;
        }

        if (req.query.departmentId) {
            filter.$or = [
                { departmentId: req.query.departmentId },
                { departmentId: null },
                { departmentId: { $exists: false } }
            ];
        }

        const shifts = await Shift.find(filter)
            .sort({ startTime: 1 });

        res.json({
            code: 200,
            message: "Danh sách ca làm việc",
            data: shifts
        });
    } catch (error: any) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách ca làm việc"
        });
    }
};

// [GET] /api/v1/admin/shifts/:id
export const detail = async (req: Request, res: Response) => {
    try {
        const shift = await Shift.findById(req.params.id);

        if (!shift) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy ca làm việc"
            });
        }

        res.json({
            code: 200,
            message: "Chi tiết ca làm việc",
            data: shift
        });
    } catch (error: any) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy chi tiết ca làm việc"
        });
    }
};

// [POST] /api/v1/admin/shifts
export const create = async (req: Request, res: Response) => {
    try {
        const { name, startTime, endTime, salaryMultiplier, departmentId } = req.body;

        const shift = new Shift({
            name,
            startTime,
            endTime,
            salaryMultiplier: salaryMultiplier || 1.0,
            departmentId,
            status: "active"
        });

        await shift.save();

        res.status(201).json({
            code: 201,
            message: "Tạo ca làm việc thành công",
            data: shift
        });
    } catch (error: any) {
        console.error("Error in shift create:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi tạo ca làm việc"
        });
    }
};

// [PATCH] /api/v1/admin/shifts/:id
export const update = async (req: Request, res: Response) => {
    try {
        const { name, startTime, endTime, salaryMultiplier, status, departmentId } = req.body;

        const shift = await Shift.findById(req.params.id);

        if (!shift) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy ca làm việc"
            });
        }

        if (name) shift.name = name;
        if (startTime) shift.startTime = startTime;
        if (endTime) shift.endTime = endTime;
        if (salaryMultiplier !== undefined) shift.salaryMultiplier = salaryMultiplier;
        if (status !== undefined) shift.status = status;
        if (departmentId !== undefined) shift.departmentId = departmentId;

        await shift.save();

        res.json({
            code: 200,
            message: "Cập nhật ca làm việc thành công",
            data: shift
        });
    } catch (error: any) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật ca làm việc"
        });
    }
};

// [DELETE] /api/v1/admin/shifts/:id
export const remove = async (req: Request, res: Response) => {
    try {
        const shiftId = req.params.id;

        // Check if shift is being used in WorkSchedule
        const isUsed = await WorkSchedule.findOne({ shiftId: shiftId });

        if (isUsed) {
            return res.status(400).json({
                code: 400,
                message: "Không thể xóa ca làm việc này vì đã có dữ liệu phân ca liên quan. Hãy ngừng hoạt động thay vì xóa."
            });
        }

        const result = await Shift.deleteOne({ _id: shiftId });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy ca làm việc để xóa"
            });
        }

        res.json({
            code: 200,
            message: "Xóa ca làm việc vĩnh viễn thành công"
        });
    } catch (error: any) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa ca làm việc"
        });
    }
};
