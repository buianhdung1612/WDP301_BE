import { Request, Response } from 'express';
import Review from '../../models/review.model';
import Product from '../../models/product.model';
import User from '../../models/account-user.model';

// [GET] /api/admin/reviews
export const list = async (req: Request, res: Response) => {
    try {
        const find: any = {};

        if (req.query.status && req.query.status !== 'all') {
            find.status = req.query.status;
        }

        if (req.query.search) {
            const searchRegex = new RegExp(`${req.query.search}`, 'i');
            const [matchingUsers, matchingProducts] = await Promise.all([
                User.find({ fullName: searchRegex }).select("_id"),
                Product.find({ name: searchRegex }).select("_id")
            ]);
            const userIds = matchingUsers.map(u => u._id.toString());
            const productIds = matchingProducts.map(p => p._id.toString());

            find.$or = [
                { comment: searchRegex },
                { userId: { $in: userIds } },
                { productId: { $in: productIds } }
            ];
        }

        const limitItems = parseInt(`${req.query.limit}`) || 20;
        const page = Math.max(1, parseInt(`${req.query.page}`) || 1);
        const skip = (page - 1) * limitItems;

        const [recordList, totalRecord] = await Promise.all([
            Review.find(find)
                .sort({ createdAt: "desc" })
                .limit(limitItems)
                .skip(skip)
                .lean(),
            Review.countDocuments(find)
        ]);

        // Get product info
        const productIds = recordList.map(item => item.productId);
        const products = await Product.find({ _id: { $in: productIds } }).select("name images").lean();
        const productMap = products.reduce((acc: any, cur: any) => {
            acc[cur._id.toString()] = {
                name: cur.name,
                image: cur.images?.[0] || ""
            };
            return acc;
        }, {});

        // Get user info
        const userIds = recordList.map(item => item.userId);
        const users = await User.find({ _id: { $in: userIds } }).select("fullName avatar email").lean();
        const userMap = users.reduce((acc: any, cur: any) => {
            acc[cur._id.toString()] = {
                fullName: cur.fullName,
                avatar: cur.avatar,
                email: cur.email
            };
            return acc;
        }, {});

        const recordWithInfo = recordList.map(item => ({
            ...item,
            productName: productMap[item.productId]?.name || "N/A",
            productImage: productMap[item.productId]?.image || "",
            userName: userMap[item.userId]?.fullName || "N/A",
            userAvatar: userMap[item.userId]?.avatar || "",
            userEmail: userMap[item.userId]?.email || ""
        }));

        return res.json({
            success: true,
            message: "Lấy danh sách đánh giá thành công",
            data: {
                recordList: recordWithInfo,
                pagination: {
                    totalRecords: totalRecord,
                    totalPages: Math.ceil(totalRecord / limitItems),
                    currentPage: page,
                    limit: limitItems
                }
            }
        });
    } catch (error) {
        console.error("Error in list review:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi lấy danh sách đánh giá"
        });
    }
};

// [PATCH] /api/admin/reviews/change-status/:id
export const changeStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["pending", "approved", "rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Trạng thái không hợp lệ"
            });
        }

        await Review.updateOne({ _id: id }, { status });

        return res.json({
            success: true,
            message: "Cập nhật trạng thái đánh giá thành công"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống"
        });
    }
};

// [DELETE] /api/admin/reviews/delete/:id
export const deleteReview = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await Review.deleteOne({ _id: id });
        return res.json({
            success: true,
            message: "Xóa đánh giá thành công"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống"
        });
    }
};
