import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        serviceId: String, // Tham chiếu dịch vụ
        date: Date, // Ngày
        startTime: String,
        endTime: String,
        currentBookings: {
            type: Number,
            default: 0
        }, // Số lượng đã đặt
        staffId: String, // ID nhân viên (nếu có)
        status: {
            type: String,
            enum: ["available", "full", "unavailable"],
            default: "available"
        },
        maxCapacity: {
    type: Number,
    default: 1
},

        notes: String, // Ghi chú
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

const TimeSlot = mongoose.model("TimeSlot", schema, "time-slots");

export default TimeSlot;
