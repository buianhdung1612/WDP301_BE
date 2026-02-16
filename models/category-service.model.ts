import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CategoryService",
            default: null
        },
        name: String, // Tên danh mục: Cắt tia lông, Tắm spa, Khách sạn, Vận chuyển, Tư vấn
        slug: String,
        description: String,
        avatar: String,
        bookingTypes: {
            type: String,
            enum: ["HOTEL", "STANDALONE", "BOTH"]
        },
        petTypes: {
            type: [String],
            enum: ["DOG", "CAT"],
            default: ["DOG", "CAT"]
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },
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

const CategoryService = mongoose.model("CategoryService", schema, "categories-service");

export default CategoryService;
