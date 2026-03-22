import Booking from "../models/booking.model";
import BookingConfig from "../models/booking-config.model";
import Notification from "../models/notification.model";

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

        // 3. Tự động hoàn thành nếu quá maxDuration (HOẶC flagged OVERRUN)
        const inProgressBookings = await Booking.find({
            bookingStatus: "in-progress",
            deleted: false
        }).populate('serviceId');

        for (const booking of inProgressBookings) {
            const b = booking as any;
            const now = new Date();
            const service = b.serviceId as any;

            // Lấy maxDuration từ service hoặc mặc định 120p
            const maxDuration = (service?.maxDuration && service.maxDuration > 0)
                ? service.maxDuration
                : (service?.duration || 60);

            const startVal = b.actualStart || b.start;
            if (!startVal) continue;

            const startTime = new Date(startVal);
            const deadline = new Date(startTime.getTime() + maxDuration * 60 * 1000);

            // Nếu quá deadline (maxDuration), hệ thống đánh dấu Overrun
            if (now > deadline && !b.isOverrun) {
                await Booking.updateOne(
                    { _id: b._id },
                    { $set: { isOverrun: true } }
                );

                // Gửi thông báo socket & Lưu Database
                const notificationContent = `Lịch đặt ${booking.code} đã bị quá giờ!`;

                await Notification.create({
                    title: "Cảnh báo quá giờ",
                    content: notificationContent,
                    type: "overrun",
                    link: `/admin/booking/edit/${booking._id}`,
                    metadata: {
                        bookingId: booking._id,
                        bookingCode: booking.code
                    }
                });

                if ((global as any).io) {
                    (global as any).io.to('admin').emit('overrun-alert', {
                        bookingId: booking._id,
                        bookingCode: booking.code,
                        staffIds: booking.staffIds,
                        message: notificationContent
                    });
                }

                // Cập nhật expectedFinish mới để giữ slot bận (đẩy 10p)
                const newExpectedFinish = new Date(now.getTime() + 10 * 60 * 1000);
                await Booking.updateOne(
                    { _id: booking._id },
                    { $set: { expectedFinish: newExpectedFinish } }
                );

                console.log(`[JOB] Flagged Overrun for booking ${booking.code}`);
            }
        }
    } catch (error) {
        console.error("Error in autoUpdateBookingStatuses job:", error);
    }
};
