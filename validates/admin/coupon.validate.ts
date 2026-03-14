import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const create = (req: Request, res: Response, next: NextFunction) => {
    const schema = Joi.object({
        code: Joi.string()
            .when('$method', { is: 'POST', then: Joi.required() })
            .messages({
                "string.empty": "Vui lòng nhập mã giảm giá!"
            }),
        name: Joi.string()
            .when('$method', { is: 'POST', then: Joi.required() })
            .messages({
                "string.empty": "Vui lòng nhập tên mã giảm giá!"
            }),
        typeDiscount: Joi.string().allow(''),
        value: Joi.alternatives().try(Joi.string(), Joi.number()).allow(''),
        minOrderValue: Joi.alternatives().try(Joi.string(), Joi.number()).allow(''),
        maxDiscountValue: Joi.alternatives().try(Joi.string(), Joi.number()).allow(''),
        usageLimit: Joi.alternatives().try(Joi.string(), Joi.number()).allow(''),
        typeDisplay: Joi.string().allow(''),
        status: Joi.string().allow(''),
        startDate: Joi.string().allow(''),
        endDate: Joi.string().allow(''),
        description: Joi.string().allow(''),
    });

    const { error } = schema.validate(req.body, { context: { method: req.method } });

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