import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        code: String,
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountUser"
        },
        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service"
        },
        petIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Pet"
        }],
        staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin"
        },
        staffIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin"
        }],
        petStaffMap: [{
            petId: { type: mongoose.Schema.Types.ObjectId, ref: "Pet" },
            staffId: { type: mongoose.Schema.Types.ObjectId, ref: "AccountAdmin" },
            status: {
                type: String,
                enum: ["pending", "in-progress", "completed"],
                default: "pending"
            },
            startedAt: Date,
            completedAt: Date,
            surchargeAmount: {
                type: Number,
                default: 0
            },
            surchargeNotes: String
        }],
        start: Date, // Thời gian bắt đầu
        end: Date, // Thời gian kết thúc
        notes: String,
        subTotal: Number,
        coupon: String,
        discount: {
            type: Number,
            default: 0
        },
        total: Number,
        paymentMethod: {
            type: String,
            enum: ["money", "vnpay", "zalopay"],
            default: "money"
        },
        paymentStatus: {
            type: String,
            enum: ["unpaid", "paid", "refunded"],
            default: "unpaid"
        },
        bookingStatus: {
            type: String,
            enum: ["pending", "confirmed", "delayed", "in-progress", "completed", "cancelled", "returned"],
            default: "pending"
        },
        actualStart: Date, // Thời điểm thực tế nhân viên bắt đầu làm
        expectedFinish: Date, // Thời điểm dự kiến xong (actualStart + duration)
        rescheduledFrom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking"
        }, // Lưu ID đơn gốc nếu khách đổi lịch
        cancelledReason: String,
        cancelledAt: Date,
        cancelledBy: String,
        completedAt: Date,
        search: String,
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

const Booking = mongoose.model("Booking", schema, "bookings");

export default Booking;
