import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        bookingCode: String, // Mã đặt lịch (VD: BK20250123001)
        userId: String, // ID chủ thú cưng
        serviceId: String, // ID dịch vụ
        slotId: String, // ID khung giờ
        petIds: [String], // Danh sách ID thú cưng
        customerName: String, // Tên khách hàng
        customerEmail: String,
        customerPhone: String,
        staffId: String, // ID nhân viên thực hiện (nếu có)
        notes: String, // Ghi chú từ khách hàng (yêu cầu đặc biệt)
        
        // Giá và thanh toán
        basePrice: Number, // Giá gốc
        discountAmount: {
            type: Number,
            default: 0
        }, // Số tiền giảm
        appliedCoupon: String, // Mã coupon áp dụng
        totalPrice: Number, // Giá tổng cộng
        paymentStatus: {
            type: String,
            enum: ["unpaid", "partial", "paid"],
            default: "unpaid"
        },
        paymentMethod: String, // Phương thức thanh toán
        
        // Trạng thái booking
        status: {
            type: String,
            enum: ["pending", "confirmed", "in-progress", "completed", "cancelled"],
            default: "pending"
        },
        
        // Hủy lịch
        cancelledReason: String, // Lý do hủy
        cancelledAt: Date, // Ngày hủy
        cancelledBy: String, // Người hủy (customer/staff)
        
        completedAt: Date, // Ngày hoàn thành
        
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

const Booking = mongoose.model("Booking", schema, "bookings");

export default Booking;
