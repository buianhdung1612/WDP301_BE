import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        }, // "Ca Sáng", "Ca Chiều", "Ca Tối"
        startTime: {
            type: String,
            required: true
        }, // "08:00"
        endTime: {
            type: String,
            required: true
        }, // "12:00"
        salaryMultiplier: {
            type: Number,
            default: 1.0
        }, // 1.0 (thường), 1.5 (ca đêm), 2.0 (lễ)
        status: {
            type: String,
            default: "active"
        }, // "active", "inactive"
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department"
        },
    },
    {
        timestamps: true,
    }
);

const Shift = mongoose.model("Shift", schema, "shifts");

export default Shift;
