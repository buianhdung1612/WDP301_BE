import { Request, Response } from 'express';
import Setting from '../../models/setting.model';

// [GET] /api/v1/admin/settings/general
export const getGeneral = async (req: Request, res: Response) => {
    try {
        const setting = await Setting.findOne();

        res.json({
            code: 200,
            message: "Thông tin cài đặt chung",
            data: setting || {}
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Có lỗi xảy ra"
        });
    }
};

// [PATCH] /api/v1/admin/settings/general
export const updateGeneral = async (req: Request, res: Response) => {
    try {
        const setting = await Setting.findOne();

        if (setting) {
            await Setting.updateOne({ _id: setting.id }, req.body);
        } else {
            const newSetting = new Setting(req.body);
            await newSetting.save();
        }

        res.json({
            code: 200,
            message: "Cập nhật cài đặt thành công"
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Cập nhật thất bại"
        });
    }
};
