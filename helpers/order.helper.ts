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

                    // Tìm variant khớp dựa trên nhãn (label)
                    // Trong Order model, item.variant là mảng chuỗi: ["Tên thuộc tính: Nhãn"] (VD: ["Kích cỡ: M", "Màu sắc: Đỏ"])
                    const vIndex = variants.findIndex((v: any) => {
                        if (!v.attributeValue || v.attributeValue.length === 0) return false;

                        // Tách lấy phần "Nhãn" từ item.variant để so sánh
                        // VD: "Kích cỡ: M" -> ["Kích cỡ", "M"] -> lấy "M"
                        const itemLabels = item.variant.map((str: string) => {
                            const parts = str.split(": ");
                            return parts.length > 1 ? parts[1] : str;
                        });

                        // Kiểm tra xem tất cả các nhãn của variant này có nằm trong danh sách nhãn của item không
                        return v.attributeValue.length === itemLabels.length && v.attributeValue.every((attr: any) => {
                            // attr.label là nhãn hiển thị trong DB (VD: "M", "Đỏ")
                            return itemLabels.includes(attr.label);
                        });
                    });

                    if (vIndex !== -1) {
                        // Tăng stock của variant
                        const currentStock = parseInt(variants[vIndex].stock) || 0;
                        variants[vIndex].stock = currentStock + (item.quantity || 0);

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
