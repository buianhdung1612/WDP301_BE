import express, { Request, Response } from "express";
import mongoose from "mongoose";
import Booking from "../../models/booking.model";
import WorkSchedule from "../../models/work-schedule.model";
import Service from "../../models/service.model";
import Pet from "../../models/pet.model";
import Role from "../../models/role.model";
import BookingConfig from "../../models/booking-config.model";
import AccountAdmin from "../../models/account-admin.model";
import dayjs from "dayjs";
import puppeteer from 'puppeteer';
import moment from "moment";
import { findBestStaffForBooking, autoAssignPetsToStaff } from "../../helpers/booking-assignment.helper";

// Hỗ trợ kiểm tra xem hai khoảng thời gian có trùng nhau không
const isOverlap = (start1: Date, end1: Date, start2: Date, end2: Date) => {
    return start1 < end2 && start2 < end1;
};

// [GET] /api/v1/client/booking/config
export const getBookingConfig = async (req: Request, res: Response) => {
    try {
        const config = await BookingConfig.findOne({});
        res.json({
            code: 200,
            data: config || {
                bookingGracePeriod: 15,
                bookingCancelPeriod: 60,
                allowEarlyStartMinutes: 30,
                autoCancelEnabled: false,
                autoConfirmEnabled: false,
                depositPercentage: 0
            }
        });
    } catch (error) {
        res.status(500).json({ code: 500, message: "Lỗi hệ thống" });
    }
}

