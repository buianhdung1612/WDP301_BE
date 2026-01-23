import Joi from "joi";

// Pet validation schemas
export const createPetSchema = Joi.object({
    name: Joi.string().required().min(2).max(100).messages({
        "any.required": "Tên thú cưng là bắt buộc",
        "string.min": "Tên thú cưng phải có ít nhất 2 ký tự"
    }),
    type: Joi.string().valid("dog", "cat").required().messages({
        "any.required": "Loại thú cưng là bắt buộc",
        "any.only": "Loại thú cưng phải là chó hoặc mèo"
    }),
    breed: Joi.string().optional().max(100),
    weight: Joi.number().positive().required().messages({
        "any.required": "Cân nặng là bắt buộc",
        "number.positive": "Cân nặng phải là số dương"
    }),
    age: Joi.number().positive().optional().messages({
        "number.positive": "Tuổi phải là số dương"
    }),
    color: Joi.string().optional().max(50),
    notes: Joi.string().optional().max(500),
    avatar: Joi.string().optional()
});

export const updatePetSchema = Joi.object({
    name: Joi.string().optional().min(2).max(100),
    breed: Joi.string().optional().max(100),
    weight: Joi.number().positive().optional(),
    age: Joi.number().positive().optional(),
    color: Joi.string().optional().max(50),
    healthStatus: Joi.string().valid("healthy", "sick", "vaccination-pending").optional(),
    notes: Joi.string().optional().max(500),
    avatar: Joi.string().optional()
});
