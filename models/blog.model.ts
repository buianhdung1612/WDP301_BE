import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: String,
        slug: String,
        category: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "CategoryBlog"
        }],
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
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin"
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin"
        }
    },
    {
        timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
    }
);

const Blog = mongoose.model('Blog', schema, "blogs");

export default Blog;