import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin",
            required: true
        },
        shiftId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Shift",
            required: true
        },
        date: {
            type: Date,
            required: true
        }, // Ngày làm việc
        status: {
            type: String,
            enum: ["scheduled", "checked-in", "checked-out", "absent", "on-leave"],
            default: "scheduled"
        },
        checkInTime: Date,
        checkOutTime: Date,
        actualWorkHours: {
            type: Number,
            default: 0
        }, // Số giờ làm thực tế
        notes: String,
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin"
        }, // Ai tạo lịch
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department"
        }, // Ca này thuộc phòng ban nào (để dễ quản lý, lọc lịch)
    },
    {
        timestamps: true,
    }
);

// Index để query nhanh
schema.index({ staffId: 1, date: 1 });
schema.index({ shiftId: 1, date: 1 });
schema.index({ date: 1, status: 1 });

const WorkSchedule = mongoose.model("WorkSchedule", schema, "work-schedules");

export default WorkSchedule;
