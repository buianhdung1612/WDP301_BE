import { NextFunction, Request, Response } from "express";
import Joi from "joi";

export const createCategory = (req: Request, res: Response, next: NextFunction) => {
    const schema = Joi.object({
        name: Joi.string()
            .required()
            .messages({
                "string.empty": "Vui lòng nhập tên danh mục!"
            }),
        slug: Joi.string()
            .required()
            .messages({
                "string.empty": "Vui lòng nhập đường dẫn!"
            }),
        parent: Joi.string().allow(''),
        status: Joi.string().allow(''),
        avatar: Joi.string().allow(''),
        description: Joi.string().allow(''),
    })

    const { error } = schema.validate(req.body);

    if (error) {
        const errorMessage = error.details[0].message;

        res.json({
            code: "error",
            message: errorMessage
        })
        return;
    }

    next();
}