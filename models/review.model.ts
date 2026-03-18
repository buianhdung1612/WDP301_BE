import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true
        },
        orderId: {
            type: String,
            required: true
        },
        orderItemId: {
            type: String,
            required: true
        },
        productId: {
            type: String,
            required: true
        },
        variant: [String],
        rating: {
            type: Number,
            min: 1,
            max: 5,
            required: true
        },
        comment: String,
        images: [String],
        isEdited: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"], // pending - Chờ duyệt, approved – Đã duyệt, rejected – Từ chối
            default: "pending"
        }
    },
    {
        timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
    }
);

schema.index(
    {
        userId: 1,
        orderItemId: 1
    },
    {
        unique: true
    }
); // Đảm bảo mỗi user chỉ đánh giá mỗi sản phẩm một lần

const Review = mongoose.model('Review', schema, "reviews");

export default Review;
