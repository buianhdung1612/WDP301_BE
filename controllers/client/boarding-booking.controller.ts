import BoardingBooking from "../../models/boarding-booking.model";
import BoardingCage from "../../models/boarding-cage.model";
import { Request, Response } from "express";
import mongoose from "mongoose";

/**
 * Create boarding booking
 */
export const createBoardingBooking = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            cageId,
            checkInDate,
            checkOutDate,
            pricePerDay,
            discountAmount = 0
        } = req.body;

        // 1️⃣ Validate cageId
        if (!mongoose.Types.ObjectId.isValid(cageId)) {
            return res.status(400).json({ message: "Invalid cageId" });
        }

        if (!checkInDate || !checkOutDate) {
            return res.status(400).json({ message: "Missing check-in or check-out date" });
        }

        // 2️⃣ Check cage available (lock bằng session)
        const cage = await BoardingCage.findOne(
            {
                _id: cageId,
                deleted: false,
                status: "available"
            },
            null,
            { session }
        );

        if (!cage) {
            return res.status(400).json({ message: "Cage is not available" });
        }

        // 3️⃣ Tính số ngày
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const totalDays = Math.ceil(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (totalDays <= 0) {
            return res.status(400).json({ message: "Invalid date range" });
        }

        // 4️⃣ Tính giá
        const basePrice = pricePerDay * totalDays;
        const totalPrice = Math.max(basePrice - discountAmount, 0);

        // 5️⃣ Booking code
        const bookingCode = `BRD${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;

        // 6️⃣ Create booking
        const booking = await BoardingBooking.create(
            [
                {
                    ...req.body,
                    boardingBookingCode: bookingCode,
                    numberOfDays: totalDays,
                    totalDays,
                    basePrice,
                    totalPrice,
                    status: "confirmed"
                }
            ],
            { session }
        );

        // 7️⃣ Update cage → occupied
        await BoardingCage.findByIdAndUpdate(
            cageId,
            { status: "occupied" },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            message: "Boarding booking created successfully",
            data: booking[0]
        });
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();

        res.status(500).json({ message: error.message });
    }
};
export const checkInBoarding = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        const booking = await BoardingBooking.findById(id).session(session);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        if (booking.status !== "confirmed") {
            return res.status(400).json({ message: "Booking is not ready for check-in" });
        }

        // Update booking
        booking.status = "checked-in";
        booking.actualCheckInDate = new Date();
        await booking.save({ session });

        // Update cage
        await BoardingCage.findByIdAndUpdate(
            booking.cageId,
            { status: "occupied" },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        res.json({ message: "Check-in successful", data: booking });
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};
export const checkOutBoarding = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        const booking = await BoardingBooking.findById(id).session(session);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        if (booking.status !== "checked-in") {
            return res.status(400).json({ message: "Booking is not checked-in" });
        }

        booking.status = "checked-out";
        booking.actualCheckOutDate = new Date();
        await booking.save({ session });

        // Release cage
        await BoardingCage.findByIdAndUpdate(
            booking.cageId,
            { status: "available" },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        res.json({ message: "Check-out successful", data: booking });
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};
export const cancelBoardingBooking = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
        const booking = await BoardingBooking.findById(id);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        if (booking.status === "checked-in" || booking.status === "checked-out") {
            return res.status(400).json({ message: "Cannot cancel after check-in" });
        }

        // 🔑 LƯU LẠI status cũ
        const previousStatus = booking.status;

        // 🔄 Update status
        booking.status = "cancelled";
        booking.cancelledAt = new Date();

        await booking.save();

        // ✅ Nếu trước đó là confirmed → trả chuồng
        if (previousStatus === "confirmed") {
            await BoardingCage.findByIdAndUpdate(booking.cageId, {
                status: "available",
            });
        }

        return res.json({ message: "Booking cancelled successfully" });

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
export const listMyBoardingBookings = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id; // nếu có auth middleware

        const bookings = await BoardingBooking.find({
            userId,
            deleted: false,
        }).sort({ createdAt: -1 });

        res.json(bookings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
