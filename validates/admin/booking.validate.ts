import Joi from "joi";

// Booking validation schemas
export const createBookingSchema = Joi.object({
    serviceId: Joi.string().required().messages({
        "any.required": "Dịch vụ là bắt buộc"
    }),
    slotId: Joi.string().required().messages({
        "any.required": "Khung giờ là bắt buộc"
    }),
    petIds: Joi.array().items(Joi.string()).min(1).required().messages({
        "any.required": "Vui lòng chọn ít nhất một thú cưng",
        "array.min": "Vui lòng chọn ít nhất một thú cưng"
    }),
    customerName: Joi.string().required().min(2).max(100).messages({
        "any.required": "Tên khách hàng là bắt buộc",
        "string.min": "Tên khách hàng phải có ít nhất 2 ký tự"
    }),
    customerPhone: Joi.string().required().regex(/^[0-9]{10,11}$/).messages({
        "any.required": "Số điện thoại là bắt buộc",
        "string.pattern.base": "Số điện thoại phải là 10-11 chữ số"
    }),
    customerEmail: Joi.string().email().required().messages({
        "any.required": "Email là bắt buộc",
        "string.email": "Email không hợp lệ"
    }),
    notes: Joi.string().optional().max(500)
});

export const cancelBookingSchema = Joi.object({
    reason: Joi.string().optional().max(255)
});

export const confirmBookingSchema = Joi.object().unknown(true);
export const completeBookingSchema = Joi.object().unknown(true);
