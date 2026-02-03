import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        serviceId: String, // Tham chiếu dịch vụ (nếu slot này đặc thù cho 1 dịch vụ)
        date: Date, // Ngày áp dụng
        startTime: String, // "08:00"
        endTime: String, // "09:00"
        maxCapacity: {
            type: Number,
            default: 1
        }, // Tổng số nhân viên/chỗ có sẵn trong khung giờ này
        currentBookings: {
            type: Number,
            default: 0
        }, // Số lượng đã được đặt
        staffIds: [String], // Danh sách ID nhân viên làm việc trong khung giờ này (nếu chia cụ thể)
        status: {
            type: String,
            enum: ["available", "full", "unavailable"],
            default: "available"
        },
        notes: String,
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
