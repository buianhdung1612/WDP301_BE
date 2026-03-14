import { getPointConfig } from "../configs/setting.config";
import AccountUser from "../models/account-user.model";
import Order from "../models/order.model";

export const addPointAfterPayment = async (orderCode: string) => {
    const order: any = await Order.findOne({
        code: orderCode,
        deleted: false
    });
    if (order && order.userId && (!order.earnedPoint || order.earnedPoint === 0)) {
        const pointConfig = await getPointConfig();
        const pointEarned = Math.floor(order.total / pointConfig.MONEY_PER_POINT); // Số điểm được tích
        if (pointEarned > 0) {
            await AccountUser.updateOne(
                {
                    _id: order.userId,
                    deleted: false,
                    status: "active"
                },
                {
                    $inc: {
                        totalPoint: pointEarned
                    }
                }
            );

            await Order.updateOne(
                { _id: order._id },
                { earnedPoint: pointEarned }
            );
        }
    }
}