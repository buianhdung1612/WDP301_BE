import cron from 'node-cron';
import Product from '../models/product.model';
import ExpiredProduct from '../models/expired-product.model';

export const handleProductExpiry = async () => {
    try {
        const now = new Date();
        console.log(`[JOB-HẾT HẠN] Bắt đầu kiểm tra sản phẩm hết hạn lúc ${now.toISOString()}`);

        // Tìm các sản phẩm thực phẩm đã hết hạn và đang hoạt động
        const expiredProducts = await Product.find({
            isFood: true,
            status: "active",
            expiryDate: { $lt: now },
            deleted: false
        });

        const results = {
            totalFound: expiredProducts.length,
            logged: 0,
            deactivated: 0
        };

        if (expiredProducts.length > 0) {
            for (const product of expiredProducts as any[]) {
                // Lưu log thống kê trước khi reset stock
                if (product.stock && product.stock > 0) {
                    await ExpiredProduct.create({
                        productId: product._id,
                        name: product.name,
                        quantity: product.stock,
                        expiryDate: product.expiryDate
                    });
                    results.logged++;
                }

                await Product.updateOne(
                    { _id: product._id },
                    {
                        status: "inactive",
                        stock: 0
                    }
                );
                results.deactivated++;
            }
        }

        console.log(`[JOB-HẾT HẠN] Hoàn tất. Tìm thấy: ${results.totalFound}, Đã log: ${results.logged}, Đã vô hiệu: ${results.deactivated}`);
        return results;

    } catch (error) {
        console.error("[JOB-HẾT HẠN] Lỗi:", error);
        throw error;
    }
};

export const startExpiryTask = () => {
    // Chạy mỗi 4 tiếng (vào phút 0 của các giờ 0, 4, 8, 12, 16, 20)
    cron.schedule('0 */4 * * *', async () => {
        try {
            await handleProductExpiry();
        } catch (error) {
            console.error("[JOB-HẾT HẠN] Lỗi khi chạy cron:", error);
        }
    });

    console.log("[JOB-HẾT HẠN] Đã lên lịch chạy mỗi 4 tiếng");
};
