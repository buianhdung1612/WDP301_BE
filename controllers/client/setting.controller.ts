import { Request, Response } from 'express';
import Setting from '../../models/setting.model';

// [GET] /api/v1/setting/page/:key
export const getPage = async (req: Request, res: Response) => {
    const key = req.params.key;

    const record = await Setting.findOne({
        key: key
    });

    res.json({
        code: 200,
        message: "Dữ liệu trang tĩnh",
        data: record ? record.data : { title: "", content: "" }
    });
}

// [GET] /api/v1/setting/general
export const getGeneral = async (req: Request, res: Response) => {
    const key = "general";

    const record = await Setting.findOne({
        key: key
    });

    res.json({
        code: 200,
        message: "Cài đặt chung",
        data: record ? record.data : {}
    });
}
