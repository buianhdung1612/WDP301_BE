import Joi from "joi";

// Service validation schemas
export const createServiceSchema = Joi.object({
    categoryId: Joi.string().required().messages({
        "any.required": "Danh mục dịch vụ là bắt buộc",
        "string.empty": "Danh mục dịch vụ không được để trống"
    }),
    name: Joi.string().required().min(3).max(255).messages({
        "any.required": "Tên dịch vụ là bắt buộc",
        "string.min": "Tên dịch vụ phải có ít nhất 3 ký tự",
        "string.max": "Tên dịch vụ không vượt quá 255 ký tự"
    }),
    slug: Joi.string().required().messages({
        "any.required": "Slug là bắt buộc"
    }),
    description: Joi.string().optional(),
    duration: Joi.number().positive().required().messages({
        "any.required": "Thời gian thực hiện là bắt buộc",
        "number.positive": "Thời gian thực hiện phải là số dương"
    }),
    petType: Joi.array().items(Joi.string().valid("dog", "cat")).required().messages({
        "any.required": "Loại pet là bắt buộc",
        "array.includesRequiredUnknowns": "Loại pet không hợp lệ"
    }),
    pricingType: Joi.string().valid("fixed", "by-weight", "by-cage", "by-distance").default("fixed"),
    basePrice: Joi.when("pricingType", {
        is: "fixed",
        then: Joi.number().positive().required(),
        otherwise: Joi.number().optional()
    }).messages({
        "number.positive": "Giá cơ bản phải là số dương"
    }),
    priceList: Joi.when("pricingType", {
        is: Joi.string().valid("by-weight", "by-cage", "by-distance"),
        then: Joi.array().items(
            Joi.object({
                label: Joi.string().required(),
                value: Joi.number().positive().required()
            })
        ).required(),
        otherwise: Joi.array().optional()
    })
});

export const updateServiceSchema = Joi.object({
    categoryId: Joi.string().optional(),
    name: Joi.string().optional().min(3).max(255),
    slug: Joi.string().optional(),
    description: Joi.string().optional(),
    duration: Joi.number().positive().optional(),
    petType: Joi.array().items(Joi.string().valid("dog", "cat")).optional(),
    pricingType: Joi.string().valid("fixed", "by-weight", "by-cage", "by-distance").optional(),
    basePrice: Joi.number().positive().optional(),
    priceList: Joi.array().optional(),
    status: Joi.string().valid("active", "inactive").optional()
});
