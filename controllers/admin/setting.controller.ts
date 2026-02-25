import { Request, Response } from 'express';
import Setting from '../../models/setting.model';

// [GET] /api/v1/admin/settings/general
// export const getGeneral = async (req: Request, res: Response) => {
//     try {
//         const setting = await Setting.findOne();

//         res.json({
//             code: 200,
//             message: "Thông tin cài đặt chung",
//             data: setting || {}
//         });
//     } catch (error) {
//         res.status(500).json({
//             code: 500,
//             message: "Có lỗi xảy ra"
//         });
//     }
// };

// // [PATCH] /api/v1/admin/settings/general
// export const updateGeneral = async (req: Request, res: Response) => {
//     try {
//         const setting = await Setting.findOne();

//         if (setting) {
//             await Setting.updateOne({ _id: setting.id }, req.body);
//         } else {
//             const newSetting = new Setting(req.body);
//             await newSetting.save();
//         }

//         res.json({
//             code: 200,
//             message: "Cập nhật cài đặt thành công"
//         });
//     } catch (error) {
//         res.status(500).json({
//             code: 500,
//             message: "Cập nhật thất bại"
//         });
//     }
// };

export const apiShipping = async (req: Request, res: Response) => {
    const key = "apiShipping";

    const record = await Setting.findOne({
        key: key
    });

    res.json({
        code: 200,
        message: "API hãng vận chuyển",
        data: record ? record.data : {}
    });
}

export const apiShippingPatch = async (req: Request, res: Response) => {
    const { tokenGoShip } = req.body;

    const key = "apiShipping";

    const data = {
        tokenGoShip: tokenGoShip
    };

    const record = await Setting.findOneAndUpdate(
        {
            key: key
        },
        {
            key: key,
            data: data,
        },
        {
            upsert: true,
            new: true
        }
    );

    res.json({
        code: 200,
        message: "Cập nhật thành công!",
        data: record.data
    })
}

export const apiPayment = async (req: Request, res: Response) => {
    const key = "apiPayment";

    const record = await Setting.findOne({
        key: key
    });

    res.json({
        code: 200,
        message: "API cổng thanh toán",
        data: record ? record.data : {}
    });
}

export const apiPaymentPatch = async (req: any, res: Response) => {
    const key = "apiPayment";

    const record = await Setting.findOneAndUpdate(
        {
            key: key
        },
        {
            key: key,
            data: req.body,
            updatedBy: req.adminId
        },
        {
            upsert: true,
            new: true
        }
    );

    res.json({
        code: 200,
        message: "Cập nhật thành công!",
        data: record.data
    })
}

export const apiLoginSocial = async (req: Request, res: Response) => {
    const key = "apiLoginSocial";

    const record = await Setting.findOne({
        key: key
    });

    res.json({
        code: 200,
        message: "API đăng nhập mạng xã hội",
        data: record ? record.data : {}
    });
}

export const apiLoginSocialPatch = async (req: any, res: Response) => {
    const key = "apiLoginSocial";

    const record = await Setting.findOneAndUpdate(
        {
            key: key
        },
        {
            key: key,
            data: req.body,
            updatedBy: req.adminId
        },
        {
            upsert: true,
            new: true
        }
    );

    res.json({
        code: 200,
        message: "Cập nhật thành công!",
        data: record.data
    })
}

export const apiAppPassword = async (req: Request, res: Response) => {
    const key = "apiAppPassword";

    const record = await Setting.findOne({
        key: key
    });

    res.json({
        code: 200,
        message: "API mật khẩu ứng dụng của Google",
        data: record ? record.data : {}
    });
}

export const apiAppPasswordPatch = async (req: any, res: Response) => {
    const key = "apiAppPassword";

    const record = await Setting.findOneAndUpdate(
        {
            key: key
        },
        {
            key: key,
            data: req.body,
            updatedBy: req.adminId
        },
        {
            upsert: true,
            new: true
        }
    );

    res.json({
        code: 200,
        message: "Cập nhật thành công!",
        data: record.data
    })
}

export const general = async (req: Request, res: Response) => {
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

export const generalPatch = async (req: any, res: Response) => {
    const key = "general";

    const record = await Setting.findOneAndUpdate(
        {
            key: key
        },
        {
            key: key,
            data: req.body,
            updatedBy: req.adminId
        },
        {
            upsert: true,
            new: true
        }
    );

    res.json({
        code: 200,
        message: "Cập nhật thành công!",
        data: record.data
    })
}
