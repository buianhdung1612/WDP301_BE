import Order from "../models/order.model";
import AccountUser from "../models/account-user.model";
import Product from "../models/product.model";

export const refundOrderResources = async (orderCode: string) => {
    const order = await Order.findOne({ code: orderCode });
    if (!order) return;

    // 1. Hoàn lại điểm (usedPoint)
    if (order.userId && order.usedPoint > 0) {
        await AccountUser.updateOne(
            { _id: order.userId },
            { $inc: { usedPoint: -order.usedPoint } }
        );
        // Đánh dấu đã hoàn điểm trong đơn hàng để tránh hoàn 2 lần
        await Order.updateOne({ _id: order._id }, { usedPoint: 0 });
    }

    // 2. Hoàn lại tồn kho (Stock)
    if (order.items && order.items.length > 0) {
        for (const item of order.items) {
            let refundedVariant = false;

            // Nếu đơn hàng có thông tin variant (lưu dưới dạng mảng chuỗi ["Size: M", "Color: Red"])
            if (item.variant && item.variant.length > 0) {
                const product = await Product.findById(item.productId);
                if (product && product.variants && product.variants.length > 0) {
                    const variants = [...product.variants];

                    // Tìm variant khớp dựa trên nhãn (label) hoặc giá trị
                    // Trong Order model, variant được lưu là mảng chuỗi: ["Tên: Giá trị"]
                    const vIndex = variants.findIndex((v: any) => {
                        return v.attributeValue.every((attr: any) => {
                            const labelPair = `${attr.name}: ${attr.value}`;
                            return item.variant.includes(labelPair);
                        });
                    });

                    if (vIndex !== -1) {
                        variants[vIndex].stock = (parseInt(variants[vIndex].stock) || 0) + (item.quantity || 0);
                        await Product.updateOne({ _id: item.productId }, { variants });
                        refundedVariant = true;
                    }
                }
            }

            // Nếu không phải variant hoặc không tìm thấy variant khớp thì hoàn vào stock chính
            if (!refundedVariant) {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { stock: item.quantity || 0 } }
                );
            }
        }
    }
};
