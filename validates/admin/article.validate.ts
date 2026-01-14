import { NextFunction, Request, Response } from "express";
import Joi from "joi";

export const createCategory = (req: Request, res: Response, next: NextFunction) => {
    const schema = Joi.object({
        name: Joi.string()
            .required()
            .messages({
                "any.required": "Vui lòng nhập tên danh mục!",
                "string.empty": "Vui lòng nhập tên danh mục!"
            }),

        slug: Joi.string()
            .required()
            .messages({
                "any.required": "Vui lòng nhập tên đường dẫn!",
                "string.empty": "Vui lòng nhập tên đường dẫn!"
            }),

        parent: Joi.string().allow(""),
        status: Joi.string().allow(""),
        avatar: Joi.string().allow(""),
        description: Joi.string().allow("")
    });

    const { error } = schema.validate(req.body, {
        abortEarly: true
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    next();
};

export const createBlog = (req: Request, res: Response, next: NextFunction) => {
    const schema = Joi.object({
        name: Joi.string()
            .required()
            .messages({
                "string.empty": "Vui lòng nhập tên bài viết!"
            }),
        slug: Joi.string()
            .required()
            .messages({
                "string.empty": "Vui lòng nhập tên đường dẫn!"
            }),
        category: Joi.string().allow(''),
        status: Joi.string().allow(''),
        avatar: Joi.string().allow(''),
        description: Joi.string().allow(''),
        content: Joi.string().allow('')
    })

    const { error } = schema.validate(req.body, {
        abortEarly: true
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    next();
}