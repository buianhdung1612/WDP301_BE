import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        code: String, // Mã giảm giá
        name: String, // Tên mã giảm giá
        description: String, // Mô tả giới thiệu
        typeDiscount: {
            type: String,
            enum: ["percentage", "fixed"], // Kiểu giảm giá: percentage – Phần trăm, fixed – Số tiền cố định
            default: "percentage"
        },
        value: Number, // Giá trị giảm (10%, 10000đ,...)
        minOrderValue: Number, // Giá trị đơn hàng tối thiểu để áp dụng
        maxDiscountValue: Number, // Số tiền giảm tối đa (nếu type = percentage)
        usageLimit: Number, // Giới hạn số lần được sử dụng tổng cộng
        usedCount: {
            type: Number,
            default: 0
        }, // Đếm số lần đã sử dụng
        startDate: Date, // Ngày bắt đầu hiệu lực
        endDate: Date, // Ngày hết hạn
        typeDisplay: {
            type: String,
            enum: ["public", "private"], // Kiểu hiển thị: public – Công khai, private – Riêng tư
            default: "private"
        },
        status: {
            type: String,
            enum: ["active", "inactive"], // active – Hoạt động, inactive – Tạm dừng
            default: "inactive"
        },
        search: String,
        deleted: {
            type: Boolean,
            default: false
        },
        deletedAt: Date
    },
    {
        timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
    }
);

const Coupon = mongoose.model('Coupon', schema, "coupons");

export default Coupon;