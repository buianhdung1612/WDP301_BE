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

                    // Tìm variant khớp dựa trên nhãn (label)
                    // item.variant là mảng chuỗi: ["Tên thuộc tính: Nhãn"] (VD: ["Kích cỡ: M", "Màu sắc: Đỏ"])
                    const vIndex = (product.variants as any[]).findIndex((v: any) => {
                        if (!v.attributeValue || v.attributeValue.length === 0) return false;

                        // Tách lấy phần "Nhãn" từ item.variant để so sánh
                        const itemLabels = (item.variant as string[]).map((str: string) => {
                            const parts = str.split(": ");
                            return parts.length > 1 ? parts[1] : str;
                        });

                        return v.attributeValue.length === itemLabels.length && v.attributeValue.every((attr: any) => {
                            return itemLabels.includes(attr.label);
                        });
                    });

                    if (vIndex !== -1) {
                        // ── Hoàn stock biến thể - Atomic update ──
                        await Product.updateOne(
                            { _id: item.productId },
                            { $inc: { [`variants.${vIndex}.stock`]: item.quantity || 0 } }
                        );
                        refundedVariant = true;
                    }
                }
            }

            // Nếu không phải variant hoặc không tìm thấy variant khớp thì hoàn vào stock chính
            if (!refundedVariant) {
                // ── Hoàn stock gốc - Atomic update ──
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { stock: item.quantity || 0 } }
                );
            }
        }
    }
};
