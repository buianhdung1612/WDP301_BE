import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CategoryService"
        },
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department"
        },
        name: String,
        slug: String,
        description: String,
        procedure: String, // Quy trình thực hiện (tách riêng cho rõ)
        duration: Number,
        minDuration: {
            type: Number,
            default: 0
        },
        petTypes: {
            type: [String],
            enum: ["DOG", "CAT"],
            default: ["DOG", "CAT"]
        },
        pricingType: {
            type: String,
            enum: ["fixed", "by-weight"],
            default: "fixed"
        },
        basePrice: Number, // Giá cơ bản (nếu fixed)
        priceList: [
            {
                label: String, // Ví dụ: "< 5kg", "5-10kg", "Chuồng M", "10km"
                value: Number // Giá tương ứng
            }
        ],
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },
        deleted: {
            type: Boolean,
            default: false
        },
        deletedAt: Date,
        images: [String],
        maxExtensionMinutes: {
            type: Number,
            default: 30
        },
        minAgeMonths: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true,
    }
);

const Service = mongoose.model("Service", schema, "services");

export default Service;