// [GET] /api/v1/client/time-slots
export const getAvailableTimeSlots = async (req: Request, res: Response) => {
    try {
        const { serviceId, date, count: petCount, petIds } = req.query; // định dạng ngày: YYYY-MM-DD
        const count = parseInt(petCount as string) || 1;
        const requestedPetIds = Array.isArray(petIds) ? petIds : (petIds ? (petIds as string).split(",") : []);

        if (!date) {
            return res.status(400).json({ code: 400, message: "Vui lòng chọn ngày" });
        }

        const service = await Service.findById(serviceId).populate("departmentId").populate("categoryId");
        if (!service) {
            return res.status(404).json({ code: 404, message: "Dịch vụ không tồn tại" });
        }

        let targetDeptId = service.departmentId?._id?.toString() || service.departmentId?.toString();

        // Nếu dịch vụ chưa gán phòng ban, thử tìm phòng ban theo danh mục
        if (!targetDeptId && service.categoryId) {
            const categoryName = (service.categoryId as any).name;
            const departments = await mongoose.model("Department").find({ deleted: false });
            // Tìm phòng ban có tên chứa từ khóa từ tên danh mục (ví dụ: "Spa", "Khách sạn")
            const matchedDept = departments.find(d =>
                categoryName.toLowerCase().includes(d.name.toLowerCase().replace("ban ", "").trim()) ||
                d.name.toLowerCase().includes(categoryName.toLowerCase().split(" ")[0])
            );
            if (matchedDept) {
                targetDeptId = matchedDept._id.toString();
            }
        }

        const baseDuration = service.duration || 30;

        const startOfDay = dayjs(date as string).startOf('day').toDate();
        const endOfDay = dayjs(date as string).endOf('day').toDate();

        const scheduleQuery: any = {
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: ["scheduled", "checked-in"] }
        };

        let schedules = await WorkSchedule.find(scheduleQuery).populate("staffId").populate("shiftId");

        // 2. Lấy TẤT CẢ các ca làm việc (Shifts) hoạt động của phòng ban này
        const shiftFilter: any = { status: "active" };
        if (targetDeptId) {
            shiftFilter.departmentId = targetDeptId;
        }
        const allShifts = await mongoose.model("Shift").find(shiftFilter).sort({ startTime: 1 });

        // Lọc lịch làm việc theo phòng ban đích (để tính toán nhân viên rảnh)
        if (targetDeptId) {
            schedules = schedules.filter(s => {
                const wsDeptId = s.departmentId?.toString();
                const shiftDeptId = (s.shiftId as any)?.departmentId?.toString();
                return wsDeptId === targetDeptId || shiftDeptId === targetDeptId;
            });
        }

        const bookings = await Booking.find({
            start: { $gte: startOfDay, $lte: endOfDay },
            bookingStatus: { $nin: ["cancelled"] },
            deleted: false
        });

        const staffConfigs: any[] = [];

        // Phân loại nhân viên trực ca theo WorkSchedule
        for (const s of schedules) {
            if (!s.shiftId || !s.staffId) continue;
            const staffStrId = s.staffId._id.toString();
            const shiftIdStr = s.shiftId._id.toString();

            const roles = await Role.find({
                _id: { $in: (s.staffId as any).roles },
                isStaff: true,
                status: "active",
                deleted: false
            });

            const canDoService = roles.some(role =>
                role.serviceIds?.some((id: any) => id.toString() === serviceId)
            );

            staffConfigs.push({
                staffId: staffStrId,
                fullName: (s.staffId as any).fullName,
                shiftId: shiftIdStr,
                startTime: (s.shiftId as any).startTime,
                endTime: (s.shiftId as any).endTime,
                canDoService,
                bookings: bookings.filter(b => {
                    const bStaffIds = b.staffIds?.map((id: any) => id.toString()) || [];
                    return bStaffIds.includes(staffStrId);
                })
            });
        }

        const resultShifts = [];

        // Duyệt qua TẤT CẢ các ca của phòng ban đó (kể cả ca chưa có ai làm)
        for (const shiftData of allShifts) {
            const shiftId = shiftData._id.toString();
            const shiftName = shiftData.name;
            const shiftStart = shiftData.startTime;
            const shiftEnd = shiftData.endTime;

            const shiftStaffs = staffConfigs.filter(c => c.shiftId === shiftId);
            const slots = [];
            const [sH, sM] = shiftStart.split(":").map(Number);
            const [eH, eM] = shiftEnd.split(":").map(Number);

            let current = new Date(startOfDay);
            current.setHours(sH, sM, 0, 0);
            const endTimeSlot = new Date(startOfDay);
            endTimeSlot.setHours(eH, eM, 0, 0);

            while (current.getTime() < endTimeSlot.getTime()) {
                const timeStr = moment(current).format("HH:mm");
                const parallelEnd = new Date(current.getTime() + baseDuration * 60000);

                // Chỉ những nhân viên vừa đang trực ca này, vừa có kỹ năng mới được tính là "rảnh cho slot này"
                const qualifiedStaffAvailable = [];
                const slotStaffNames = [];

                for (const config of shiftStaffs) {
                    if (!config.canDoService) continue; // Không có kỹ năng thì bỏ qua

                    const isBusy = config.bookings.some((b: any) => isOverlap(current, parallelEnd, b.start as any as Date, b.end as any as Date));
                    if (!isBusy) {
                        qualifiedStaffAvailable.push(config);
                        slotStaffNames.push(config.fullName);
                    }
                }

                const availableCount = qualifiedStaffAvailable.length;
                let isAvailable = false;
                let currentMode = "parallel";
                let effectiveEnd = parallelEnd;

                if (availableCount > 0) {
                    const petsPerStaff = Math.ceil(count / availableCount);
                    const requiredDuration = petsPerStaff * baseDuration;
                    effectiveEnd = new Date(current.getTime() + requiredDuration * 60000);
                    currentMode = petsPerStaff === 1 ? "parallel" : "sequential_mixed";

                    if (effectiveEnd.getTime() <= endTimeSlot.getTime()) {
                        let fullyFreeCount = 0;
                        for (const config of qualifiedStaffAvailable) {
                            const isBusyLong = config.bookings.some((b: any) => isOverlap(current, effectiveEnd, b.start as any as Date, b.end as any as Date));
                            if (!isBusyLong) fullyFreeCount++;
                        }

                        if (fullyFreeCount > 0 && (fullyFreeCount * Math.floor(requiredDuration / baseDuration) >= count)) {
                            isAvailable = true;
                        }
                    }
                }

                let petIsBusy = false;
                if (requestedPetIds.length > 0 && isAvailable) {
                    petIsBusy = bookings.some(b => {
                        const hasCommonPet = b.petIds.some((pid: any) => requestedPetIds.includes(pid.toString()));
                        if (!hasCommonPet) return false;
                        return isOverlap(current, effectiveEnd, b.start as any as Date, b.end as any as Date);
                    });
                }

                slots.push({
                    time: timeStr,
                    freeStaff: availableCount,
                    status: (isAvailable && !petIsBusy) ? "available" : (petIsBusy ? "pet_busy" : "full"),
                    totalStaff: shiftStaffs.filter(s => s.canDoService).length, // Chỉ đếm tổng nhân viên CÓ KỸ NĂNG trong ca
                    mode: currentMode,
                    staffNames: slotStaffNames
                });

                current = new Date(current.getTime() + 5 * 60000);
            }

            resultShifts.push({
                _id: shiftId,
                name: shiftName,
                startTime: shiftStart,
                endTime: shiftEnd,
                slots: slots
            });
        }

        res.json({
            code: 200,
            message: "Danh sách ca và khung giờ",
            data: {
                shifts: resultShifts
            }
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
        const userId = res.locals.accountUser?._id?.toString();
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status as string;

        if (!userId) {
            return res.status(401).json({
                code: 401,
                message: "Vui lòng đăng nhập"
            });
        }

        let filter: any = { deleted: false, userId }; // Lọc theo user hiện tại và chưa xóa
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
        const userId = res.locals.accountUser?._id?.toString();

        if (!userId) {
            return res.status(401).json({
                code: 401,
                message: "Vui lòng đăng nhập"
            });
        }

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
        const {
            serviceId,
            startTime,
            petIds = [],
            notes,
            paymentMethod
        } = req.body;

        const userId = res.locals.accountUser?._id?.toString();

        if (!userId) {
            return res.status(401).json({
                code: 401,
                message: "Vui lòng đăng nhập"
            });
        }


        // 0. Lấy cấu hình đặt lịch
        const config = await BookingConfig.findOne({});
        const autoConfirm = config?.autoConfirmEnabled ?? false;

        // 1. Kiểm tra dịch vụ
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

        // 2. Kiểm tra thú cưng
        const pets = await Pet.find({ _id: { $in: petIds }, userId, deleted: false });
        if (pets.length !== numPets) {
            return res.status(400).json({ code: 400, message: "Một hoặc nhiều thú cưng không hợp lệ" });
        }

        // 3. Tự động phân công nhân viên (Ưu tiên song song)
        let finalEndDate = new Date(start.getTime() + baseDuration * 60000);
        let bestStaffList = await findBestStaffForBooking(start, start, finalEndDate, serviceId as string, numPets);

        if (bestStaffList.length > 0) {
            // Điều chỉnh thời gian nếu không đủ nhân viên cho tất cả thú cưng (ví dụ: 4 bé nhưng chỉ có 3 nhân viên)
            if (bestStaffList.length < numPets) {
                const adjustedDuration = baseDuration * Math.ceil(numPets / bestStaffList.length);
                finalEndDate = new Date(start.getTime() + adjustedDuration * 60000);
            }
        } else {
            // Không có nhân viên làm song song? Thử tìm 1 nhân viên làm tuần tự
            const sequentialDuration = baseDuration * numPets;
            finalEndDate = new Date(start.getTime() + sequentialDuration * 60000);
            bestStaffList = await findBestStaffForBooking(start, start, finalEndDate, serviceId as string, 1);

            if (bestStaffList.length === 0) {
                return res.status(400).json({
                    code: 400,
                    message: "Rất tiếc, khung giờ này hiện tại không còn đủ nhân viên rảnh cho tất cả thú cưng của bạn. Vui lòng chọn khung giờ khác!"
                });
            }
        }

        // 3.5 Kiểm tra lịch trùng của thú cưng (Cùng khách hàng, cùng thời gian, chung thú cưng)
        const petOverlap = await Booking.findOne({
            userId,
            bookingStatus: { $nin: ["cancelled", "completed"] },
            deleted: false,
            petIds: { $in: petIds },
            $or: [{ start: { $lt: finalEndDate }, end: { $gt: start } }]
        });

        if (petOverlap) {
            return res.status(400).json({
                code: 400,
                message: "Một hoặc nhiều thú cưng của bạn đã có lịch đặt khác trùng với khung giờ này. Vui lòng kiểm tra lại!"
            });
        }

        // 4. Tính giá tiền
        let totalPrice = 0;
        const petPrices: { [key: string]: number } = {};

        if (service.pricingType === "fixed" || !service.pricingType) {
            const price = service.basePrice || 0;
            totalPrice = price * numPets;
            pets.forEach(p => petPrices[p._id.toString()] = price);
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
                const price = priceItem ? (priceItem as any).value : (service.basePrice || 0);
                totalPrice += price;
                petPrices[pet._id.toString()] = price;
            }
        } else {
            const fallbackPrice = service.basePrice || 0;
            totalPrice = fallbackPrice * numPets;
            pets.forEach(p => petPrices[p._id.toString()] = fallbackPrice);
        }

        // 5. Tạo lịch đặt
        const bookingCode = `BK${Date.now()}`;
        const initialMap = autoAssignPetsToStaff(petIds, bestStaffList.map(s => s._id));
        const petStaffMap = initialMap.map((item: any) => ({
            ...item,
            price: petPrices[item.petId.toString()] || 0
        }));

        // Tính tiền cọc nếu có cấu hình
        let depositAmount = 0;
        let remainingAmount = totalPrice;

        const depositPercentage = config?.depositPercentage || 0;

        if (paymentMethod === "money") {
            // Tiền mặt: thu cọc theo % cấu hình, khách trả nốt tại quầy
            depositAmount = Math.round((totalPrice * depositPercentage) / 100);
            remainingAmount = totalPrice - depositAmount;
        } else {
            // Online (zalopay/vnpay): thu full tiền qua cổng thanh toán
            // depositAmount = 0 để không bị hint là "cọc"
            depositAmount = 0;
            remainingAmount = 0;
        }

        // Thời gian hết hạn thanh toán (mặc định 15 phút hoặc theo config)
        const gracePeriodMinutes = config?.bookingGracePeriod || 15;
        const paymentExpireAt = new Date(Date.now() + gracePeriodMinutes * 60 * 1000);

        const newBooking = new Booking({
            code: bookingCode,
            userId,
            customerName: res.locals.accountUser?.fullName || "Khách hàng",
            customerPhone: res.locals.accountUser?.phone || "",
            serviceId,
            staffIds: bestStaffList.map(s => s._id) as any,
            petStaffMap,
            petIds,
            start,
            end: finalEndDate,
            notes,
            subTotal: totalPrice,
            total: totalPrice,
            depositAmount,
            remainingAmount,
            bookingStatus: autoConfirm ? "confirmed" : "pending",
            paymentMethod: paymentMethod || "money",
            paymentStatus: "unpaid",
            paymentExpireAt: paymentExpireAt
        });

        await newBooking.save();
        const populatedBooking = await Booking.findById(newBooking._id).populate("userId");

        // Tạo thông báo mới cho Admin
        const Notification = (await import("../../models/notification.model")).default;
        await Notification.create({
            senderId: userId,
            type: "booking",
            title: "Lịch đặt dịch vụ mới",
            content: `Khách hàng ${res.locals.accountUser?.fullName || "mới"} vừa đặt lịch ${service.name} (Mã: ${bookingCode})`,
            metadata: {
                bookingId: newBooking._id,
                bookingCode: bookingCode
            },
            status: "unread"
        });

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
        const userId = res.locals.accountUser?._id?.toString();
        const { reason } = req.body;

        if (!userId) {
            return res.status(401).json({
                code: 401,
                message: "Vui lòng đăng nhập"
            });
        }

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

        if (["paid", "partially_paid"].includes(booking.paymentStatus)) {
            booking.bookingStatus = "request_cancel";
            booking.cancelledReason = reason || "Yêu cầu hủy lịch đã thanh toán";
            booking.cancelledAt = new Date();
            booking.cancelledBy = "customer";

            await booking.save();

            return res.json({
                code: 200,
                message: "Yêu cầu hủy đã được gửi! Admin sẽ kiểm tra và hoàn tiền sớm nhất",
                data: booking
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

// [PATCH] /api/v1/client/bookings/:id
export const updateBooking = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser?._id;
        const { notes } = req.body;

        const booking = await Booking.findById(req.params.id);

        if (!booking || booking.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Lịch đặt không tồn tại"
            });
        }

        // Chỉ cho phép nếu user là chủ sở hữu đơn hàng
        if (userId && booking.userId?.toString() !== userId.toString()) {
            return res.status(403).json({
                code: 403,
                message: "Bạn không có quyền cập nhật lịch đặt này"
            });
        }

        if (notes !== undefined) {
            booking.notes = notes;
        }

        await booking.save();

        res.json({
            code: 200,
            message: "Cập nhật lịch đặt thành công",
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật lịch đặt"
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
            <p>Địa chỉ: 123 Đường ABC, Quận X, TP.HCM</p>
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
