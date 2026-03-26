import { Request, Response } from "express";
import BoardingConfig from "../../models/boarding-config.model";

// [GET] /api/v1/admin/boarding-config
export const getBoardingConfig = async (_req: Request, res: Response) => {
    try {
        let config = await BoardingConfig.findOne();
        if (!config) {
            // Create default config if not found
            config = await BoardingConfig.create({});
        }

        res.json({
            code: 200,
            data: config
        });
    } catch (error: any) {
        res.status(500).json({ code: 500, message: error.message });
    }
};

// [PATCH] /api/v1/admin/boarding-config
export const updateBoardingConfig = async (req: Request, res: Response) => {
    try {
        const config = await BoardingConfig.findOneAndUpdate({}, req.body, {
            new: true,
            upsert: true
        });

        res.json({
            code: 200,
            message: "Cập nhật cấu hình khách sạn thành công",
            data: config
        });
    } catch (error: any) {
        res.status(500).json({ code: 500, message: error.message });
    }
};
