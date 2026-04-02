import cron from 'node-cron';
import Order from '../models/order.model';
import Booking from '../models/booking.model';
import Product from '../models/product.model';
import BookingConfig from '../models/booking-config.model';

export const startCancellationTask = () => {
    // Chạy mỗi phút một lần
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();

            // 1. Tìm các ĐƠN HÀNG hết hạn thanh toán
            const expiredOrders = await Order.find({
                paymentStatus: "unpaid",
                paymentExpireAt: { $lt: now },
                orderStatus: "pending",
                deleted: false
            });

            for (const order of expiredOrders) {
                await Order.updateOne({ _id: order._id }, { orderStatus: "cancelled" });
                for (const item of order.items) {
                    const productDetail: any = await Product.findOne({ _id: item.productId, deleted: false });
                    if (productDetail) {
                        if (item.variant && item.variant.length > 0) {
                            const updatedVariants = [...(productDetail.variants || [])];
                            const variantMatchedIndex = updatedVariants.findIndex((v: any) => {
                                if (!v.attributeValue || v.attributeValue.length !== item.variant.length) return false;
                                return v.attributeValue.every((av: any) => item.variant.some((label: string) => label.includes(av.value)));
                            });
                            if (variantMatchedIndex !== -1) {
                                updatedVariants[variantMatchedIndex].stock += item.quantity;
                                await Product.updateOne({ _id: item.productId }, { variants: updatedVariants });
                            } else {
                                await Product.updateOne({ _id: item.productId }, { $inc: { stock: (item.quantity || 0) } });
                            }
                        } else {
                            await Product.updateOne({ _id: item.productId }, { $inc: { stock: (item.quantity || 0) } });
                        }
                    }
                }
            }

            // 2. Tìm các LỊCH ĐẶT DỊCH VỤ hết hạn thanh toán
            const expiredBookings = await Booking.find({
                paymentStatus: "unpaid",
                paymentExpireAt: { $lt: now },
                bookingStatus: "pending",
                deleted: false
            });

            for (const booking of expiredBookings) {
                await Booking.updateOne({ _id: booking._id }, { bookingStatus: "cancelled" });
            }

            // 3. Tìm các LỊCH ĐẶT KHÁCH SẠN (Boarding) hết hạn giữ chỗ (held)
            const BoardingBooking = (await import('../models/boarding-booking.model')).default;
            const expiredBoardings = await BoardingBooking.find({
                boardingStatus: "held",
                holdExpiresAt: { $lt: now },
                deleted: false
            });

            for (const boarding of expiredBoardings) {
                await BoardingBooking.updateOne({ _id: boarding._id }, {
                    boardingStatus: "cancelled",
                    cancelledAt: now,
                    cancelledBy: "system",
                    cancelledReason: "Hết thời gian giữ phòng (Thanh toán hết hạn 15p)"
                });
            }

            // 4. Tự động đánh dấu Trễ hẹn (Delayed) và Tự động Hủy (Cancelled) dựa trên thời gian bắt đầu
            const config = await BookingConfig.findOne({});
            if (config) {
                const gracePeriod = config.bookingGracePeriod || 15;
                const cancelPeriod = config.bookingCancelPeriod || 60;
                const autoCancel = config.autoCancelEnabled;

                // 4.1 Đánh dấu Trễ hẹn
                const delayedThreshold = new Date(now.getTime() - gracePeriod * 60000);
                const bookingsToDelay = await Booking.find({
                    bookingStatus: "confirmed",
                    start: { $lt: delayedThreshold },
                    checkedInAt: { $exists: false },
                    deleted: false
                });

                if (bookingsToDelay.length > 0) {
                    const Notification = (await import('../models/notification.model')).default;
                    for (const b of bookingsToDelay) {
                        await Booking.updateOne({ _id: b._id }, { bookingStatus: "delayed" });

                        await Notification.create({
                            type: "booking",
                            title: "Khách trễ hẹn",
                            content: `Lịch đặt ${b.code} đã trễ quá ${gracePeriod} phút.`,
                            metadata: { bookingId: b._id, bookingCode: b.code },
                            status: "unread"
                        });
                    }
                }

                // 4.2 Tự động hủy nếu trễ hạn quá lâu
                if (autoCancel) {
                    const cancelThreshold = new Date(now.getTime() - cancelPeriod * 60000);
                    const bookingsToAutoCancel = await Booking.find({
                        bookingStatus: { $in: ["confirmed", "delayed"] },
                        start: { $lt: cancelThreshold },
                        checkedInAt: { $exists: false },
                        deleted: false
                    });

                    if (bookingsToAutoCancel.length > 0) {
                        const Notification = (await import('../models/notification.model')).default;
                        for (const b of bookingsToAutoCancel) {
                            await Booking.updateOne({ _id: b._id }, {
                                bookingStatus: "cancelled",
                                cancelledAt: now,
                                cancelledBy: "system",
                                cancelledReason: `Tự động hủy do trễ quá ${cancelPeriod} phút.`
                            });

                            await Notification.create({
                                type: "booking",
                                title: "Lịch đặt tự động hủy",
                                content: `Lịch đặt ${b.code} đã bị hệ thống tự động hủy do trễ quá ${cancelPeriod} phút.`,
                                metadata: { bookingId: b._id, bookingCode: b.code },
                                status: "unread"
                            });
                        }
                    }
                }

                // 4.3 Kiểm tra xung đột lịch tiếp theo (Collision Detection)
                const possiblyConflicts = await Booking.find({
                    bookingStatus: { $in: ["confirmed", "delayed"] },
                    start: { $lt: now },
                    checkedInAt: { $exists: false },
                    deleted: false
                });

                if (possiblyConflicts.length > 0) {
                    const Notification = (await import('../models/notification.model')).default;
                    for (const b of possiblyConflicts) {
                        const start = b.start as Date;
                        const end = b.end as Date;
                        const durationMs = end.getTime() - start.getTime();
                        const potentialEnd = new Date(now.getTime() + durationMs);

                        const staffIds = b.petStaffMap.map((m: any) => m.staffId?.toString()).filter((id: string) => !!id);

                        const nextConflict = await Booking.findOne({
                            _id: { $ne: b._id },
                            bookingStatus: { $in: ["confirmed", "in-progress"] },
                            deleted: false,
                            "petStaffMap.staffId": { $in: staffIds },
                            start: { $lt: potentialEnd, $gte: now }
                        });

                        if (nextConflict) {
                            await Booking.updateOne({ _id: b._id }, {
                                bookingStatus: "cancelled",
                                cancelledAt: now,
                                cancelledBy: "system",
                                cancelledReason: `Tự động hủy do trễ và gây ảnh hưởng lịch tiếp theo (${nextConflict.code})`
                            });

                            await Notification.create({
                                type: "booking",
                                title: "Hủy lịch do xung đột",
                                content: `Lịch đặt ${b.code} bị hủy do trễ và gây ảnh hưởng lịch ${nextConflict.code}.`,
                                metadata: { bookingId: b._id, bookingCode: b.code },
                                status: "unread"
                            });
                        }
                    }
                }
            }

            // 5. Tự động hoàn thành đơn hàng sau 7 ngày
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const shippedOrdersToComplete = await Order.find({
                orderStatus: "shipped",
                updatedAt: { $lt: sevenDaysAgo },
                deleted: false
            });

            if (shippedOrdersToComplete.length > 0) {
                const { addPointAfterPayment } = await import('../helpers/point.helper');
                for (const order of shippedOrdersToComplete) {
                    await Order.updateOne({ _id: order._id }, { orderStatus: "completed" });
                    if (order.code) {
                        try { await addPointAfterPayment(order.code); } catch (e) { }
                    }
                }
            }

        } catch (error) {
            console.error(error);
        }
    });
};
