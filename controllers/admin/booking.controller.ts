import express, { Request, Response } from "express";
import Booking from "../../models/booking.model";
import Service from "../../models/service.model";
import TimeSlot from "../../models/time-slot.model";
import Pet from "../../models/pet.model";
import AccountAdmin from "../../models/account-admin.model";
import Role from "../../models/role.model";

// [PATCH] /api/v1/admin/bookings/:id/assign-staff
export const assignStaff = async (req: Request, res: Response) => {
    try {
        const { staffId } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking || booking.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Lịch đặt không tồn tại"
            });
        }

        // 1. Kiểm tra nhân viên tồn tại
        const staff = await AccountAdmin.findOne({ _id: staffId, deleted: false });
        if (!staff) {
            return res.status(400).json({
                code: 400,
                message: "Nhân viên không tồn tại"
            });
        }

        // 2. Kiểm tra xem nhân viên có thuộc Role "Nhân viên thực hiện dịch vụ" (isStaffRole: true) không
        const roles = await Role.find({
            _id: { $in: staff.roles },
            isStaffRole: true,
            status: "active",
            deleted: false
        });

        if (roles.length === 0) {
            return res.status(400).json({
                code: 400,
                message: "Tài khoản này không phải là nhân viên thực hiện dịch vụ (vui lòng kiểm tra Nhóm quyền)"
            });
        }

        booking.staffId = staffId;
        await booking.save();

        res.json({
            code: 200,
            message: "Phân công nhân viên thành công",
            data: {
                bookingId: booking._id,
                staffName: staff.fullName,
                skills: roles.flatMap(r => r.skillSet || [])
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi phân công nhân viên"
        });
    }
};

// [GET] /api/v1/admin/bookings
export const listBookings = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status as string;

        let filter: any = { deleted: false };
        if (status) {
            filter.status = status;
        }

        const bookings = await Booking.find(filter)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Booking.countDocuments(filter);

        res.json({
            code: 200,
            message: "Danh sách lịch đặt",
            data: bookings,
            pagination: {
                currentPage: page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách lịch đặt"
        });
    }
};

// [GET] /api/v1/admin/bookings/:id
export const getBooking = async (req: Request, res: Response) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking || booking.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Lịch đặt không tồn tại"
            });
        }

        res.json({
            code: 200,
            message: "Chi tiết lịch đặt",
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy chi tiết lịch đặt"
        });
    }
};

// [PATCH] /api/v1/admin/bookings/:id/confirm
export const confirmBooking = async (req: Request, res: Response) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking || booking.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Lịch đặt không tồn tại"
            });
        }

        booking.status = "confirmed";
        await booking.save();

        res.json({
            code: 200,
            message: "Xác nhận lịch đặt thành công",
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xác nhận lịch đặt"
        });
    }
};

// [PATCH] /api/v1/admin/bookings/:id/cancel
export const cancelBooking = async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking || booking.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Lịch đặt không tồn tại"
            });
        }

        booking.status = "cancelled";
        booking.cancelledReason = reason || "Hủy từ admin";
        booking.cancelledAt = new Date();
        booking.cancelledBy = "admin";

        // Cập nhật slot
        if (booking.slotId) {
            const slot = await TimeSlot.findById(booking.slotId);
            // if (slot && slot.currentBookings > 0) {
            //     slot.currentBookings -= 1;
            //     if (slot.maxCapacity && slot.currentBookings < slot.maxCapacity) {
            //         slot.status = "available";
            //     }
            //     await slot.save();
            // }
        }

        await booking.save();

        res.json({
            code: 200,
            message: "Hủy lịch đặt thành công",
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi hủy lịch đặt"
        });
    }
};

// [PATCH] /api/v1/admin/bookings/:id/complete
export const completeBooking = async (req: Request, res: Response) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking || booking.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Lịch đặt không tồn tại"
            });
        }

        booking.status = "completed";
        booking.completedAt = new Date();
        await booking.save();

        res.json({
            code: 200,
            message: "Hoàn thành lịch đặt thành công",
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi hoàn thành lịch đặt"
        });
    }
};
