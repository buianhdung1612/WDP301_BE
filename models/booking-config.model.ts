import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        bookingGracePeriod: {
            type: Number,
            default: 15 // minutes
        },
        bookingCancelPeriod: {
            type: Number,
            default: 60 // minutes
        },
        allowEarlyStartMinutes: {
            type: Number,
            default: 30 // minutes
        },
        autoCancelEnabled: {
            type: Boolean,
            default: false
        },
        autoConfirmEnabled: {
            type: Boolean,
            default: false
        },
        depositPercentage: {
            type: Number,
            default: 0
        },
        serviceRoomCount: {
            type: Number,
            default: 1
        },
        staffingRules: [
            {
                shiftId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Shift"
                },
                roleRequirements: [
                    {
                        roleId: {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "Role"
                        },
                        minStaff: {
                            type: Number,
                            default: 1
                        }
                    }
                ]
            }
        ]
    },
    {
        timestamps: true,
    }
);

const BookingConfig = mongoose.model('BookingConfig', schema, "booking-configs");

export default BookingConfig;
