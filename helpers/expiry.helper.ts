import Product from '../models/product.model';
import ExpiredProduct from '../models/expired-product.model';

export const handleProductExpiry = async () => {
    try {
        const now = new Date();
        console.log(`[EXPIRY-HELPER] Starting product expiry check at ${now.toISOString()}`);

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

        console.log(`[EXPIRY-HELPER] Finished check. Found: ${results.totalFound}, Logged: ${results.logged}, Deactivated: ${results.deactivated}`);
        return results;

    } catch (error) {
        console.error("[EXPIRY-HELPER] Error:", error);
        throw error;
    }
};
