import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        checkInTime: {
            type: String,
            default: "14:00"
        },
        checkOutTime: {
            type: String,
            default: "12:00"
        },
        lateCheckOutGracePeriod: {
            type: Number,
            default: 30 // minutes before applying surcharge
        },
        surchargeHalfDayPrice: {
            type: Number,
            default: 100000
        },
        surchargeFullDayPrice: {
            type: Number,
            default: 200000
        },
        depositPercentage: {
            type: Number,
            default: 20
        },
        minDaysForDeposit: {
            type: Number,
            default: 2
        },
        autoCancelHeldHours: {
            type: Number,
            default: 2 // cancel if not paid within 2 hours for 'held' status
        },
        bookingCancellationPeriod: {
            type: Number,
            default: 24 // hours before check-in for partial refund
        },
        refundPercentage: {
            type: Number,
            default: 80
        },
        maxCagesPerStaff: {
            type: Number,
            default: 10
        }
    },
    {
        timestamps: true,
    }
);

const BoardingConfig = mongoose.model('BoardingConfig', schema, "boarding-configs");

export default BoardingConfig;
