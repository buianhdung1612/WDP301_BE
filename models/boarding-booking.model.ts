import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        boardingBookingCode: String, // Mã lịch lưu trú (VD: BRD20250123001)
        userId: String, // ID chủ thú cưng
        petIds: [String], // Danh sách ID thú cưng
        cageId: String, // ID chuồng/phòng
        
        customerName: String,
        customerPhone: String,
        customerEmail: String,
        
        checkInDate: Date, // Ngày nhận
        checkOutDate: Date, // Ngày trả
        numberOfDays: Number, // Số ngày lưu trú
        
        // Giá cả
        pricePerDay: Number, // Giá mỗi ngày
        totalDays: Number, // Tổng ngày
        basePrice: Number, // Giá gốc
        discountAmount: {
            type: Number,
            default: 0
        },
        appliedCoupon: String,
        totalPrice: Number, // Giá tổng cộng
        
        paymentStatus: {
            type: String,
            enum: ["unpaid", "partial", "paid"],
            default: "unpaid"
        },
        paymentMethod: String,
        
        notes: String, // Ghi chú (dị ứng, thức ăn yêu thích, etc.)
        feedingSchedule: String, // Lịch ăn (VD: 3 bữa/ngày)
        specialCare: String, // Chăm sóc đặc biệt
        
        status: {
            type: String,
            enum: ["pending", "confirmed", "checked-in", "checked-out", "cancelled"],
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
