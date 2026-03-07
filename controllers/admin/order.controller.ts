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

// [PATCH] /api/v1/admin/orders/edit/:id
export const editPatch = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const { orderStatus, paymentStatus, note } = req.body;

        // Kiểm tra đơn hàng tồn tại
        const order = await Order.findOne({
            _id: id,
            deleted: false
        });

        if (!order) {
            return res.status(404).json({
                code: 404,
                message: "Đơn hàng không tồn tại!"
            });
        }

        // Không cho thay đổi đơn đã hoàn thành hoặc đã hủy
        if (["completed", "cancelled"].includes(order.orderStatus) && orderStatus !== order.orderStatus) {
            return res.status(400).json({
                code: 400,
                message: "Không thể thay đổi trạng thái đơn hàng đã hoàn thành hoặc đã hủy!"
            });
        }

        // Không cho paid thành unpaid
        if (order.paymentStatus === "paid" && paymentStatus === "unpaid") {
            return res.status(400).json({
                code: 400,
                message: "Không thể chuyển đơn đã thanh toán về chưa thanh toán!"
            });
        }

        if (orderStatus) order.orderStatus = orderStatus;
        if (paymentStatus) order.paymentStatus = paymentStatus;
        if (note !== undefined) order.note = note;

        await order.save();

        res.json({
            code: 200,
            message: "Cập nhật đơn hàng thành công!"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            code: 500,
            message: "Có lỗi xảy ra, vui lòng thử lại!"
        });
    }
};
