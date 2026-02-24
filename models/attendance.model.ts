import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin",
            required: true
        },
        month: {
            type: Number,
            required: true,
            min: 1,
            max: 12
        },
        year: {
            type: Number,
            required: true
        },
        totalWorkDays: {
            type: Number,
            default: 0
        },
        totalWorkHours: {
            type: Number,
            default: 0
        },
        totalOvertimeHours: {
            type: Number,
            default: 0
        },
        totalAbsentDays: {
            type: Number,
            default: 0
        },
        totalLeaveDays: {
            type: Number,
            default: 0
        },
        baseSalary: {
            type: Number,
            default: 0
        },
        overtimePay: {
            type: Number,
            default: 0
        },
        bonuses: {
            type: Number,
            default: 0
        },
        deductions: {
            type: Number,
            default: 0
        },
        totalSalary: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ["draft", "approved", "paid"],
            default: "draft"
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin"
        },
        approvedAt: Date,
        paidAt: Date,
        notes: String,
    },
    {
        timestamps: true,
    }
);

// Index unique cho mỗi staff mỗi tháng chỉ có 1 bảng công
schema.index({ staffId: 1, month: 1, year: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", schema, "attendances");

export default Attendance;
