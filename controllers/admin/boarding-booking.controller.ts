import { Request, Response } from "express";
import mongoose from "mongoose";
import BoardingBooking from "../../models/boarding-booking.model";
import BoardingCage from "../../models/boarding-cage.model";
import AccountAdmin from "../../models/account-admin.model";
import AccountUser from "../../models/account-user.model";
import Pet from "../../models/pet.model";
import Role from "../../models/role.model";
import WorkSchedule from "../../models/work-schedule.model";

const pickParam = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
        const first = value[0];
        return typeof first === "string" ? first : undefined;
    }
    return undefined;
};

const normalizeTime = (value: unknown): string => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return /^\d{2}:\d{2}$/.test(raw) ? raw : "";
};

const normalizeTaskStatus = (value: unknown): "pending" | "done" | "skipped" => {
    const status = String(value || "").toLowerCase();
    if (status === "done") return "done";
    if (status === "skipped") return "skipped";
    return "pending";
};

const normalizeObjectId = (value: unknown): mongoose.Types.ObjectId | null => {
    const raw = typeof value === "object" && value && "_id" in (value as any)
        ? String((value as any)._id || "").trim()
        : String(value || "").trim();
    if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
    return new mongoose.Types.ObjectId(raw);
};

const sanitizeFeedingSchedule = (items: any[]): any[] => {
    return items
        .map((item) => {
            const status = normalizeTaskStatus(item?.status);
            const doneAt = status === "done"
                ? (item?.doneAt ? new Date(item.doneAt) : new Date())
                : null;
            const staffId = normalizeObjectId(item?.staffId);
            return {
                time: normalizeTime(item?.time),
                food: String(item?.food || "").trim(),
                amount: String(item?.amount || "").trim(),
                note: String(item?.note || "").trim(),
                staffId,
                staffName: String(item?.staffName || "").trim(),
                status,
                doneAt
            };
        })
        .filter((item) => item.time || item.food || item.amount || item.note || item.staffId);
};

const sanitizeExerciseSchedule = (items: any[]): any[] => {
    return items
        .map((item) => {
            const status = normalizeTaskStatus(item?.status);
            const durationRaw = Number(item?.durationMinutes || 0);
            const durationMinutes = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : 0;
            const doneAt = status === "done"
                ? (item?.doneAt ? new Date(item.doneAt) : new Date())
                : null;
            const staffId = normalizeObjectId(item?.staffId);
            return {
                time: normalizeTime(item?.time),
                activity: String(item?.activity || "").trim(),
                durationMinutes,
                note: String(item?.note || "").trim(),
                staffId,
                staffName: String(item?.staffName || "").trim(),
                status,
                doneAt
            };
        })
        .filter((item) => item.time || item.activity || item.durationMinutes || item.note || item.staffId);
};

const generateBoardingCode = () => {
    const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const rand = Math.floor(100 + Math.random() * 900);
    return `BRD${stamp}${rand}`;
};

// [GET] /api/v1/admin/boarding-booking/hotel-staffs
export const listBoardingHotelStaffs = async (_req: Request, res: Response) => {
    try {
        const queryDate = pickParam(_req.query.date);
        const roles = await Role.find({
            deleted: false,
            status: "active",
            $or: [
                { isStaff: true },
                { permissions: { $in: ["boarding_booking_view", "boarding_booking_edit", "boarding_booking_checkin", "boarding_booking_checkout"] } }
            ]
        }).select("_id");

        const roleIds = roles.map((item) => item._id);
        if (!roleIds.length) {
            return res.json({ code: 200, data: [] });
        }

        const staffFilter: any = {
            deleted: false,
            status: "active",
            roles: { $in: roleIds },
        };

        if (queryDate) {
            const dateObj = new Date(queryDate);
            if (!Number.isNaN(dateObj.getTime())) {
                const startOfDay = new Date(dateObj);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(dateObj);
                endOfDay.setHours(23, 59, 59, 999);

                const scheduledStaffIds = await WorkSchedule.distinct("staffId", {
                    date: { $gte: startOfDay, $lte: endOfDay },
                    status: { $in: ["scheduled", "checked-in", "checked-out"] },
                });

                staffFilter._id = { $in: scheduledStaffIds };
            }
        }

        const staffs = await AccountAdmin.find(staffFilter)
            .select("fullName phone email avatar employeeCode")
            .sort({ fullName: 1 })
            .lean();

        return res.json({ code: 200, data: staffs });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Loi he thong" });
    }
};

