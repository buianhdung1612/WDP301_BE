import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        group: {
            type: String,
            required: true,
            trim: true,
            // VD: "Hạt khô", "Pate / Ướt", "Thức ăn tươi", "Snack", "Đặc biệt", "Tự cung cấp"
        },
        petType: {
            type: String,
            enum: ["dog", "cat", "all"],
            default: "all",
        },
        brand: {
            type: String,
            trim: true,
            default: "",
        },
        ageGroup: {
            type: String,
            enum: ["puppy", "adult", "senior", "all"],
            default: "all",
        },
        description: {
            type: String,
            default: "",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        deleted: {
            type: Boolean,
            default: false,
        },
        deletedAt: Date,
    },
    {
        timestamps: true,
    }
);

const FoodTemplate = mongoose.model("FoodTemplate", schema, "food-templates");

export default FoodTemplate;
