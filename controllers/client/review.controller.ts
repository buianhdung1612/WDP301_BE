import { Request, Response } from 'express';
import Review from '../../models/review.model';
import Product from '../../models/product.model';
import User from '../../models/account-user.model';
import Order from '../../models/order.model';

// [GET] /api/v1/client/reviews/:productId
export const getReviews = async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({
            productId,
            status: "approved"
        }).sort({ createdAt: "desc" }).lean();

        // Get user info
        const userIds = reviews.map(item => item.userId);
        const users = await User.find({ _id: { $in: userIds } }).select("fullName avatar").lean();
        const userMap = users.reduce((acc: any, cur: any) => {
            acc[cur._id.toString()] = cur;
            return acc;
        }, {});

        const result = reviews.map(item => ({
            ...item,
            user: userMap[item.userId] || { fullName: "Người dùng", avatar: "" }
        }));

        // Calculate average rating
        const allReviews = await Review.find({ productId, status: "approved" }).select("rating").lean();
        const avgRating = allReviews.length > 0
            ? (allReviews.reduce((sum, item) => sum + item.rating, 0) / allReviews.length).toFixed(1)
            : 0;

        return res.json({
            success: true,
            data: {
                reviews: result,
                avgRating: Number(avgRating),
                totalReviews: allReviews.length
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi lấy đánh giá"
        });
    }
};

// [POST] /api/v1/client/reviews/create
export const createReview = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Bạn cần đăng nhập để đánh giá"
            });
        }

        const { productId, orderId, orderItemId, rating, comment, images, variant } = req.body;

        // Check if user bought the product
        let order;
        if (orderId === "MOCK_ORDER_ID") {
            order = await Order.findOne({
                userId: userId,
                orderStatus: "completed",
                "items.productId": productId
            });
        } else {
            order = await Order.findOne({
                _id: orderId,
                userId: userId,
                orderStatus: "completed"
            });
        }

        if (!order) {
            return res.status(403).json({
                success: false,
                message: "Bạn chỉ có thể đánh giá sản phẩm từ đơn hàng đã hoàn thành"
            });
        }

        let finalOrderItemId = orderItemId;
        if (finalOrderItemId === "MOCK_ITEM_ID") {
            const item = order.items.find((i: any) => i.productId.toString() === productId);
            finalOrderItemId = item?._id.toString();
        }

        // Check if item exists in order
        const itemInOrder = order.items.find((item: any) => item._id.toString() === finalOrderItemId);
        if (!itemInOrder) {
            return res.status(400).json({
                success: false,
                message: "Sản phẩm không thuộc đơn hàng này"
            });
        }

        // Check if already reviewed
        const existingReview = await Review.findOne({
            userId,
            orderItemId: finalOrderItemId
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: "Bạn đã đánh giá sản phẩm này rồi"
            });
        }

        const newReview = new Review({
            userId,
            productId,
            orderId,
            orderItemId: finalOrderItemId,
            rating,
            comment,
            images,
            variant,
            status: "pending"
        });

        await newReview.save();

        // Tạo thông báo cho Admin
        try {
            const Notification = (await import("../../models/notification.model")).default;
            await Notification.create({
                senderId: userId,
                type: "review",
                title: "Đánh giá sản phẩm mới",
                content: `Khách hàng vừa gửi đánh giá mới cho sản phẩm (Rating: ${rating})`,
                metadata: {
                    reviewId: newReview._id,
                    productId: productId
                },
                status: "unread"
            });
        } catch (notifError) {
            console.error("Lỗi tạo thông báo đánh giá:", notifError);
        }

        return res.json({
            success: true,
            message: "Gửi đánh giá thành công! Chờ phê duyệt từ quản trị viên."
        });

    } catch (error) {
        console.error("Error creating review:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống"
        });
    }
};

// [GET] /api/v1/client/reviews/my-reviews
export const getMyReviews = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Bạn cần đăng nhập"
            });
        }

        const reviews = await Review.find({ userId })
            .populate("productId", "name images slug")
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            data: reviews
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi Server"
        });
    }
};

// [PATCH] /api/v1/client/reviews/update/:id
export const updateReview = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser?._id;
        const { id } = req.params;
        const { rating, comment, images } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Bạn cần đăng nhập để chỉnh sửa đánh giá"
            });
        }

        const review = await Review.findOne({
            _id: id,
            userId: userId
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đánh giá hoặc bạn không có quyền sửa"
            });
        }

        await Review.updateOne({ _id: id }, {
            rating,
            comment,
            images,
            isEdited: true,
            status: "pending" // Quay lại trạng thái chờ duyệt sau khi sửa
        });

        return res.json({
            success: true,
            message: "Cập nhật đánh giá thành công! Đang chờ phê duyệt lại."
        });

    } catch (error) {
        console.error("Error updating review:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống"
        });
    }
};
