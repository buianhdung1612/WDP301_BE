import { Request, Response } from "express";
import BookingConfig from "../../models/booking-config.model";

// [GET] /admin/booking-config
export const getConfig = async (req: Request, res: Response) => {
    try {
        let config = await BookingConfig.findOne({});

        if (!config) {
            config = await BookingConfig.create({});
        }

        res.json({
            code: 200,
            data: config
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
};

// [PATCH] /admin/booking-config
export const updateConfig = async (req: Request, res: Response) => {
    try {
        let config = await BookingConfig.findOne({});

        if (!config) {
            config = await BookingConfig.create(req.body);
        } else {
            await BookingConfig.updateOne({ _id: config._id }, req.body);
            config = await BookingConfig.findOne({ _id: config._id });
        }

        res.json({
            code: 200,
            message: "Cập nhật cấu hình thành công!",
            data: config
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
};
