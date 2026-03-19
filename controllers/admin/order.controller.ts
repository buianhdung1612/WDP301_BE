import { Request, Response } from "express";
import Order from "../../models/order.model";
import { addPointAfterPayment } from "../../helpers/point.helper";
import { refundOrderResources } from "../../helpers/order.helper";

// [GET] /api/v1/admin/orders
export const list = async (req: Request, res: Response) => {
    try {
        const filter: any = { deleted: false };

        if (req.query.status && req.query.status !== 'all') {
            filter.orderStatus = req.query.status;
        }

        const keyword = req.query.keyword || req.query.q;
        if (keyword) {
            const cleanCode = String(keyword).replace(/^#/, "");
            const keywordRegex = new RegExp(String(keyword), "i");
            const codeRegex = new RegExp(cleanCode, "i");
            filter.$or = [
                { code: codeRegex },
                { fullName: keywordRegex },
                { phone: keywordRegex }
            ];
        }

        const limitItems = parseInt(`${req.query.limit}`) || 20;
        const page = Math.max(1, parseInt(`${req.query.page}`) || 1);
        const skip = (page - 1) * limitItems;

        const [recordList, totalRecords, counts] = await Promise.all([
            Order.find(filter)
                .populate("userId", "fullName phone email")
                .sort({ createdAt: -1 })
                .limit(limitItems)
                .skip(skip)
                .lean(),
            Order.countDocuments(filter),
            Order.aggregate([
                { $match: { deleted: false } },
                { $group: { _id: "$orderStatus", count: { $sum: 1 } } }
            ])
        ]);

        const statusCounts: any = {
            all: await Order.countDocuments({ deleted: false }),
            pending: 0,
            confirmed: 0,
            shipping: 0,
            completed: 0,
            cancelled: 0,
            returned: 0,
            request_cancel: 0
        };

        counts.forEach((item: any) => {
            if (statusCounts.hasOwnProperty(item._id)) {
                statusCounts[item._id] = item.count;
            }
        });

        res.json({
            code: 200,
            message: "Danh sách đơn hàng",
            data: {
                recordList,
                statusCounts,
                pagination: {
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limitItems),
                    currentPage: page,
                    limit: limitItems
                }
            }
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
        const id = req.params.id;

        // Kiểm tra đơn hàng tồn tại
        const order = await Order.findOne({
            _id: id,
            deleted: false
        });

        if (!order) {
            return res.status(404).json({ code: 404, message: "Không tìm thấy đơn hàng" });
        }

        // 1. Không cho thay đổi đơn đã hoàn thành hoặc đã hủy
        if (["completed", "cancelled"].includes(order.orderStatus) && status !== order.orderStatus) {
            return res.status(400).json({
                code: 400,
                message: "Không thể thay đổi trạng thái đơn hàng đã hoàn thành hoặc đã hủy!"
            });
        }

        if (status === "completed" && order.orderStatus !== "completed" && order.code) {
            await addPointAfterPayment(order.code);
        }

        // Hoàn lại tài nguyên nếu hủy đơn
        if (status === "cancelled" && order.orderStatus !== "cancelled" && order.code) {
            await refundOrderResources(order.code);
        }

        order.orderStatus = status;
        await order.save();

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

        // 1. Không cho thay đổi trạng thái đơn hàng khi đã hoàn thành hoặc đã hủy
        if (["completed", "cancelled"].includes(order.orderStatus) && orderStatus !== order.orderStatus) {
            return res.status(400).json({
                code: 400,
                message: "Không thể thay đổi trạng thái đơn hàng đã hoàn thành hoặc đã hủy!"
            });
        }

        // 2. Không cho paid thành unpaid
        if (order.paymentStatus === "paid" && paymentStatus === "unpaid") {
            return res.status(400).json({
                code: 400,
                message: "Không thể chuyển đơn đã thanh toán về chưa thanh toán!"
            });
        }

        // 3. Nếu đơn hàng đã hoàn thành hoặc hủy, không cho phép thay đổi trạng thái thanh toán hoặc ghi chú (tùy chọn)
        if (["completed", "cancelled"].includes(order.orderStatus)) {
            // Nếu vẫn muốn cho phép sửa ghi chú thì bỏ note ra
            if (paymentStatus && paymentStatus !== order.paymentStatus) {
                return res.status(400).json({
                    code: 400,
                    message: "Không thể thay đổi trạng thái thanh toán của đơn hàng đã kết thúc!"
                });
            }
        }

        // Tích điểm cho người dùng nếu đơn hàng hoàn thành
        if (orderStatus === "completed" && order.orderStatus !== "completed" && order.code) {
            await addPointAfterPayment(order.code);
        }

        // Hoàn lại tài nguyên nếu hủy đơn
        if (orderStatus === "cancelled" && order.orderStatus !== "cancelled" && order.code) {
            await refundOrderResources(order.code);
        }

        if (orderStatus) order.orderStatus = orderStatus;
        if (paymentStatus) order.paymentStatus = paymentStatus;

        // Tự động hủy đơn nếu đã hoàn tiền (refunded) và chưa bị hủy trước đó
        if (order.paymentStatus === "refunded" && order.orderStatus !== "cancelled") {
            order.orderStatus = "cancelled";
            // Hoàn lại tài nguyên cho đơn hàng nếu chuyển sang trạng thái hủy
            if (order.code) {
                await refundOrderResources(order.code);
            }
        }

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
