import Product from "../models/product.model";
import BoardingBooking from "../models/boarding-booking.model";
import Notification from "../models/notification.model";
import dayjs from "dayjs";
import cron from "node-cron";

/**
 * Quét các sản phẩm sắp hết hàng hoặc sắp hết hạn để tạo thông báo
 */
export const scanProductsForNotifications = async () => {
    try {
        console.log("[JOB-THÔNG BÁO] Đang quét sản phẩm để tạo thông báo...");

        // 1. Kiểm tra sản phẩm sắp hết hàng (Stock < 10)
        const lowStockProducts = await Product.find({
            deleted: false,
            status: "active",
            stock: { $lt: 10 }
        });

        for (const product of lowStockProducts) {
            // Kiểm tra xem đã có thông báo chưa đọc nào cho sản phẩm này chưa
            const existingNotif = await Notification.findOne({
                type: "system",
                "metadata.productId": product._id,
                status: "unread",
                title: { $regex: /hết hàng/i }
            });

            if (!existingNotif) {
                await Notification.create({
                    type: "system",
                    title: "Cảnh báo hết hàng",
                    content: `Sản phẩm "${product.name}" chỉ còn ${product.stock} sản phẩm trong kho.`,
                    metadata: {
                        productId: product._id,
                        currentStock: product.stock
                    }
                });
            }
        }

        // 2. Kiểm tra sản phẩm sắp hết hạn (trong vòng 30 ngày)
        const thirtyDaysFromNow = dayjs().add(30, "day").toDate();
        const nearingExpiryProducts = await Product.find({
            deleted: false,
            status: "active",
            expiryDate: { $lte: thirtyDaysFromNow, $gt: new Date() }
        });

        for (const product of nearingExpiryProducts) {
            const existingNotif = await Notification.findOne({
                type: "system",
                "metadata.productId": product._id,
                status: "unread",
                title: { $regex: /hết hạn/i }
            });

            if (!existingNotif) {
                const daysLeft = dayjs(product.expiryDate).diff(dayjs(), "day");
                await Notification.create({
                    type: "system",
                    title: "Cảnh báo hết hạn",
                    content: `Sản phẩm "${product.name}" sẽ hết hạn sau ${daysLeft} ngày (${dayjs(product.expiryDate).format("DD/MM/YYYY")}).`,
                    metadata: {
                        productId: product._id,
                        expiryDate: product.expiryDate
                    }
                });
            }
        }

        console.log("[JOB-THÔNG BÁO] Hoàn tất quét sản phẩm.");
    } catch (error) {
        console.error("[JOB-THÔNG BÁO] Lỗi khi quét sản phẩm:", error);
    }
};

/**
 * Quét các nhiệm vụ chăm sóc khách sạn bị quá giờ
 */
export const scanBoardingTasksForNotifications = async () => {
    try {
        console.log("[JOB-THÔNG BÁO] Đang quét nhiệm vụ khách sạn bị quá giờ...");
        const now = dayjs();
        const todayStr = now.format("YYYY-MM-DD");

        // Tìm các đơn đang lưu trú
        const activeBookings = await BoardingBooking.find({
            boardingStatus: "checked-in",
            deleted: false
        }).populate("petIds", "name");

        for (const booking of activeBookings) {
            const petNames = (booking as any).petIds?.map((p: any) => p.name).join(", ") || "Thú cưng";

            // Xác định thời gian check-in/out thực tế (ưu tiên actual nếu có)
            const checkIn = dayjs((booking as any).actualCheckInDate || booking.checkInDate);
            const checkOut = dayjs((booking as any).actualCheckOutDate || booking.checkOutDate);

            const isFirstDay = now.isSame(checkIn, 'day');
            const isLastDay = now.isSame(checkOut, 'day');

            const checkInTimeStr = checkIn.format("HH:mm");
            const checkOutTimeStr = checkOut.format("HH:mm");

            // 1. Kiểm tra lịch ăn
            for (const item of (booking.feedingSchedule || [])) {
                if (item.status === "pending" && item.time) {
                    const taskTimeStr = item.time;

                    // Bỏ qua nếu việc này nằm ngoài khung giờ check-in/out của ngày đầu/cuối
                    if (isFirstDay && taskTimeStr < checkInTimeStr) continue;
                    if (isLastDay && taskTimeStr > checkOutTimeStr) continue;

                    const taskTime = dayjs(`${todayStr} ${taskTimeStr}`);
                    // Nếu quá giờ 15 phút
                    if (now.diff(taskTime, "minute") >= 15) {
                        const existing = await Notification.findOne({
                            type: "boarding",
                            "metadata.bookingId": booking._id,
                            "metadata.taskId": item._id,
                            createdAt: { $gte: dayjs().startOf("day").toDate() }
                        });

                        if (!existing) {
                            await Notification.create({
                                title: "Cảnh báo trễ giờ cho ăn",
                                content: `Nhiệm vụ cho "${petNames}" lúc ${item.time} đã quá giờ 15 phút nhưng chưa thực hiện!`,
                                type: "boarding",
                                receiverId: item.staffId || undefined,
                                metadata: {
                                    bookingId: booking._id,
                                    taskId: item._id,
                                    time: item.time,
                                    type: "feeding"
                                }
                            });
                        }
                    }
                }
            }

            // 2. Kiểm tra lịch vận động
            for (const item of (booking.exerciseSchedule || [])) {
                if (item.status === "pending" && item.time) {
                    const taskTimeStr = item.time;

                    // Bỏ qua nếu việc này nằm ngoài khung giờ check-in/out của ngày đầu/cuối
                    if (isFirstDay && taskTimeStr < checkInTimeStr) continue;
                    if (isLastDay && taskTimeStr > checkOutTimeStr) continue;

                    const taskTime = dayjs(`${todayStr} ${taskTimeStr}`);
                    // Nếu quá giờ 15 phút
                    if (now.diff(taskTime, "minute") >= 15) {
                        const existing = await Notification.findOne({
                            type: "boarding",
                            "metadata.bookingId": booking._id,
                            "metadata.taskId": item._id,
                            createdAt: { $gte: dayjs().startOf("day").toDate() }
                        });

                        if (!existing) {
                            await Notification.create({
                                title: "Cảnh báo trễ giờ vận động",
                                content: `Nhiệm vụ vận động cho "${petNames}" lúc ${item.time} đã quá giờ 15 phút nhưng chưa thực hiện!`,
                                type: "boarding",
                                receiverId: item.staffId || undefined,
                                metadata: {
                                    bookingId: booking._id,
                                    taskId: item._id,
                                    time: item.time,
                                    type: "exercise"
                                }
                            });
                        }
                    }
                }
            }
        }
        console.log("[JOB-THÔNG BÁO] Hoàn tất quét nhiệm vụ khách sạn.");
    } catch (error) {
        console.error("[JOB-THÔNG BÁO] Lỗi khi quét nhiệm vụ khách sạn:", error);
    }
};

export const startNotificationTask = () => {
    // Quét sản phẩm: 0:00 mỗi ngày
    cron.schedule('0 0 * * *', async () => {
        await scanProductsForNotifications();
    });

    // Quét nhiệm vụ khách sạn: Mỗi 15 phút
    cron.schedule('*/15 * * * *', async () => {
        await scanBoardingTasksForNotifications();
    });

    // Chạy ngay lần đầu khi start server (để test/khởi động)
    scanProductsForNotifications();
    scanBoardingTasksForNotifications();
};
