import { Request, Response } from "express";
import Order from "../../models/order.model";

// [GET] /api/v1/admin/orders
export const list = async (req: Request, res: Response) => {
    try {
        const filter: any = { deleted: false };

        if (req.query.status && req.query.status !== 'all') {
            filter.orderStatus = req.query.status;
        }

        const orders = await Order.find(filter)
            .populate("userId", "fullName phone email")
            .sort({ createdAt: -1 });

        res.json({
            code: 200,
            message: "Danh sách đơn hàng",
            data: orders
        });
    } catch (error: any) {
        res.status(500).json({ code: 500, message: error.message });
    }
};

// [GET] /api/v1/admin/orders/:id
export const detail = async (req: Request, res: Response) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            deleted: false
        }).populate("userId", "fullName phone email avatar");

        if (!order) {
            return res.status(404).json({ code: 404, message: "Không tìm thấy đơn hàng" });
        }

        res.json({
            code: 200,
            message: "Chi tiết đơn hàng",
            data: order
        });
    } catch (error: any) {
        res.status(500).json({ code: 500, message: error.message });
    }
};

// [PATCH] /api/v1/admin/orders/:id/status
export const updateStatus = async (req: Request, res: Response) => {
    try {
        const { status } = req.body;
        const order = await Order.findOneAndUpdate(
            { _id: req.params.id, deleted: false },
            { orderStatus: status },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ code: 404, message: "Không tìm thấy đơn hàng" });
        }

        res.json({
            code: 200,
            message: "Cập nhật trạng thái thành công",
            data: order
        });
    } catch (error: any) {
        res.status(500).json({ code: 500, message: error.message });
    }
};
