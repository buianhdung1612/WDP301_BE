import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const create = (req: Request, res: Response, next: NextFunction) => {
    const schema = Joi.object({
        code: Joi.string()
            .required()
            .messages({
                "string.empty": "Vui lòng nhập mã giảm giá!"
            }),
        name: Joi.string()
            .required()
            .messages({
                "string.empty": "Vui lòng nhập tên mã giảm giá!"
            }),
        typeDiscount: Joi.string().allow(''),
        value: Joi.string().allow(''),
        minOrderValue: Joi.string().allow(''),
        maxDiscountValue: Joi.string().allow(''),
        usageLimit: Joi.string().allow(''),
        typeDisplay: Joi.string().allow(''),
        status: Joi.string().allow(''),
        startDate: Joi.string().allow(''),
        endDate: Joi.string().allow(''),
        description: Joi.string().allow(''),
    });

    const { error } = schema.validate(req.body);

    if (error) {
        const errorMessage = error.details[0].message;

        res.json({
            code: "error",
            message: errorMessage
        });
        return;
    }

    next();
}