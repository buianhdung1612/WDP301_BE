import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        categoryId: String, // Tham chiếu danh mục dịch vụ
        name: String, // Tên dịch vụ
        slug: String,
        description: String,
        duration: Number, // Thời gian thực hiện (phút)
        petType: [String], // Loại pet ["dog", "cat"]
        pricingType: {
            type: String,
            enum: ["fixed", "by-weight", "by-cage", "by-distance"],
            default: "fixed"
        }, // Cách tính giá
        basePrice: Number, // Giá cơ bản (nếu fixed)
        priceList: [
            {
                // Dùng khi pricingType khác fixed
                label: String, // Ví dụ: "< 5kg", "5-10kg", "Chuồng M", "10km"
                value: Number // Giá tương ứng
            }
        ],
        minOrderValue: Number, // Giá trị đơn hàng tối thiểu
        maxCapacity: Number, // Sức chứa tối đa pet/lần (ví dụ: 2 cho grooming)
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

const Service = mongoose.model("Service", schema, "services");

export default Service;
