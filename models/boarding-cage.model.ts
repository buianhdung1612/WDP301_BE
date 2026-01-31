import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        cageCode: String, // Mã chuồng/phòng (VD: M01, L02, VIP_A01)
        type: {
            type: String,
            enum: ["standard", "vip"],
            default: "standard"
        }, // Loại chuồng
        size: {
            type: String,
            enum: ["M", "L", "XL", "C", "B", "A"], // M, L, XL cho standard; C, B, A cho VIP
            required: true
        },

        maxWeightCapacity: Number, // Cân nặng tối đa chó có thể ở (kg)
        dailyPrice: Number, // Giá mỗi ngày
        amenities: [String], // Tiện nghi (bed, toys, air conditioning, etc.)       
        status: {
            type: String,
            enum: ["available", "occupied", "maintenance"],
            default: "available"
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

const BoardingCage = mongoose.model("BoardingCage", schema, "boarding-cages");

export default BoardingCage;
