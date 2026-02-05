import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: String, // Tên danh mục: Cắt tia lông, Tắm spa, Khách sạn, Vận chuyển, Tư vấn
        slug: String,
        description: String,
        avatar: String,
        icon: String,       // 👈 BỔ SUNG

        bookingTypes: {
            type: String,
            enum: ["HOTEL", "STANDALONE", "BOTH"]
        },
        petType: {
            type: String,
            enum: ["DOG", "CAT", "BOTH"],
            default: "BOTH"
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
