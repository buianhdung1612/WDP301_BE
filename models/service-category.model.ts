import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: String, // Tên danh mục: Cắt tia lông, Tắm spa, Khách sạn, Vận chuyển, Tư vấn
        slug: String,
        description: String,
        icon: String, // Icon của danh mục
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

const ServiceCategory = mongoose.model("ServiceCategory", schema, "services-category");

export default ServiceCategory;
