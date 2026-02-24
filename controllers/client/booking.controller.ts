import express, { Request, Response } from "express";
import mongoose from "mongoose";
import Booking from "../../models/booking.model";
import WorkSchedule from "../../models/work-schedule.model";
import Service from "../../models/service.model";
import Pet from "../../models/pet.model";
import Role from "../../models/role.model";
import dayjs from "dayjs";
import puppeteer from 'puppeteer';
import moment from "moment";
import { findBestStaffForBooking, autoAssignPetsToStaff } from "../../helpers/booking-assignment.helper";

// Helper to check if two time ranges overlap
const isOverlap = (start1: Date, end1: Date, start2: Date, end2: Date) => {
    return start1 < end2 && start2 < end1;
};

// [GET] /api/v1/client/time-slots
export const getAvailableTimeSlots = async (req: Request, res: Response) => {
    try {
        const { serviceId, date, count: petCount } = req.query; // date format: YYYY-MM-DD
        const count = parseInt(petCount as string) || 1;

        if (!date) {
            return res.status(400).json({ code: 400, message: "Vui lòng chọn ngày" });
        }

        const service = await Service.findById(serviceId);
        const baseDuration = service?.duration || 30;

        const queryDateStr = date as string;
        const startOfDay = new Date(queryDateStr);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(queryDateStr);
        endOfDay.setHours(23, 59, 59, 999);

        const schedules = await WorkSchedule.find({
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: ["scheduled", "checked-in"] }
        }).populate("staffId").populate("shiftId");

        const bookings = await Booking.find({
            start: { $gte: startOfDay, $lte: endOfDay },
            bookingStatus: { $nin: ["cancelled"] },
            deleted: false
        });

        const staffSchedules = new Map();
        for (const s of schedules) {
            if (!s.shiftId || !s.staffId) continue;
            const staffStrId = s.staffId._id.toString();

            const roles = await Role.find({
                _id: { $in: (s.staffId as any).roles },
                isStaff: true,
                status: "active",
                deleted: false
            });

            const canDoService = roles.some(role =>
                role.serviceIds?.some((id: any) => id.toString() === serviceId)
            );

            if (!canDoService) continue;

            staffSchedules.set(staffStrId, {
                startTime: (s.shiftId as any).startTime,
                endTime: (s.shiftId as any).endTime,
                bookings: bookings.filter(b => {
                    const bStaffId = b.staffId?.toString();
                    const bStaffIds = b.staffIds?.map((id: any) => id.toString()) || [];
                    return bStaffId === staffStrId || bStaffIds.includes(staffStrId);
                })
            });
        }

        const availableSlots: any[] = [];
        let current = new Date(startOfDay);
        current.setHours(8, 0, 0, 0);

        // Tìm giờ kết thúc muộn nhất trong tất cả các ca làm việc của ngày đó
        let maxShiftEndMinutes = 0;
        staffSchedules.forEach(config => {
            const [eH, eM] = config.endTime.split(":").map(Number);
            const endMinutes = eH * 60 + eM;
            if (endMinutes > maxShiftEndMinutes) maxShiftEndMinutes = endMinutes;
        });

        if (maxShiftEndMinutes === 0) maxShiftEndMinutes = 21 * 60; // Fallback nếu không tìm thấy ca nào

        const endTimeSlot = new Date(startOfDay);
        endTimeSlot.setHours(Math.floor(maxShiftEndMinutes / 60), maxShiftEndMinutes % 60, 0, 0);

        while (current.getTime() + baseDuration * 60000 <= endTimeSlot.getTime()) {
            const timeStr = moment(current).format("HH:mm");

            // Check Parallel Availability (N staff for base duration)
            let parallelFreeCount = 0;
            const parallelEnd = new Date(current.getTime() + baseDuration * 60000);

            // Check Sequential Availability (1 staff for N*base duration)
            let sequentialPossible = false;
            const sequentialEnd = new Date(current.getTime() + (baseDuration * count) * 60000);

            let totalStaffOnShift = 0;

            staffSchedules.forEach((config) => {
                const [sH, sM] = config.startTime.split(":").map(Number);
                const [eH, eM] = config.endTime.split(":").map(Number);
                const shiftStart = new Date(startOfDay).setHours(sH, sM, 0, 0);
                const shiftEnd = new Date(startOfDay).setHours(eH, eM, 0, 0);

                // Check for Parallel (base duration)
                if (current.getTime() >= shiftStart && parallelEnd.getTime() <= shiftEnd) {
                    totalStaffOnShift++;
                    const isBusyParallel = config.bookings.some((b: any) => isOverlap(current, parallelEnd, b.start, b.end));
                    if (!isBusyParallel) {
                        parallelFreeCount++;
                    }
                }

                // Check for Sequential (longer duration)
                if (current.getTime() >= shiftStart && sequentialEnd.getTime() <= shiftEnd) {
                    const isBusySequential = config.bookings.some((b: any) => isOverlap(current, sequentialEnd, b.start, b.end));
                    if (!isBusySequential) {
                        sequentialPossible = true;
                    }
                }
            });

            const isAvailable = (parallelFreeCount >= count) || sequentialPossible;

            availableSlots.push({
                time: timeStr,
                freeStaff: parallelFreeCount,
                availableSlots: parallelFreeCount,
                status: totalStaffOnShift === 0 ? "closed" : (isAvailable ? "available" : "full"),
                totalStaff: totalStaffOnShift,
                mode: parallelFreeCount >= count ? "parallel" : "sequential"
            });

            current = new Date(current.getTime() + 15 * 60000);
        }

        res.json({
            code: 200,
            message: "Danh sách khung giờ",
            data: availableSlots
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi tính toán khung giờ",
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// [GET] /api/v1/client/bookings
export const listMyBookings = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser._id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status as string;

        let filter: any = { deleted: false, userId };
        if (status) {
            filter.bookingStatus = status;
        }

        const bookings = await Booking.find(filter)
            .populate("serviceId")
            .populate("petIds")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Booking.countDocuments(filter);

        res.json({
            code: 200,
            message: "Danh sách lịch đặt của tôi",
            data: bookings,
            pagination: {
                totalRecords: total,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                limit: limit
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách lịch đặt"
        });
    }
};


// [GET] /api/v1/client/bookings/:id
export const getMyBooking = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser._id;
        const booking = await Booking.findById(req.params.id)
            .populate("serviceId")
            .populate("petIds");

        if (!booking || booking.deleted || booking.userId?.toString() !== userId.toString()) {
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

// [POST] /api/v1/client/bookings
export const createBooking = async (req: Request, res: Response) => {
    try {
        const user = res.locals.accountUser || null;
        const userId = user ? user._id : null;

        const {
            serviceId,
            startTime,
            petIds = [],
            notes
        } = req.body;

        if (!userId) {
            return res.status(401).json({ code: 401, message: "Vui lòng đăng nhập" });
        }

        // 1. Validate Service
        const service = await Service.findById(serviceId);
        if (!service || service.deleted || service.status === "inactive") {
            return res.status(400).json({ code: 400, message: "Dịch vụ không tồn tại" });
        }

        const baseDuration = service.duration || 30;
        const start = new Date(startTime);
        const numPets = petIds.length;

        if (numPets === 0) {
            return res.status(400).json({ code: 400, message: "Vui lòng chọn thú cưng" });
        }

        // 2. Validate Pets
        const pets = await Pet.find({ _id: { $in: petIds }, userId, deleted: false });
        if (pets.length !== numPets) {
            return res.status(400).json({ code: 400, message: "Một hoặc nhiều thú cưng không hợp lệ" });
        }

        // 3. Automated Staff Assignment (Parallel First)
        let finalEndDate = new Date(start.getTime() + baseDuration * 60000);
        let bestStaffList = await findBestStaffForBooking(start, start, finalEndDate, serviceId as string, numPets);

        // If not enough staff for parallel, try sequential
        if (bestStaffList.length < numPets) {
            const sequentialDuration = baseDuration * numPets;
            finalEndDate = new Date(start.getTime() + sequentialDuration * 60000);
            bestStaffList = await findBestStaffForBooking(start, start, finalEndDate, serviceId as string, 1);
        }

        if (bestStaffList.length === 0) {
            return res.status(400).json({
                code: 400,
                message: "Rất tiếc, khung giờ này hiện tại không còn đủ nhân viên rảnh cho tất cả thú cưng của bạn. Vui lòng chọn khung giờ khác!"
            });
        }

        // 4. Calculate Price
        let totalPrice = 0;
        if (service.pricingType === "fixed") {
            totalPrice = (service.basePrice || 0) * numPets;
        } else if (service.pricingType === "by-weight") {
            for (const pet of pets) {
                const petWeight = pet.weight || 0;
                const priceItem = service.priceList?.find((item: any) => {
                    const label = item.label;
                    if (!label) return false;
                    if (label.includes('<')) return petWeight < parseFloat(label.replace(/[^\d.]/g, ''));
                    if (label.includes('>')) return petWeight > parseFloat(label.replace(/[^\d.]/g, ''));
                    if (label.includes('-')) {
                        const nums = label.match(/\d+\.?\d*/g);
                        return nums && petWeight >= parseFloat(nums[0]) && petWeight <= parseFloat(nums[1]);
                    }
                    return petWeight <= parseFloat(label.replace(/[^\d.]/g, ''));
                });
                totalPrice += priceItem ? (priceItem as any).value : (service.basePrice || 0);
            }
        }

        // 5. Create Booking
        const bookingCode = `BK${Date.now()}`;
        const newBooking = new Booking({
            code: bookingCode,
            userId,
            serviceId,
            staffId: bestStaffList[0]._id,
            staffIds: bestStaffList.map(s => s._id) as any,
            petStaffMap: autoAssignPetsToStaff(petIds, bestStaffList.map(s => s._id)) as any,
            petIds,
            start,
            end: finalEndDate,
            notes,
            subTotal: totalPrice,
            total: totalPrice,
            bookingStatus: "confirmed",
            paymentStatus: "unpaid"
        });

        await newBooking.save();
        const populatedBooking = await Booking.findById(newBooking._id).populate("userId");

        res.status(201).json({
            code: 201,
            message: "Đặt lịch thành công",
            data: populatedBooking
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi hệ thống",
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// [PATCH] /api/v1/client/bookings/:id/cancel
export const cancelMyBooking = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser._id;
        const { reason } = req.body;

        const booking = await Booking.findById(req.params.id);

        if (!booking || booking.deleted || booking.userId?.toString() !== userId.toString()) {
            return res.status(404).json({
                code: 404,
                message: "Lịch đặt không tồn tại"
            });
        }

        if (["completed", "cancelled"].includes(booking.bookingStatus)) {
            return res.status(400).json({
                code: 400,
                message: "Không thể hủy lịch đặt này"
            });
        }

        booking.bookingStatus = "cancelled";
        booking.cancelledReason = reason || "Khách hàng hủy";
        booking.cancelledAt = new Date();
        booking.cancelledBy = "customer";

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

// [GET] /api/v1/client/booking/export-pdf
export const exportBookingPdf = async (req: Request, res: Response) => {
    try {
        const { bookingCode, phone } = req.query;

        const booking = await Booking.findOne({
            code: bookingCode,
            deleted: false,
        }).populate("serviceId").populate("petIds").populate("userId");

        if (!booking) {
            return res.status(404).json({ message: "Lịch đặt không tồn tại" });
        }

        const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Phiếu dịch vụ ${booking.code}</title>
  <style>
    * { box-sizing: border-box; font-family: "Segoe UI", Arial, sans-serif; }
    body { padding: 40px; background: #fff; color: #333; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; }
    .logo { color: #f97316; font-size: 24px; font-weight: bold; }
    .info-section { margin-top: 30px; }
    .info-title { font-size: 16px; font-weight: bold; color: #f97316; margin-bottom: 10px; border-bottom: 1px solid #f0f0f0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #fafafa; padding: 12px; border: 1px solid #eee; text-align: left; }
    td { padding: 12px; border: 1px solid #eee; }
    .total-row { font-weight: bold; font-size: 18px; color: #f97316; }
    .footer { margin-top: 50px; text-align: center; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">TeddyPet Spa</div>
    <div>
      <p><strong>Mã:</strong> ${booking.code}</p>
      <p><strong>Ngày đặt:</strong> ${dayjs(booking.createdAt).format("DD/MM/YYYY HH:mm")}</p>
    </div>
  </div>
  <div class="info-section">
    <div class="info-title">THÔNG TIN KHÁCH HÀNG</div>
    <p><strong>Khách hàng:</strong> ${(booking.userId as any)?.fullName || "N/A"}</p>
    <p><strong>Điện thoại:</strong> ${(booking.userId as any)?.phone || "N/A"}</p>
  </div>
  <div class="info-section">
    <div class="info-title">CHI TIẾT DỊCH VỤ</div>
    <table>
      <thead>
        <tr>
          <th>Dịch vụ</th>
          <th>Ngày hẹn</th>
          <th>Giờ hẹn</th>
          <th>Thú cưng</th>
          <th>Giá tiền</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${(booking.serviceId as any)?.name || "N/A"}</td>
          <td>${dayjs(booking.start).format("DD/MM/YYYY")}</td>
          <td>${dayjs(booking.start).format("HH:mm")}</td>
          <td>${(booking.petIds as any[]).map((p: any) => p?.name || "N/A").join(", ")}</td>
          <td>${(booking.total || 0).toLocaleString("vi-VN")} đ</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div style="margin-top: 20px; text-align: right;">
    <p class="total-row">Tổng cộng: ${(booking.total || 0).toLocaleString("vi-VN")} đ</p>
  </div>
  <div class="footer">
    <p>Cảm ơn quý khách đã tin tưởng TeddyPet!</p>
    <p>Địa chỉ: 123 Đường ABC, Quận X, TP. HCM</p>
  </div>
</body>
</html>
`;
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4' });
        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=booking_' + bookingCode + '.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error("Export PDF Error:", error);
        res.status(500).json({ code: 500, message: "Lỗi xuất PDF" });
    }
};
