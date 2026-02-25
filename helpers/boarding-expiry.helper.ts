import mongoose from "mongoose";
import BoardingBooking from "../models/boarding-booking.model";
import BoardingCage from "../models/boarding-cage.model";

export const runBoardingExpiryJob = async () => {
    const now = new Date();

    await BoardingBooking.updateMany(
        {
            deleted: false,
            boardingStatus: "held",
            holdExpiresAt: { $lte: now }
        },
        {
            $set: {
                boardingStatus: "cancelled",
                cancelledAt: now,
                cancelledReason: "Het thoi gian giu phong",
                cancelledBy: "system"
            }
        }
    );

    const expired = await BoardingBooking.find({
        deleted: false,
        boardingStatus: { $in: ["confirmed", "checked-in"] },
        checkOutDate: { $lt: now }
    }).select("_id cageId boardingStatus");

    if (expired.length === 0) return;

    const checkedInIds = expired
        .filter((b) => (b as any).boardingStatus === "checked-in")
        .map((b) => b._id);
    const confirmedIds = expired
        .filter((b) => (b as any).boardingStatus === "confirmed")
        .map((b) => b._id);

    if (checkedInIds.length > 0) {
        await BoardingBooking.updateMany(
            { _id: { $in: checkedInIds } },
            { $set: { boardingStatus: "checked-out", actualCheckOutDate: now } }
        );
    }

    if (confirmedIds.length > 0) {
        await BoardingBooking.updateMany(
            { _id: { $in: confirmedIds } },
            {
                $set: {
                    boardingStatus: "cancelled",
                    cancelledAt: now,
                    cancelledReason: "Hết hạn đặt",
                    cancelledBy: "system"
                }
            }
        );
    }

    const cageObjectIds = expired
        .map((b) => b.cageId)
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id as any))
        .map((id) => new mongoose.Types.ObjectId(id as any));

    if (cageObjectIds.length > 0) {
        await BoardingCage.updateMany(
            { _id: { $in: cageObjectIds } },
            { $set: { status: "available" } }
        );
    }
};
