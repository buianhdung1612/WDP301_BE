import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        serviceId: String, // Tham chiếu dịch vụ
        date: Date, // Ngày
        startTime: String, // Giờ bắt đầu (HH:mm)
        endTime: String, // Giờ kết thúc (HH:mm)
        maxCapacity: Number, // Số slot tối đa có sẵn
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
