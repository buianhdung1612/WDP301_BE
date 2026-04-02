import Booking from "../models/booking.model";
import BookingConfig from "../models/booking-config.model";
import Notification from "../models/notification.model";
import cron from "node-cron";
import dayjs from "dayjs";
import { cascadeStaffDelay } from "../helpers/booking-assignment.helper";

export const autoUpdateBookingStatuses = async () => {
    try {
        const now = new Date();
        const todayStart = dayjs().startOf('day').toDate();

        // Lấy cài đặt thời gian từ BookingConfig, mặc định 15p và 60p
        const config = await BookingConfig.findOne();
        const gracePeriodMinutes = config?.bookingGracePeriod ?? 15;
        const cancelPeriodMinutes = config?.bookingCancelPeriod ?? 60;
        const autoCancelEnabled = config?.autoCancelEnabled ?? false;

        const gracePeriod = gracePeriodMinutes * 60000;
        const cancelPeriod = cancelPeriodMinutes * 60000;

        // 0. Dọn dẹp các lịch từ hôm qua trở về trước (Past Day Cleanup)
        // Bất kỳ đơn nào có ngày hẹn trước hôm nay mà chưa hoàn quản/hủy thì hủy hết
        const pastDayResult = await Booking.updateMany(
            {
                start: { $lt: todayStart },
                bookingStatus: { $in: ["pending", "confirmed", "delayed", "in-progress", "returned"] },
                deleted: false
            },
            {
                $set: {
                    bookingStatus: "cancelled",
                    cancelledReason: "Hệ thống tự động dọn dẹp (Lịch cũ chưa hoàn tất)",
                    cancelledAt: now,
                    cancelledBy: "system"
                }
            }
        );

        if (pastDayResult.modifiedCount > 0) {
            console.log(`[JOB-DỊCH VỤ] Đã tự động hủy ${pastDayResult.modifiedCount} lịch đặt cũ từ những ngày trước.`);
        }

        // 1. Chuyển sang delayed nếu quá giờ hẹn gracePeriod mà chưa bắt đầu
        const overGraceBookings = await Booking.find({
            bookingStatus: { $in: ["pending", "confirmed"] },
            start: { $lt: new Date(now.getTime() - gracePeriod) },
            deleted: false
        });

        for (const booking of overGraceBookings) {
            await Booking.updateOne({ _id: booking._id }, { $set: { bookingStatus: "delayed" } });

            // Thông báo cho Admin để gọi xác nhận
            await Notification.create({
                title: "Khách trễ hẹn",
                content: `Lịch đặt ${booking.code} đã trễ hơn ${gracePeriodMinutes} phút. Vui lòng liên hệ xác nhận!`,
                type: "delayed",
                link: `/admin/booking/detail/${booking._id}`
            });

            console.log(`[JOB-DỊCH VỤ] Đã chuyển đơn ${booking.code} sang trạng thái TRỄ.`);
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

            // Lấy deadline mặc định là thời lượng dịch vụ
            const baseDuration = service?.duration || 60;
            const startVal = b.actualStart || b.start;
            if (!startVal) continue;

            const startTime = new Date(startVal);
            const deadline = new Date(startTime.getTime() + baseDuration * 60 * 1000);

            // Nếu quá deadline (maxDuration), hệ thống đánh dấu Overrun và TỰ GIA HẠN LÊN MỨC TỐI ĐA TRONG 1 LẦN
            if (now > deadline && !b.isOverrun) {
                const maxExtension = service?.maxExtensionMinutes || 30;

                // 1. Tự động lùi lịch cho các đơn tiếp theo (Cascading) theo mức tối đa
                const oldFinish = b.expectedFinish || b.end || deadline;
                const rawStaffIds = (b.petStaffMap || []).map((m: any) => m.staffId?.toString()).filter(Boolean);
                const uniqueStaffIds = Array.from(new Set(rawStaffIds)) as string[];
                let allAffectedCodes: string[] = [];

                for (const staffId of uniqueStaffIds) {
                    const codes = await cascadeStaffDelay(staffId, maxExtension, oldFinish);
                    allAffectedCodes = [...new Set([...allAffectedCodes, ...codes])];
                }

                // 2. Cập nhật mốc dự kiến mới cho đơn hiện tại (+ maxExtension)
                const newExpectedFinish = dayjs(oldFinish).add(maxExtension, 'minute').toDate();
                await Booking.updateOne(
                    { _id: b._id },
                    {
                        $set: {
                            isOverrun: true,
                            expectedFinish: newExpectedFinish,
                            end: newExpectedFinish
                        }
                    }
                );

                // 3. Gửi thông báo cho Admin
                let notificationContent = `Lịch đặt ${b.code} đã bắt đầu quá giờ (${maxExtension}p)!`;
                if (allAffectedCodes.length > 0) {
                    notificationContent += ` Đã lùi lịch cho ${allAffectedCodes.length} đơn tiếp theo: ${allAffectedCodes.join(", ")}`;
                }

                await Notification.create({
                    title: "Cảnh báo quá giờ (Gia hạn tối đa)",
                    content: notificationContent,
                    type: "overrun",
                    link: `/admin/booking/detail/${b._id}`
                });

                console.log(`[JOB-DỊCH VỤ] Đã tự gia hạn tối đa ${maxExtension}p cho đơn ${b.code} (Ảnh hưởng ${allAffectedCodes.length} lịch)`);
            }
        }
    } catch (error) {
        console.error("[JOB-DỊCH VỤ] Lỗi khi cập nhật trạng thái tự động:", error);
    }
};

export const startBookingTask = () => {
    // Chạy mỗi 10 phút để cập nhật trạng thái lịch đặt và dọn dẹp
    cron.schedule('*/10 * * * *', async () => {
        console.log(`[JOB-DỊCH VỤ] Đang quét cập nhật trạng thái lịch đặt... (${new Date().toLocaleTimeString()})`);
        await autoUpdateBookingStatuses();
    });

    // Chạy ngay lần đầu khi khởi động server
    autoUpdateBookingStatuses();
    console.log("[JOB-DỊCH VỤ] Đã lên lịch quét 10 phút/lần");
};
