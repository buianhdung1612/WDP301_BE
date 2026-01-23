import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        userId: String, // ID chủ sở hữu
        name: String, // Tên thú cưng
        type: {
            type: String,
            enum: ["dog", "cat"],
            default: "dog"
        },
        breed: String, // Giống (Poodle, Corgi, Mèo Anh, etc.)
        weight: Number, // Cân nặng (kg) - quan trọng cho tính giá
        age: Number, // Tuổi
        color: String, // Màu lông
        avatar: String, // Ảnh thú cưng
        healthStatus: {
            type: String,
            enum: ["healthy", "sick", "vaccination-pending"],
            default: "healthy"
        },
        notes: String, // Ghi chú đặc biệt (dị ứng, hành vi, vv)
        vaccineStatus: {
            lastVaccinedDate: Date,
            expiryDate: Date
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

const Pet = mongoose.model("Pet", schema, "pets");

export default Pet;
