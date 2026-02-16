import express, { Request, Response } from "express";
import mongoose from "mongoose";
import Booking from "../../models/booking.model";
import WorkSchedule from "../../models/work-schedule.model";
import Service from "../../models/service.model";
import Pet from "../../models/pet.model";
import dayjs from "dayjs";
import puppeteer from 'puppeteer';
import moment from "moment";

// Helper to check if two time ranges overlap
const isOverlap = (start1: Date, end1: Date, start2: Date, end2: Date) => {
    return start1 < end2 && start2 < end1;
};

// [GET] /api/v1/client/time-slots
export const getAvailableTimeSlots = async (req: Request, res: Response) => {
    try {
        const { serviceId, date } = req.query; // date format: YYYY-MM-DD

        if (!date) {
            return res.status(400).json({ code: 400, message: "Vui lòng chọn ngày" });
        }

        const service = await Service.findById(serviceId);
        const duration = service?.duration || 30; // Mặc định 30p nếu ko có dịch vụ

        const queryDateStr = date as string;

        // 1. Lấy tất cả lịch trực của nhân viên trong ngày
        const startOfDay = new Date(queryDateStr);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(queryDateStr);
        endOfDay.setHours(23, 59, 59, 999);

        const schedules = await WorkSchedule.find({
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: ["scheduled", "checked-in"] }
        }).populate("shiftId");

        // 2. Lấy tất cả lịch đã đặt trong ngày
        const bookings = await Booking.find({
            start: { $gte: startOfDay, $lte: endOfDay },
            bookingStatus: { $nin: ["cancelled"] },
            deleted: false
        });

        const staffSchedules = new Map();
        schedules.forEach((s: any) => {
            if (!s.shiftId) return;
            const staffId = s.staffId.toString();
            if (!staffSchedules.has(staffId)) {
                staffSchedules.set(staffId, {
                    startTime: s.shiftId.startTime,
                    endTime: s.shiftId.endTime,
                    bookings: bookings.filter(b => b.staffId?.toString() === staffId || (!b.staffId && b.bookingStatus === 'pending'))
                });
            }
        });

        // 3. Tính toán khung giờ từ 08:00 đến 20:00 (mỗi 15p)
        const availableSlots: any[] = [];
        let current = new Date(startOfDay);
        current.setHours(8, 0, 0, 0);
        const endTime = new Date(startOfDay);
        endTime.setHours(20, 0, 0, 0);

        // Define lunch break
        const lunchStart = new Date(startOfDay).setHours(12, 0, 0, 0);
        const lunchEnd = new Date(startOfDay).setHours(13, 0, 0, 0);

        while (current.getTime() + duration * 60000 <= endTime.getTime()) {
            const timeStr = moment(current).format("HH:mm");
            const slotEnd = new Date(current.getTime() + duration * 60000);

            // Skip slots during or overlapping lunch break
            // 1. Slot starts or ends within [12:00, 13:00]
            // 2. Slot crosses the lunch break
            const isLunchConflict = (current.getTime() < lunchEnd && slotEnd.getTime() > lunchStart);

            if (isLunchConflict) {
                current = new Date(current.getTime() + 15 * 60000);
                continue;
            }

            let freeStaffCount = 0;
            let totalStaffOnShift = 0;

            staffSchedules.forEach((config) => {
                const [sH, sM] = config.startTime.split(":").map(Number);
                const [eH, eM] = config.endTime.split(":").map(Number);
                const shiftStart = new Date(startOfDay).setHours(sH, sM, 0, 0);
                const shiftEnd = new Date(startOfDay).setHours(eH, eM, 0, 0);

                // Slot must be fully within a single staff's shift
                if (current.getTime() >= shiftStart && slotEnd.getTime() <= shiftEnd) {
                    totalStaffOnShift++;
                    const isBusy = config.bookings.some((b: any) => isOverlap(current, slotEnd, b.start, b.end));
                    if (!isBusy) {
                        freeStaffCount++;
                    }
                }
            });

            availableSlots.push({
                time: timeStr,
                freeStaff: freeStaffCount,
                availableSlots: freeStaffCount,
                status: totalStaffOnShift === 0 ? "closed" : (freeStaffCount > 0 ? "available" : "full"),
                totalStaff: totalStaffOnShift
            });

            current = new Date(current.getTime() + 15 * 60000); // Bước nhảy 15p
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
            customerName,
            customerPhone,
            customerEmail,
            notes
        } = req.body;

        // 1. Validate Service
        const service = await Service.findById(serviceId);
        if (!service || service.deleted || service.status === "inactive") {
            return res.status(400).json({ code: 400, message: "Dịch vụ không tồn tại" });
        }

        const duration = service.duration || 30;
        const start = new Date(startTime);
        const end = new Date(start.getTime() + duration * 60000);

        // 2. Validate Pets
        if (!userId && (!customerName || !customerPhone)) {
            return res.status(400).json({ code: 400, message: "Vui lòng cung cấp thông tin liên hệ" });
        }

        if (userId && (!petIds || petIds.length === 0)) {
            return res.status(400).json({ code: 400, message: "Vui lòng chọn thú cưng" });
        }

        let pets: any[] = [];
        if (userId && petIds.length > 0) {
            pets = await Pet.find({ _id: { $in: petIds }, deleted: false });
            if (pets.length !== petIds.length) {
                return res.status(400).json({
                    code: 400,
                    message: "Một hoặc nhiều thú cưng không tồn tại"
                });
            }
        }

        // 3. Calculate Price
        let totalPrice = 0;
        if (service.pricingType === "fixed") {
            totalPrice = (service.basePrice || 0) * (petIds.length || 1);
        } else if (service.pricingType === "by-weight") {
            for (const pet of pets) {
                const petWeight = pet.weight || 0;
                const priceItem = service.priceList?.find((item: any) => {
                    const label = item.label;
                    if (!label) return false;

                    // Support "< 5kg", "<5", etc.
                    if (label.includes('<')) {
                        const maxWeight = parseFloat(label.replace(/[^\d.]/g, ''));
                        return petWeight < maxWeight;
                    }
                    // Support "> 10kg", ">10", etc.
                    if (label.includes('>')) {
                        const minWeight = parseFloat(label.replace(/[^\d.]/g, ''));
                        return petWeight > minWeight;
                    }
                    // Support "5-10kg", "5 - 10", etc.
                    if (label.includes('-')) {
                        const numbers = label.match(/\d+\.?\d*/g);
                        if (numbers && numbers.length >= 2) {
                            const [min, max] = numbers.map((v: string) => parseFloat(v));
                            return petWeight >= min && petWeight <= max;
                        }
                    }
                    // Default fallback for single numeric labels
                    const singleNum = parseFloat(label.replace(/[^\d.]/g, ''));
                    if (!isNaN(singleNum)) {
                        return petWeight <= singleNum;
                    }
                    return false;
                });
                if (!service) break;
                totalPrice += priceItem ? (priceItem as any).value : (service.basePrice || 0);
            }
        }

        // 4. Create Booking
        const bookingCode = `BK${Date.now()}`;
        const newBooking = new Booking({
            code: bookingCode,
            userId,
            serviceId,
            customerName,
            customerPhone,
            customerEmail,
            petIds: Array.isArray(petIds) ? petIds.filter((id: string) => id != null && id !== "") : [],
            start,
            end,
            notes,
            subTotal: totalPrice,
            total: totalPrice,
            bookingStatus: "pending",
            paymentStatus: "unpaid"
        });

        await newBooking.save();

        res.status(201).json({
            code: 201,
            message: "Đặt lịch thành công",
            data: newBooking
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
            customerPhone: phone,
            deleted: false,
        }).populate("serviceId").populate("petIds");

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
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
    <p><strong>Khách hàng:</strong> ${booking.customerName}</p>
    <p><strong>Điện thoại:</strong> ${booking.customerPhone}</p>
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
