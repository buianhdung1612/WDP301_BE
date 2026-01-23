import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        bookingId: String, // Tham chiếu lịch đặt
        userId: String, // ID khách hàng
        staffId: String, // ID nhân viên phục vụ
        serviceId: String, // ID dịch vụ
        petId: String, // ID thú cưng được dịch vụ
        
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
