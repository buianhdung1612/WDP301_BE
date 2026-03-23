import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            // VD: "Dắt bộ sân trong", "Chơi bóng", "Leo trèo cột cào"
        },
        petType: {
            type: String,
            enum: ["dog", "cat", "all"],
            default: "all",
        },
        durationMinutes: {
            type: Number,
            default: 30,
            min: 0,
        },
        intensity: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "low",
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

const ExerciseTemplate = mongoose.model("ExerciseTemplate", schema, "exercise-templates");

export default ExerciseTemplate;
