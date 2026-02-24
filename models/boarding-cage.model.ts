import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        cageCode: String, // Cage code (e.g., M01, L02, VIP_A01)
        type: {
            type: String,
            enum: ["standard", "vip"],
            default: "standard"
        },
        size: {
            type: String,
            enum: ["M", "L", "XL", "C", "B", "A"],
            required: true
        },
        
        maxWeightCapacity: Number, // Max weight (kg)
        dailyPrice: Number, // Daily price
        avatar: String, // Cage image
        description: String, // Cage description
        amenities: [String], // Amenities (bed, toys, air conditioning, etc.)
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
