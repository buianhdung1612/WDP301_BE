import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        code: String, // Mã lịch lưu trú (VD: BRD20250123001) - Đồng bộ với Order
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountUser"
        }, // ID chủ thú cưng
        petIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Pet"
        }], // Danh sách ID thú cưng
        cageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BoardingCage"
        }, // ID chuồng/phòng

        checkInDate: Date, // Ngày nhận dự kiến
        checkOutDate: Date, // Ngày trả dự kiến
        numberOfDays: Number, // Số ngày lưu trú

        // Giá cả - Đồng bộ với Order
        pricePerDay: Number, // Giá mỗi ngày
        subTotal: Number, // Tạm tính (pricePerDay * numberOfDays)
        coupon: String, // Mã giảm giá
        discount: {
            type: Number,
            default: 0
        }, // Số tiền giảm
        total: Number, // Tổng phải thanh toán thực tế

        paymentMethod: {
            type: String,
            enum: ["money", "vnpay", "zalopay"],
            default: "money"
        },
        paymentStatus: {
            type: String,
            enum: ["unpaid", "paid", "refunded"],
            default: "unpaid"
        },
        paymentMethod: String,
        paymentGateway: String,
        holdExpiresAt: Date,

        notes: String, // Ghi chú (dị ứng, thức ăn yêu thích, etc.)
        specialCare: String, // Chăm sóc đặc biệt

        // Trạng thái lưu trú - Đồng bộ cách đặt tên
        boardingStatus: {
            type: String,
            enum: ["pending", "held", "confirmed", "checked-in", "checked-out", "cancelled"],
            default: "pending"
        },

        cancelledReason: String,
        cancelledAt: Date,
        cancelledBy: String,

        actualCheckInDate: Date, // Ngày nhận thực tế
        actualCheckOutDate: Date, // Ngày trả thực tế

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

const BoardingBooking = mongoose.model("BoardingBooking", schema, "boarding-bookings");

export default BoardingBooking;
