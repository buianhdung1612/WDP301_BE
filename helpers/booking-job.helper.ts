import Booking from "../models/booking.model";
import BookingConfig from "../models/booking-config.model";

export const autoUpdateBookingStatuses = async () => {
    try {
        const now = new Date();

        // Lấy cài đặt thời gian từ BookingConfig, mặc định 15p và 60p
        const config = await BookingConfig.findOne();
        const gracePeriodMinutes = config?.bookingGracePeriod ?? 15;
        const cancelPeriodMinutes = config?.bookingCancelPeriod ?? 60;
        const autoCancelEnabled = config?.autoCancelEnabled ?? false;

        const gracePeriod = gracePeriodMinutes * 60000;
        const cancelPeriod = cancelPeriodMinutes * 60000;

        // 1. Chuyển sang delayed nếu quá giờ hẹn gracePeriod mà chưa bắt đầu
        await Booking.updateMany(
            {
                bookingStatus: { $in: ["pending", "confirmed"] },
                start: { $lt: new Date(now.getTime() - gracePeriod) },
                deleted: false
            },
            { $set: { bookingStatus: "delayed" } }
        );

        // 2. Tự động hủy nếu trễ quá cancelPeriod phút (No-show)
        if (autoCancelEnabled) {
            await Booking.updateMany(
                {
                    bookingStatus: "delayed",
                    start: { $lt: new Date(now.getTime() - cancelPeriod) },
                    deleted: false
                },
                { $set: { bookingStatus: "cancelled", cancelledReason: "Khách không đến (Tự động)" } }
            );
        }

        // 3. Tự động hoàn thành nếu đang in-progress và quá maxDuration
        const inProgressBookings = await Booking.find({
            bookingStatus: "in-progress",
            deleted: false
        }).populate("serviceId");

        for (const booking of inProgressBookings) {
            const service = booking.serviceId as any;
            const maxDuration = (service?.maxDuration && service.maxDuration > 0) ? service.maxDuration : (service?.duration || 60);
            const actualStart = booking.actualStart ? new Date(booking.actualStart) : null;

            if (actualStart) {
                const deadline = new Date(actualStart.getTime() + maxDuration * 60000);
                if (now > deadline) {
                    await Booking.updateOne(
                        { _id: booking._id },
                        {
                            $set: {
                                bookingStatus: "completed",
                                completedAt: now,
                                "petStaffMap.$[elem].status": "completed",
                                "petStaffMap.$[elem].completedAt": now
                            }
                        },
                        {
                            arrayFilters: [{ "elem.status": { $ne: "completed" } }]
                        }
                    );
                }
            }
        }
    } catch (error) {
        console.error("Error in autoUpdateBookingStatuses job:", error);
    }
};
