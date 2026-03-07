import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking"
        }, // Tham chiếu lịch đặt
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountUser"
        }, // ID khách hàng
        staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin"
        }, // ID nhân viên phục vụ
        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service"
        }, // ID dịch vụ
        petId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Pet"
        }, // ID thú cưng được dịch vụ

        rating: {
            type: Number,
            min: 1,
            max: 5,
            required: true
        }, // Điểm đánh giá chung
        comment: String, // Bình luận
        photos: [String], // Ảnh review (nếu có)

        // Đánh giá chi tiết
        cleanlinessRating: Number, // Đánh giá vệ sinh
        staffBehaviorRating: Number, // Đánh giá thái độ nhân viên
        petCareRating: Number, // Đánh giá chăm sóc pet

        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },
        rejectionReason: String, // Lý do từ chối nếu có

        helpful: {
            type: Number,
            default: 0
        }, // Số người vote hữu ích

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

const BookingReview = mongoose.model("BookingReview", schema, "booking-reviews");

export default BookingReview;
