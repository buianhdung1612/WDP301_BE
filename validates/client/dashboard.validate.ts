import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const profileEditPatch = (req: Request, res: Response, next: NextFunction) => {
    const schema = Joi.object({
        fullName: Joi.string()
            .min(5)
            .max(50)
            .required()
            .messages({
                "string.empty": "Vui lòng nhập họ tên!",
                "string.min": "Họ tên phải có ít nhất 5 ký tự!",
                "string.max": "Họ tên không được vượt quá 50 ký tự!",
            }),
        email: Joi.string()
            .email()
            .required()
            .messages({
                "string.empty": "Vui lòng nhập email!",
                "string.email": "Email không đúng định dạng!",
            }),
        phone: Joi.string()
            .allow('')
            .custom((value, helpers) => {
                if (value && !/^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/.test(value)) {
                    return helpers.error('phone.valid');
                }
                return value;
            })
            .messages({
                "phone.valid": "Số điện thoại không đúng định dạng!",
            }),
    });

    const { error } = schema.validate(req.body);

    if (error) {
        return res.json({
            success: false,
            message: error.details[0].message
        });
    }

    next();
}

export const addressCreatePost = (req: Request, res: Response, next: NextFunction) => {
    const schema = Joi.object({
        fullName: Joi.string()
            .min(5)
            .max(50)
            .required()
            .messages({
                "string.empty": "Vui lòng nhập họ tên!",
                "string.min": "Họ tên phải có ít nhất 5 ký tự!",
                "string.max": "Họ tên không được vượt quá 50 ký tự!",
            }),
        phone: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!/^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/.test(value)) {
                    return helpers.error('phone.valid');
                }
                return value;
            })
            .messages({
                "string.empty": "Vui lòng nhập số điện thoại!",
                "phone.valid": "Số điện thoại không đúng định dạng!",
            }),
        address: Joi.string()
            .required()
            .messages({
                "string.empty": "Vui lòng nhập tên đường, tòa nhà, số nhà!",
            }),
        longitude: Joi.number()
            .required()
            .messages({
                "number.base": "Địa chỉ không hợp lệ!",
                "any.required": "Vui lòng chọn vị trí trên bản đồ!"
            }),
        latitude: Joi.number()
            .required()
            .messages({
                "number.base": "Địa chỉ không hợp lệ!",
                "any.required": "Vui lòng chọn vị trí trên bản đồ!"
            }),
        isDefault: Joi.boolean()
            .required()
            .messages({
                "boolean.base": "Trường 'isDefault' phải là true hoặc false!",
                "any.required": "Vui lòng gửi kèm trường địa chỉ mặc định!"
            })
    });

    const { error } = schema.validate(req.body);

    if (error) {
        return res.json({
            success: false,
            message: error.details[0].message
        });
    }

    next();
}

export const changePasswordPatch = (req: Request, res: Response, next: NextFunction) => {
    const schema = Joi.object({
        newPassword: Joi.string()
            .min(8)
            .custom((value, helpers) => {
                if (!/[A-Z]/.test(value)) {
                    return helpers.error('password.uppercase');
                }
                if (!/[a-z]/.test(value)) {
                    return helpers.error('password.lowercase');
                }
                if (!/\d/.test(value)) {
                    return helpers.error('password.number');
                }
                if (!/[~!@#$%^&*]/.test(value)) {
                    return helpers.error('password.special');
                }
                return value;
            })
            .required()
            .messages({
                "string.empty": "Vui lòng nhập mật khẩu mới!",
                "string.min": "Mật khẩu mới phải có ít nhất 8 ký tự!",
                "password.uppercase": "Mật khẩu mới phải có ít nhất một chữ cái viết hoa!",
                "password.lowercase": "Mật khẩu mới phải có ít nhất một chữ cái viết thường!",
                "password.number": "Mật khẩu mới phải có ít nhất một chữ số!",
                "password.special": "Mật khẩu mới phải có ít nhất một ký tự đặc biệt! (~!@#$%^&*)",
            }),
        confirmPassword: Joi.string()
            .valid(Joi.ref('newPassword'))
            .required()
            .messages({
                "any.only": "Xác nhận mật khẩu không khớp!",
                "string.empty": "Vui lòng xác nhận mật khẩu mới!",
            }),
    });

    const { error } = schema.validate(req.body);

    if (error) {
        return res.json({
            success: false,
            message: error.details[0].message
        });
    }

    next();
}
