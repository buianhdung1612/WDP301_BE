import mongoose from "mongoose";

const proofMediaSchema = new mongoose.Schema(
    {
        url: String,
        kind: {
            type: String,
            enum: ["image", "video"],
            default: "image"
        }
    },
    { _id: false }
);

const feedingScheduleSchema = new mongoose.Schema(
    {
        time: String,
        food: String,
        amount: String,
        note: String,
        proofMedia: [proofMediaSchema],
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
        petType: {
            type: String,
            enum: ["dog", "cat", "all"],
            default: "all"
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
        proofMedia: [proofMediaSchema],
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
        petType: {
            type: String,
            enum: ["dog", "cat", "all"],
            default: "all"
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
        quantity: {
            type: Number,
            default: 1,
            min: 1,
            max: 4
        },

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
        depositPercent: {
            type: Number,
            default: 0
        },
        depositAmount: {
            type: Number,
            default: 0
        },
        paidAmount: {
            type: Number,
            default: 0
        },

        paymentMethod: {
            type: String,
            enum: ["money", "vnpay", "zalopay", "pay_at_site", "prepaid"],
            default: "pay_at_site"
        },
        paymentStatus: {
            type: String,
            enum: ["unpaid", "partial", "paid", "refunded"],
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
