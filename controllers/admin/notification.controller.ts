import { Request, Response } from "express";
import Notification from "../../models/notification.model";

// [GET] /api/v1/admin/notifications
export const getNotifications = async (req: Request, res: Response) => {
    try {
        const { status } = req.query;
        let query: any = { isDeleted: false };

        if (status) {
            query.status = status;
        }

        const notifications = await Notification.find(query)
            .populate("senderId", "fullName avatar")
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({
            code: 200,
            data: notifications
        });
    } catch (error) {
        console.error("getNotifications error:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy thông báo"
        });
    }
};

// [PATCH] /api/v1/admin/notifications/mark-read/all
export const markAllAsRead = async (req: Request, res: Response) => {
    try {
        await Notification.updateMany({ isDeleted: false, status: 'unread' }, { status: 'read' });
        res.json({
            code: 200,
            message: "Đã đánh dấu tất cả là đã đọc"
        });
    } catch (error) {
        console.error("markAllAsRead error:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi đánh dấu đã đọc"
        });
    }
};

// [PATCH] /api/v1/admin/notifications/mark-read/:id
export const markAsRead = async (req: Request, res: Response) => {
    try {
        await Notification.updateOne({ _id: req.params.id }, { status: 'read' });
        res.json({
            code: 200,
            message: "Đã đọc"
        });
    } catch (error) {
        console.error("markAsRead error:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi đánh dấu đã đọc"
        });
    }
};

// [PATCH] /api/v1/admin/notifications/archive/:id
export const archiveNotification = async (req: Request, res: Response) => {
    try {
        await Notification.updateOne({ _id: req.params.id }, { status: 'archived' });
        res.json({
            code: 200,
            message: "Đã lưu trữ thông báo"
        });
    } catch (error) {
        console.error("archiveNotification error:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lưu trữ thông báo"
        });
    }
};

// [PATCH] /api/v1/admin/notifications/archive/all
export const archiveAllNotifications = async (req: Request, res: Response) => {
    try {
        await Notification.updateMany({ isDeleted: false, status: { $ne: 'archived' } }, { status: 'archived' });
        res.json({
            code: 200,
            message: "Đã lưu trữ tất cả thông báo"
        });
    } catch (error) {
        console.error("archiveAllNotifications error:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lưu trữ tất cả thông báo"
        });
    }
};

// [DELETE] /api/v1/admin/notifications/all
export const deleteAllNotifications = async (req: Request, res: Response) => {
    try {
        await Notification.updateMany({ isDeleted: false }, { isDeleted: true });
        res.json({
            code: 200,
            message: "Xóa tất cả thông báo thành công"
        });
    } catch (error) {
        console.error("deleteAllNotifications error:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa tất cả thông báo"
        });
    }
};

// [DELETE] /api/v1/admin/notifications/:id
export const deleteNotification = async (req: Request, res: Response) => {
    try {
        await Notification.updateOne({ _id: req.params.id }, { isDeleted: true });
        res.json({
            code: 200,
            message: "Xóa thông báo thành công"
        });
    } catch (error) {
        console.error("deleteNotification error:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa thông báo"
        });
    }
};
