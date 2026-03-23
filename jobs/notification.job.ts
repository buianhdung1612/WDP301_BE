import Product from "../models/product.model";
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

export const startNotificationTask = () => {
    // Chạy vào 0:00 mỗi ngày
    cron.schedule('0 0 * * *', async () => {
        await scanProductsForNotifications();
    });

    // Chạy ngay lần đầu khi start server (để test)
    scanProductsForNotifications();
};
