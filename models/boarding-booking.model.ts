import mongoose from "mongoose";

const feedingScheduleSchema = new mongoose.Schema(
    {
        time: String,
        food: String,
        amount: String,
        note: String,
        staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin"
        },
        staffName: String,
        status: {
            type: String,
            enum: ["pending", "done", "skipped"],
            default: "pending"
        },
        doneAt: Date
    },
    { _id: true }
);

const exerciseScheduleSchema = new mongoose.Schema(
    {
        time: String,
        activity: String,
        durationMinutes: Number,
        note: String,
        status: {
            type: String,
            enum: ["pending", "done", "skipped"],
            default: "pending"
        },
        doneAt: Date
    },
    { _id: true }
);

const shiftChecklistSchema = new mongoose.Schema(
    {
        shift: {
            type: String,
            enum: ["morning", "afternoon", "night"],
            default: "morning"
        },
        title: String,
        note: String,
        checked: {
            type: Boolean,
            default: false
        },
        checkedAt: Date
    },
    { _id: true }
);

const schema = new mongoose.Schema(
    {
        code: String,
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountUser"
        },
        petIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Pet"
        }],
        cageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BoardingCage"
        },

        checkInDate: Date,
        checkOutDate: Date,
        numberOfDays: Number,

        fullName: String,
        phone: String,
        email: String,

        pricePerDay: Number,
        subTotal: Number,
        coupon: String,
        discount: {
            type: Number,
            default: 0
        },
        total: Number,

        paymentMethod: {
            type: String,
            enum: ["money", "vnpay", "zalopay", "pay_at_site", "prepaid"],
            default: "pay_at_site"
        },
        paymentStatus: {
            type: String,
            enum: ["unpaid", "paid", "refunded"],
            default: "unpaid"
        },
        paymentGateway: String,
        holdExpiresAt: Date,

        notes: String,
        specialCare: String,

        // Boarding care management
        feedingSchedule: [feedingScheduleSchema],
        exerciseSchedule: [exerciseScheduleSchema],
        shiftChecklist: [shiftChecklistSchema],

        boardingStatus: {
            type: String,
            enum: ["pending", "held", "confirmed", "checked-in", "checked-out", "cancelled"],
            default: "pending"
        },

        cancelledReason: String,
        cancelledAt: Date,
        cancelledBy: String,

        actualCheckInDate: Date,
        actualCheckOutDate: Date,

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

const BoardingBooking = mongoose.model("BoardingBooking", schema, "boarding-bookings");

export default BoardingBooking;
