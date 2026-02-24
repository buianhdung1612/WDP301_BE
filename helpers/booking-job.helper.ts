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
    } catch (error) {
        console.error("Error in autoUpdateBookingStatuses job:", error);
    }
};