// [POST] /api/v1/admin/boarding-booking/create
export const createBoardingBooking = async (req: Request, res: Response) => {
    try {
        const {
            userId,
            petId,
            cageId,
            checkInDate,
            checkOutDate,
            fullName,
            phone,
            email,
            notes,
            specialCare,
            discount = 0,
            paymentMethod = "pay_at_site",
            paymentStatus = "unpaid",
            boardingStatus = "confirmed",
        } = req.body;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ code: 400, message: "Khach hang khong hop le" });
        }
        if (!petId || !mongoose.Types.ObjectId.isValid(petId)) {
            return res.status(400).json({ code: 400, message: "Thu cung khong hop le" });
        }
        if (!cageId || !mongoose.Types.ObjectId.isValid(cageId)) {
            return res.status(400).json({ code: 400, message: "Chuong khong hop le" });
        }
        if (!checkInDate || !checkOutDate) {
            return res.status(400).json({ code: 400, message: "Thieu ngay nhan hoac ngay tra chuong" });
        }

        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
            return res.status(400).json({ code: 400, message: "Khoang thoi gian luu tru khong hop le" });
        }

        const user = await AccountUser.findOne({ _id: userId, deleted: false }).lean();
        if (!user) {
            return res.status(404).json({ code: 404, message: "Khong tim thay khach hang" });
        }

        const pet = await Pet.findOne({ _id: petId, userId, deleted: false }).lean();
        if (!pet) {
            return res.status(400).json({ code: 400, message: "Thu cung khong thuoc khach hang da chon" });
        }

        const cage = await BoardingCage.findOne({ _id: cageId, deleted: false });
        if (!cage) {
            return res.status(404).json({ code: 404, message: "Khong tim thay chuong" });
        }
        if (cage.status === "maintenance") {
            return res.status(400).json({ code: 400, message: "Chuong dang bao tri" });
        }
        if (cage.maxWeightCapacity && Number(pet.weight || 0) > Number(cage.maxWeightCapacity)) {
            return res.status(400).json({ code: 400, message: "Thu cung vuot qua tai trong chuong" });
        }

        const overlap = await BoardingBooking.findOne({
            cageId,
            deleted: false,
            boardingStatus: { $in: ["held", "confirmed", "checked-in"] },
            checkInDate: { $lt: checkOut },
            checkOutDate: { $gt: checkIn }
        }).lean();
        if (overlap) {
            return res.status(400).json({ code: 400, message: "Chuong da co lich trung thoi gian nay" });
        }

        const totalDays = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const pricePerDay = Number(cage.dailyPrice || 0);
        const subTotal = totalDays * pricePerDay;
        const finalDiscount = Math.max(Number(discount || 0), 0);
        const total = Math.max(subTotal - finalDiscount, 0);

        const allowBoardingStatus = ["pending", "held", "confirmed", "checked-in", "checked-out", "cancelled"];
        const allowPaymentStatus = ["unpaid", "paid", "refunded"];
        const allowPaymentMethod = ["money", "vnpay", "zalopay", "pay_at_site", "prepaid"];

        const nextBoardingStatus = allowBoardingStatus.includes(boardingStatus) ? boardingStatus : "confirmed";
        const nextPaymentStatus = allowPaymentStatus.includes(paymentStatus) ? paymentStatus : "unpaid";
        const nextPaymentMethod = allowPaymentMethod.includes(paymentMethod) ? paymentMethod : "pay_at_site";

        const booking = await BoardingBooking.create({
            code: generateBoardingCode(),
            userId,
            petIds: [petId],
            cageId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            numberOfDays: totalDays,
            fullName: String(fullName || user.fullName || "").trim(),
            phone: String(phone || user.phone || "").trim(),
            email: String(email || user.email || "").trim(),
            pricePerDay,
            subTotal,
            discount: finalDiscount,
            total,
            paymentMethod: nextPaymentMethod,
            paymentStatus: nextPaymentStatus,
            notes: String(notes || "").trim(),
            specialCare: String(specialCare || "").trim(),
            boardingStatus: nextBoardingStatus,
            holdExpiresAt: nextBoardingStatus === "held" ? new Date(Date.now() + 15 * 60 * 1000) : null,
            actualCheckInDate: nextBoardingStatus === "checked-in" ? new Date() : null,
            actualCheckOutDate: nextBoardingStatus === "checked-out" ? new Date() : null,
            cancelledAt: nextBoardingStatus === "cancelled" ? new Date() : null,
            cancelledBy: nextBoardingStatus === "cancelled" ? "admin" : null,
            cancelledReason: nextBoardingStatus === "cancelled" ? "Admin tao don o trang thai huy" : null,
        });

        if (nextBoardingStatus === "checked-in") {
            await BoardingCage.findByIdAndUpdate(cageId, { status: "occupied" });
        } else if (nextBoardingStatus === "checked-out" || nextBoardingStatus === "cancelled") {
            await BoardingCage.findByIdAndUpdate(cageId, { status: "available" });
        } else if (["held", "confirmed", "pending"].includes(nextBoardingStatus)) {
            await BoardingCage.findByIdAndUpdate(cageId, { status: "occupied" });
        }

        const created = await BoardingBooking.findById(booking._id)
            .populate("userId", "fullName phone email avatar")
            .populate("petIds", "name type breed avatar weight")
            .populate("cageId", "cageCode type size dailyPrice status");

        return res.json({
            code: 200,
            message: "Tao don khach san thanh cong",
            data: created || booking
        });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Loi he thong" });
    }
};

