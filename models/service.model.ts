import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CategoryService"
        },
        name: String,
        slug: String,
        description: String,
        duration: Number,
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
        commissionRate: {
            type: Number,
            default: 0
        }, // % hoa hồng cho nhân viên thực hiện (0-100)
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
        minDuration: {
            type: Number,
            default: 0
        },
        maxDuration: {
            type: Number,
            default: 0
        },
        surchargeType: {
            type: String,
            enum: ["none", "fixed", "per-minute"],
            default: "none"
        },
        surchargeValue: {
            type: Number,
            default: 0
        },
        images: [String]
    },
    {
        timestamps: true,
    }
);

const Service = mongoose.model("Service", schema, "services");

export default Service;
