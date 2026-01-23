import express, { Request, Response } from "express";
import Booking from "../../models/booking.model";
import TimeSlot from "../../models/time-slot.model";
import Service from "../../models/service.model";
import Pet from "../../models/pet.model";

// [GET] /api/v1/client/bookings
export const listMyBookings = async (req: Request, res: Response) => {
    try {
        const userId = req.query.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status as string;

        let filter: any = { deleted: false, userId };
        if (status) {
            filter.status = status;
        }

        const bookings = await Booking.find(filter)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Booking.countDocuments(filter);

        res.json({
            code: 200,
            message: "Danh sách lịch đặt của tôi",
            data: bookings,
            pagination: {
                currentPage: page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách lịch đặt"
        });
    }
};

// [GET] /api/v1/client/bookings/:id
export const getMyBooking = async (req: Request, res: Response) => {
    try {
        const userId = req.query.userId;
        const booking = await Booking.findById(req.params.id);

        if (!booking || booking.deleted || booking.userId !== userId) {
            return res.status(404).json({
                code: 404,
                message: "Lịch đặt không tồn tại"
            });
        }

        res.json({
            code: 200,
            message: "Chi tiết lịch đặt",
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy chi tiết lịch đặt"
        });
    }
};

// [POST] /api/v1/client/bookings
export const createBooking = async (req: Request, res: Response) => {
    try {
        const { serviceId, slotId, petIds, customerName, customerPhone, customerEmail, notes } = req.body;
        const userId = req.query.userId;

        // Validate service
        const service = await Service.findById(serviceId);
        if (!service || service.deleted || service.status === "inactive") {
            return res.status(400).json({
                code: 400,
                message: "Dịch vụ không tồn tại"
            });
        }

        // Validate slot
        const slot = await TimeSlot.findById(slotId);
        if (!slot || slot.deleted || slot.status === "unavailable") {
            return res.status(400).json({
                code: 400,
                message: "Khung giờ không khả dụng"
            });
        }

        if (slot.maxCapacity && slot.currentBookings >= slot.maxCapacity) {
            return res.status(400).json({
                code: 400,
                message: "Khung giờ này đã đầy"
            });
        }

        // Validate pets
        if (!petIds || petIds.length === 0) {
            return res.status(400).json({
                code: 400,
                message: "Vui lòng chọn thú cưng"
            });
        }

        const pets = await Pet.find({ _id: { $in: petIds }, deleted: false });
        if (pets.length !== petIds.length) {
            return res.status(400).json({
                code: 400,
                message: "Một hoặc nhiều thú cưng không tồn tại"
            });
        }

        // Generate booking code
        const bookingCode = `BK${Date.now()}`;

        // Calculate price
        let totalPrice = 0;
        if (service.pricingType === "fixed") {
            totalPrice = (service.basePrice || 0) * petIds.length;
        } else if (service.pricingType === "by-weight") {
            // Calculate based on pet weights
            for (const pet of pets) {
                const priceItem = service.priceList?.find((item: any) => {
                    const [min, max] = item.label.split("-").map((x: string) => parseInt(x));
                    if (max) return pet.weight! >= min && pet.weight! < max;
                    return pet.weight! >= min;
                });
                totalPrice += priceItem?.value || 0;
            }
        }

        const newBooking = new Booking({
            bookingCode,
            userId,
            serviceId,
            slotId,
            petIds,
            customerName,
            customerPhone,
            customerEmail,
            notes,
            basePrice: totalPrice,
            totalPrice,
            status: "pending",
            paymentStatus: "unpaid"
        });

        await newBooking.save();

        // Update slot
        slot.currentBookings += 1;
        if (slot.maxCapacity && slot.currentBookings >= slot.maxCapacity) {
            slot.status = "full";
        }
        await slot.save();

        res.status(201).json({
            code: 201,
            message: "Tạo lịch đặt thành công",
            data: newBooking
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi tạo lịch đặt",
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// [PATCH] /api/v1/client/bookings/:id/cancel
export const cancelMyBooking = async (req: Request, res: Response) => {
    try {
        const userId = req.query.userId;
        const { reason } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking || booking.deleted || booking.userId !== userId) {
            return res.status(404).json({
                code: 404,
                message: "Lịch đặt không tồn tại"
            });
        }

        if (["completed", "cancelled"].includes(booking.status)) {
            return res.status(400).json({
                code: 400,
                message: "Không thể hủy lịch đặt này"
            });
        }

        booking.status = "cancelled";
        booking.cancelledReason = reason || "Khách hàng hủy";
        booking.cancelledAt = new Date();
        booking.cancelledBy = "customer";

        // Update slot
        if (booking.slotId) {
            const slot = await TimeSlot.findById(booking.slotId);
            if (slot && slot.currentBookings > 0) {
                slot.currentBookings -= 1;
                if (slot.maxCapacity && slot.currentBookings < slot.maxCapacity) {
                    slot.status = "available";
                }
                await slot.save();
            }
        }

        await booking.save();

        res.json({
            code: 200,
            message: "Hủy lịch đặt thành công",
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi hủy lịch đặt"
        });
    }
};