// [GET] /api/v1/admin/boarding-booking
export const listBoardingBookings = async (req: Request, res: Response) => {
    try {
        const { search, status, paymentStatus } = req.query as Record<string, string>;
        const filter: any = { deleted: false };

        if (status) filter.boardingStatus = status;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (search) {
            filter.$or = [
                { code: new RegExp(search, "i") },
                { fullName: new RegExp(search, "i") },
                { phone: new RegExp(search, "i") },
            ];
        }

        const bookings = await BoardingBooking.find(filter)
            .populate("userId", "fullName phone email avatar")
            .populate("petIds", "name type breed avatar weight")
            .populate("cageId", "cageCode type size dailyPrice status")
            .sort({ createdAt: -1 });

        return res.json({ code: 200, data: bookings });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Loi he thong" });
    }
};

// [GET] /api/v1/admin/boarding-booking/:id
export const getBoardingBookingDetail = async (req: Request, res: Response) => {
    try {
        const id = pickParam(req.params.id);
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ code: 400, message: "ID khong hop le" });
        }

        const booking = await BoardingBooking.findOne({ _id: id, deleted: false })
            .populate("userId", "fullName phone email avatar")
            .populate("petIds", "name type breed avatar weight")
            .populate("cageId", "cageCode type size dailyPrice status description avatar amenities")
            .populate("feedingSchedule.staffId", "fullName phone employeeCode")
            .populate("exerciseSchedule.staffId", "fullName phone employeeCode");

        if (!booking) return res.status(404).json({ code: 404, message: "Khong tim thay don khach san" });
        return res.json({ code: 200, data: booking });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Loi he thong" });
    }
};

// [PATCH] /api/v1/admin/boarding-booking/:id/status
export const updateBoardingBookingStatus = async (req: Request, res: Response) => {
    try {
        const id = pickParam(req.params.id);
        const { boardingStatus } = req.body as { boardingStatus: string };
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ code: 400, message: "ID khong hop le" });
        }

        const allowStatus = ["pending", "held", "confirmed", "checked-in", "checked-out", "cancelled"];
        if (!allowStatus.includes(boardingStatus)) {
            return res.status(400).json({ code: 400, message: "Trang thai khong hop le" });
        }

        const booking: any = await BoardingBooking.findOne({ _id: id, deleted: false });
        if (!booking) return res.status(404).json({ code: 404, message: "Khong tim thay don khach san" });

        booking.boardingStatus = boardingStatus;
        if (boardingStatus === "checked-in") {
            booking.actualCheckInDate = new Date();
            await BoardingCage.findByIdAndUpdate(booking.cageId, { status: "occupied" });
        }
        if (boardingStatus === "checked-out") {
            booking.actualCheckOutDate = new Date();
            await BoardingCage.findByIdAndUpdate(booking.cageId, { status: "available" });
        }
        if (boardingStatus === "cancelled") {
            booking.cancelledAt = new Date();
            booking.cancelledBy = "admin";
            booking.cancelledReason = booking.cancelledReason || "Admin cap nhat";
            await BoardingCage.findByIdAndUpdate(booking.cageId, { status: "available" });
        }

        await booking.save();
        return res.json({ code: 200, message: "Cap nhat trang thai thanh cong", data: booking });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Loi he thong" });
    }
};

