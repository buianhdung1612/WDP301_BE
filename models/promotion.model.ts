import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        code: String, // Mã khuyến mãi
        name: String, // Tên khuyến mãi
        description: String,

        serviceIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service"
        }], // Danh sách ID dịch vụ áp dụng (nếu trống = tất cả)

        type: {
            type: String,
            enum: ["percentage", "fixed"],
            default: "percentage"
        }, // Loại: phần trăm hoặc số tiền cố định
        value: Number, // Giá trị (10, 50000, etc.)

        maxDiscountValue: Number, // Giá trị giảm tối đa (nếu type = percentage)
        minOrderValue: Number, // Giá trị đơn hàng tối thiểu để áp dụng

        usageLimit: Number, // Giới hạn số lần sử dụng toàn cộng
        usedCount: {
            type: Number,
            default: 0
        }, // Số lần đã sử dụng
        usagePerCustomer: {
            type: Number,
            default: 1
        }, // Số lần mỗi khách được dùng

        startDate: Date, // Ngày bắt đầu
        endDate: Date, // Ngày hết hạn

        typeDisplay: {
            type: String,
            enum: ["public", "private"],
            default: "public"
        }, // Công khai hay riêng tư

        status: {
            type: String,
            enum: ["active", "inactive"],
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
        timestamps: true,
    }
);

const Promotion = mongoose.model("Promotion", schema, "promotions");

export default Promotion;
