import Joi from "joi";

// Booking validation schemas
export const createBookingSchema = Joi.object({
    serviceId: Joi.string().required().messages({
        "any.required": "Dịch vụ là bắt buộc"
    }),
    petIds: Joi.array().items(Joi.string()).min(1).required().messages({
        "any.required": "Vui lòng chọn ít nhất một thú cưng",
        "array.min": "Vui lòng chọn ít nhất một thú cưng"
    }),
    notes: Joi.string().optional().max(500)
}).unknown(true);

export const cancelBookingSchema = Joi.object({
    reason: Joi.string().optional().max(255)
});

export const confirmBookingSchema = Joi.object().unknown(true);
export const completeBookingSchema = Joi.object().unknown(true);
