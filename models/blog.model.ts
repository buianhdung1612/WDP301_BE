import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: String,
        slug: String,
        category: [String],
        avatar: String,
        description: String,
        content: String,
        status: {
            type: String,
            enum: ["draft", "published", "archived"], // draft – Bản nháp, published – Đã xuất bản, archived – Đã lưu trữ
            default: "draft"
        },
        view: {
            type: Number,
            default: 0
        },
        search: String,
        publishAt: Date,
        deleted: {
            type: Boolean,
            default: false
        },
        deletedAt: Date,
        createdBy: String,
        updatedBy: String
    },
    {
        timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
    }
);

const Blog = mongoose.model('Blog', schema, "blogs");

export default Blog;