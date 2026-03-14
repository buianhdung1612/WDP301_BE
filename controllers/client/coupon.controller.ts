import { Request, Response } from 'express';
import Coupon from '../../models/coupon.model';

export const list = async (req: Request, res: Response) => {
    try {
        const coupons = await Coupon.find({
            status: 'active',
            typeDisplay: 'public',
            deleted: false,
            $or: [
                { endDate: { $exists: false } },
                { endDate: null },
                { endDate: { $gte: new Date() } }
            ]
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách mã giảm giá thành công",
            data: coupons
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Mã giảm giá hiện tại không khả dụng"
        });
    }
};

export const checkCoupon = async (req: Request, res: Response) => {
    try {
        const { code, orderValue } = req.body;

        const coupon = await Coupon.findOne({
            code: code,
            status: 'active',
            deleted: false,
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Mã giảm giá không tồn tại hoặc đã hết hạn"
            });
        }

        // Check date
        const now = new Date();
        if (coupon.startDate && coupon.startDate > now) {
            return res.status(400).json({
                success: false,
                message: "Mã giảm giá chưa đến thời gian sử dụng"
            });
        }
        if (coupon.endDate && coupon.endDate < now) {
            return res.status(400).json({
                success: false,
                message: "Mã giảm giá đã hết hạn"
            });
        }

        // Check usage limit
        if ((coupon.usageLimit ?? 0) > 0 && coupon.usedCount >= (coupon.usageLimit ?? 0)) {
            return res.status(400).json({
                success: false,
                message: "Mã giảm giá đã hết lượt sử dụng"
            });
        }

        // Check min order value
        const minOrderValue = coupon.minOrderValue ?? 0;
        if (orderValue < minOrderValue) {
            return res.status(400).json({
                success: false,
                message: `Đơn hàng tối thiểu ${minOrderValue.toLocaleString('vi-VN')}đ để sử dụng mã này`
            });
        }

        // Calculate discount
        let discountAmount = 0;
        const value = coupon.value ?? 0;
        const maxDiscountValue = coupon.maxDiscountValue ?? 0;

        if (coupon.typeDiscount === 'percentage') {
            discountAmount = (orderValue * value) / 100;
            if (maxDiscountValue > 0 && discountAmount > maxDiscountValue) {
                discountAmount = maxDiscountValue;
            }
        } else {
            discountAmount = value;
        }

        return res.status(200).json({
            success: true,
            message: "Áp dụng mã giảm giá thành công",
            data: {
                code: coupon.code,
                typeDiscount: coupon.typeDiscount,
                value: value,
                maxDiscountValue: maxDiscountValue,
                discountAmount: discountAmount
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Lỗi kiểm tra mã giảm giá"
        });
    }
};
