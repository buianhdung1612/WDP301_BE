import cron from 'node-cron';
import Order from '../models/order.model';
import Booking from '../models/booking.model';
import Product from '../models/product.model';

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
                // Cập nhật trạng thái đơn hàng thành "Đã hủy"
                await Order.updateOne({ _id: order._id }, { orderStatus: "cancelled" });

                // Hoàn lại số lượng kho (stock) cho từng sản phẩm
                for (const item of order.items) {
                    const productDetail: any = await Product.findOne({
                        _id: item.productId,
                        deleted: false
                    });

                    if (productDetail) {
                        // Nếu đơn hàng có variant (mảng string như "Kích cỡ: M")
                        if (item.variant && item.variant.length > 0) {
                            const updatedVariants = [...(productDetail.variants || [])];

                            // Tìm index của biến thể khớp nhất dựa trên giá trị (v.value trong Order item vs av.value trong DB)
                            const variantMatchedIndex = updatedVariants.findIndex((v: any) => {
                                if (!v.attributeValue || v.attributeValue.length !== item.variant.length) return false;

                                return v.attributeValue.every((av: any) => {
                                    // Kiểm tra xem có label nào trong Order chứa giá trị này không
                                    return item.variant.some((label: string) => label.includes(av.value));
                                });
                            });

                            if (variantMatchedIndex !== -1) {
                                updatedVariants[variantMatchedIndex].stock += item.quantity;
                                await Product.updateOne(
                                    { _id: item.productId },
                                    { variants: updatedVariants }
                                );
                            } else {
                                // Default back to base stock if no variant matches (safety)
                                await Product.updateOne(
                                    { _id: item.productId },
                                    { $inc: { stock: (item.quantity || 0) } }
                                );
                            }
                        } else {
                            // Nếu không có biến thể
                            await Product.updateOne(
                                { _id: item.productId },
                                { $inc: { stock: (item.quantity || 0) } }
                            );
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

        } catch (error) {
            console.error(error);
        }
    });
};
