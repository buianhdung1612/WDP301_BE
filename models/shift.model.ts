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
