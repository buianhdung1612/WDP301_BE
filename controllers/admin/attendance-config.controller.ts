import { Request, Response } from "express";
import AttendanceConfig from "../../models/attendance-config.model";

// [GET] /api/v1/admin/attendance-configs
export const getConfig = async (req: Request, res: Response) => {
    try {
        let config = await AttendanceConfig.findOne();

        if (!config) {
            config = await AttendanceConfig.create({});
        }

        res.json({
            code: 200,
            data: config
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy cấu hình chấm công"
        });
    }
};

// [PATCH] /api/v1/admin/attendance-configs
export const updateConfig = async (req: Request, res: Response) => {
    try {
        let config = await AttendanceConfig.findOne();

        if (!config) {
            config = await AttendanceConfig.create(req.body);
        } else {
            Object.assign(config, req.body);
            await config.save();
        }

        res.json({
            code: 200,
            message: "Cập nhật cấu hình thành công",
            data: config
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật cấu hình"
        });
    }
};