// [PATCH] /api/v1/admin/boarding-booking/:id/payment-status
export const updateBoardingPaymentStatus = async (req: Request, res: Response) => {
    try {
        const id = pickParam(req.params.id);
        const { paymentStatus } = req.body as { paymentStatus: string };
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ code: 400, message: "ID khong hop le" });
        }
        if (!["unpaid", "paid", "refunded"].includes(paymentStatus)) {
            return res.status(400).json({ code: 400, message: "Trang thai thanh toan khong hop le" });
        }

        const updated = await BoardingBooking.findOneAndUpdate(
            { _id: id, deleted: false },
            { paymentStatus },
            { new: true }
        );

        if (!updated) return res.status(404).json({ code: 404, message: "Khong tim thay don khach san" });
        return res.json({ code: 200, message: "Cap nhat thanh toan thanh cong", data: updated });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Loi he thong" });
    }
};

// [PATCH] /api/v1/admin/boarding-booking/:id/care-schedule
export const updateBoardingCareSchedule = async (req: Request, res: Response) => {
    try {
        const id = pickParam(req.params.id);
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ code: 400, message: "ID khong hop le" });
        }

        const { feedingSchedule, exerciseSchedule, careDate } = req.body as {
            feedingSchedule?: any[];
            exerciseSchedule?: any[];
            careDate?: string;
        };

        if (feedingSchedule !== undefined && !Array.isArray(feedingSchedule)) {
            return res.status(400).json({ code: 400, message: "feedingSchedule phai la mang" });
        }
        if (exerciseSchedule !== undefined && !Array.isArray(exerciseSchedule)) {
            return res.status(400).json({ code: 400, message: "exerciseSchedule phai la mang" });
        }
        const booking: any = await BoardingBooking.findOne({ _id: id, deleted: false });
        if (!booking) return res.status(404).json({ code: 404, message: "Khong tim thay don khach san" });

        const sanitizedFeeding = feedingSchedule !== undefined
            ? sanitizeFeedingSchedule(feedingSchedule).slice(0, 30)
            : undefined;
        const sanitizedExercise = exerciseSchedule !== undefined
            ? sanitizeExerciseSchedule(exerciseSchedule).slice(0, 30)
            : undefined;

        const staffIds = Array.from(new Set(
            [
                ...(sanitizedFeeding || []).map((item: any) => item?.staffId ? String(item.staffId) : ""),
                ...(sanitizedExercise || []).map((item: any) => item?.staffId ? String(item.staffId) : ""),
            ].filter(Boolean)
        ));

        if (staffIds.length > 0) {
            const baseDateRaw = careDate || booking.checkInDate;
            const baseDate = new Date(baseDateRaw);
            if (!Number.isNaN(baseDate.getTime())) {
                const startOfDay = new Date(baseDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(baseDate);
                endOfDay.setHours(23, 59, 59, 999);

                const schedules = await WorkSchedule.find({
                    staffId: { $in: staffIds },
                    date: { $gte: startOfDay, $lte: endOfDay },
                    status: { $in: ["scheduled", "checked-in", "checked-out"] },
                }).select("staffId").lean();

                const availableSet = new Set(schedules.map((item: any) => String(item.staffId)));
                const unavailableIds = staffIds.filter((staffId) => !availableSet.has(staffId));

                if (unavailableIds.length > 0) {
                    const unavailableStaffs = await AccountAdmin.find({
                        _id: { $in: unavailableIds },
                    }).select("fullName").lean();
                    const staffNames = unavailableStaffs.map((item: any) => item.fullName).filter(Boolean);
                    const dateText = `${String(startOfDay.getDate()).padStart(2, "0")}/${String(startOfDay.getMonth() + 1).padStart(2, "0")}/${startOfDay.getFullYear()}`;
                    return res.status(400).json({
                        code: 400,
                        message: `${staffNames.join(", ") || "Nhân viên được chọn"} khong co lich lam viec ngay ${dateText}`,
                    });
                }
            }
        }

        if (sanitizedFeeding !== undefined) {
            booking.feedingSchedule = sanitizedFeeding;
        }
        if (sanitizedExercise !== undefined) {
            booking.exerciseSchedule = sanitizedExercise;
        }

        await booking.save();
        return res.json({
            code: 200,
            message: "Cap nhat lich cham soc thanh cong",
            data: booking
        });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Loi he thong" });
    }
};
