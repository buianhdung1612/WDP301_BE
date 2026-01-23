import Joi from "joi";

// Time Slot validation schemas
export const createTimeSlotSchema = Joi.object({
    serviceId: Joi.string().required().messages({
        "any.required": "Dịch vụ là bắt buộc"
    }),
    date: Joi.date().iso().required().messages({
        "any.required": "Ngày là bắt buộc",
        "date.base": "Ngày phải là định dạng ISO 8601"
    }),
    startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
        "any.required": "Giờ bắt đầu là bắt buộc",
        "string.pattern.base": "Giờ bắt đầu phải ở định dạng HH:mm"
    }),
    endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
        "any.required": "Giờ kết thúc là bắt buộc",
        "string.pattern.base": "Giờ kết thúc phải ở định dạng HH:mm"
    }),
    maxCapacity: Joi.number().positive().integer().required().messages({
        "any.required": "Sức chứa tối đa là bắt buộc",
        "number.positive": "Sức chứa tối đa phải là số dương"
    }),
    staffId: Joi.string().optional(),
    notes: Joi.string().optional().max(500)
});

export const updateTimeSlotSchema = Joi.object({
    startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    maxCapacity: Joi.number().positive().integer().optional(),
    staffId: Joi.string().optional(),
    status: Joi.string().valid("available", "full", "unavailable").optional(),
    notes: Joi.string().optional().max(500)
});
