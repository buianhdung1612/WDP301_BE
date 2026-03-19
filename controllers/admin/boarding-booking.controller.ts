import { Request, Response } from "express";
import mongoose from "mongoose";
import BoardingBooking from "../../models/boarding-booking.model";
import BoardingCage from "../../models/boarding-cage.model";
import AccountAdmin from "../../models/account-admin.model";
import AccountUser from "../../models/account-user.model";
import Department from "../../models/department.model";
import Pet from "../../models/pet.model";
import Role from "../../models/role.model";
import WorkSchedule from "../../models/work-schedule.model";
import { buildDefaultBoardingCareSchedule } from "../../utils/boarding-care-template.util";
import { convertToSlug } from "../../helpers/slug.helper";

const MAX_ROOMS_PER_CAGE = Math.max(1, Number(process.env.BOARDING_CAGE_CAPACITY || 4));
const BOOKING_LOCK_MS = Math.max(3000, Number(process.env.BOARDING_BOOKING_LOCK_MS || 8000));
const COUNTER_DEPOSIT_MIN_DAYS = 2;
const COUNTER_DEPOSIT_PERCENT = 20;

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

const normalizeProofMedia = (items: unknown): Array<{ url: string; kind: "image" | "video" }> => {
    if (!Array.isArray(items)) return [];
    return items
        .map((item: any) => {
            const url = String(item?.url || item || "").trim();
            const kind = String(item?.kind || "").toLowerCase() === "video" ? "video" : "image";
            return { url, kind: kind as "image" | "video" };
        })
        .filter((item) => Boolean(item.url));
};

const normalizeObjectId = (value: unknown): mongoose.Types.ObjectId | null => {
    const raw = typeof value === "object" && value && "_id" in (value as any)
        ? String((value as any)._id || "").trim()
        : String(value || "").trim();
    if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
    return new mongoose.Types.ObjectId(raw);
};

const normalizeObjectIdString = (value: unknown): string | null => {
    const objectId = normalizeObjectId(value);
    return objectId ? String(objectId) : null;
};

const getBookingQuantity = (booking: any): number => {
    const quantity = Number(booking?.quantity || 0);
    if (Number.isFinite(quantity) && quantity > 0) return Math.round(quantity);
    if (Array.isArray(booking?.petIds) && booking.petIds.length > 0) return booking.petIds.length;
    return 1;
};

const shouldRequireCounterDeposit = (paymentMethod: string, totalDays: number) =>
    String(paymentMethod || "").toLowerCase() === "pay_at_site" && Number(totalDays || 0) >= COUNTER_DEPOSIT_MIN_DAYS;

const getDepositAmount = (total: number, paymentMethod: string, totalDays: number) => {
    if (!shouldRequireCounterDeposit(paymentMethod, totalDays)) return 0;
    return Math.round(Math.max(Number(total || 0), 0) * (COUNTER_DEPOSIT_PERCENT / 100));
};

const getPaidAmountByStatus = (bookingLike: any, paymentStatus: string) => {
    const normalized = String(paymentStatus || "").toLowerCase();
    if (normalized === "paid") return Math.max(0, Number(bookingLike?.total || 0));
    if (normalized === "partial") return Math.max(0, Number(bookingLike?.depositAmount || 0));
    return 0;
};

const hasSatisfiedCheckInPayment = (booking: any) => {
    const paymentStatus = String(booking?.paymentStatus || "").toLowerCase();
    if (paymentStatus === "paid") return true;

    const depositAmount = Math.max(0, Number(booking?.depositAmount || 0));
    if (depositAmount <= 0) {
        return String(booking?.paymentMethod || "").toLowerCase() !== "prepaid";
    }

    const paidAmount = Math.max(0, Number(booking?.paidAmount || 0));
    return paymentStatus === "partial" || paidAmount >= depositAmount;
};

const acquireCageBookingLock = async (cageId: string) => {
    const now = new Date();
    const lockUntil = new Date(now.getTime() + BOOKING_LOCK_MS);
    const cage = await BoardingCage.findOneAndUpdate(
        {
            _id: cageId,
            deleted: false,
            $or: [
                { bookingLockUntil: { $exists: false } },
                { bookingLockUntil: null },
                { bookingLockUntil: { $lte: now } }
            ]
        },
        { $set: { bookingLockUntil: lockUntil } },
        { returnDocument: "after" as any }
    );
    return cage;
};

const releaseCageBookingLock = async (cageId: string) => {
    await BoardingCage.updateOne(
        { _id: cageId },
        { $set: { bookingLockUntil: new Date(0) } }
    );
};

const canAssignBoardingHotelStaff = (req: Request, res: Response) => {
    const permissions = Array.isArray(res.locals.permissions) ? res.locals.permissions : [];
    return (
        permissions.includes("account_admin_view") ||
        permissions.includes("account_admin_edit") ||
        permissions.includes("role_permissions")
    );
};

const normalizeLookupText = (value: unknown) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getBoardingHotelDepartmentIds = async () => {
    const departments = await Department.find({
        deleted: false,
        status: "active",
    }).select("_id name code").lean();

    return departments
        .filter((item: any) => {
            const name = normalizeLookupText(item?.name);
            const code = normalizeLookupText(item?.code);
            return (
                name.includes("khach san") ||
                name.includes("cham soc") ||
                name.includes("boarding") ||
                name.includes("hotel") ||
                code.includes("hotel") ||
                code.includes("boarding") ||
                code.includes("khachsan") ||
                code.includes("khach-san") ||
                code.includes("cs") ||
                code.includes("ks")
            );
        })
        .map((item: any) => item._id);
};

const getBoardingHotelStaffRoleIds = async () => {
    const departmentIds = await getBoardingHotelDepartmentIds();

    const filter: any = {
        deleted: false,
        status: "active",
    };

    // Nếu tìm thấy phòng ban chuyên trách thì ưu tiên, 
    // nếu không lấy tất cả các vai trò được đánh dấu là nhân viên (isStaff: true)
    if (departmentIds.length > 0) {
        filter.departmentId = { $in: departmentIds };
    } else {
        filter.isStaff = true;
    }

    const roles = await Role.find(filter).select("_id");

    return roles.map((item) => item._id);
};

const getBoardingHotelStaffAccounts = async (staffIds?: string[]) => {
    const roleIds = await getBoardingHotelStaffRoleIds();
    if (!roleIds.length) return [];

    const filter: any = {
        deleted: false,
        status: "active",
        roles: { $in: roleIds },
    };

    if (staffIds !== undefined) {
        if (staffIds.length === 0) return [];
        filter._id = { $in: staffIds };
    }

    return AccountAdmin.find(filter)
        .select("fullName phone email avatar employeeCode")
        .sort({ fullName: 1 })
        .lean();
};

const getCurrentBoardingStaffId = (req: Request) => normalizeObjectIdString((req as any).user?.id);
const getCurrentBoardingStaffName = (req: Request) => String((req as any).user?.fullName || (req as any).user?.name || "").trim();

const filterCareItemsByStaff = (items: any[], staffId: string) => {
    if (!Array.isArray(items) || !staffId) return [];
    return items.filter((item: any) => {
        const assignedId = normalizeObjectIdString(item?.staffId?._id || item?.staffId);
        return !assignedId || assignedId === staffId;
    });
};

const filterBookingCareScheduleForStaffView = (booking: any, staffId: string) => {
    const plain = booking?.toObject ? booking.toObject() : { ...booking };
    plain.feedingSchedule = filterCareItemsByStaff(plain.feedingSchedule, staffId);
    plain.exerciseSchedule = filterCareItemsByStaff(plain.exerciseSchedule, staffId);
    return plain;
};

const mergeOwnAssignedScheduleItems = (options: {
    existingItems: any[];
    submittedItems: any[];
    currentStaffId: string;
    currentStaffName: string;
    type: "feeding" | "exercise";
}) => {
    const { existingItems, submittedItems, currentStaffId, currentStaffName, type } = options;
    const submittedById = new Map<string, any>();
    (Array.isArray(submittedItems) ? submittedItems : []).forEach((item: any) => {
        const id = normalizeObjectIdString(item?._id);
        if (id) submittedById.set(id, item);
    });

    const result = (Array.isArray(existingItems) ? existingItems : []).map((existingItem: any) => {
        const assignedId = normalizeObjectIdString(existingItem?.staffId?._id || existingItem?.staffId);
        if (!currentStaffId || (assignedId && assignedId !== currentStaffId)) return existingItem;

        const existingId = normalizeObjectIdString(existingItem?._id);
        const submittedItem = existingId ? submittedById.get(existingId) : null;
        if (!submittedItem) return existingItem;

        const status = normalizeTaskStatus(submittedItem?.status);
        const doneAt = status === "done"
            ? (submittedItem?.doneAt ? new Date(submittedItem.doneAt) : new Date())
            : null;

        return {
            ...existingItem,
            note: String(submittedItem?.note || "").trim(),
            proofMedia: normalizeProofMedia(submittedItem?.proofMedia),
            status,
            doneAt,
            staffId: assignedId ? existingItem?.staffId : currentStaffId,
            staffName: assignedId ? existingItem?.staffName : String(submittedItem?.staffName || existingItem?.staffName || currentStaffName).trim(),
        };
    });

    const newSubmittedItems = (Array.isArray(submittedItems) ? submittedItems : []).filter(
        (item: any) => !normalizeObjectIdString(item?._id)
    );

    newSubmittedItems.forEach((newItem: any) => {
        result.push({
            ...newItem,
            staffId: currentStaffId,
            staffName: currentStaffName,
        });
    });

    return result;
};

const restrictSubmittedAssignedStaff = (items: any[], existingItems: any[]) => {
    const allowedStaffMap = new Map<string, string>();

    (Array.isArray(existingItems) ? existingItems : []).forEach((item: any) => {
        const staffId = item?.staffId ? String(item.staffId) : "";
        const staffName = String(item?.staffName || "").trim();
        if (staffId) {
            allowedStaffMap.set(staffId, staffName);
        }
    });

    return items.map((item: any) => {
        const staffId = item?.staffId ? String(item.staffId) : "";
        if (!staffId) {
            return {
                ...item,
                staffId: null,
                staffName: "",
            };
        }

        if (allowedStaffMap.has(staffId)) {
            return {
                ...item,
                staffName: allowedStaffMap.get(staffId) || item.staffName || "",
            };
        }

        return {
            ...item,
            staffId: null,
            staffName: "",
        };
    });
};

const sanitizeFeedingSchedule = (items: any[]): any[] => {
    return items
        .map((item) => {
            const status = normalizeTaskStatus(item?.status);
            const doneAt = status === "done"
                ? (item?.doneAt ? new Date(item.doneAt) : new Date())
                : null;
            const staffId = normalizeObjectId(item?.staffId);
            const proofMedia = normalizeProofMedia(item?.proofMedia);
            return {
                _id: normalizeObjectId(item?._id),
                time: normalizeTime(item?.time),
                food: String(item?.food || "").trim(),
                amount: String(item?.amount || "").trim(),
                note: String(item?.note || "").trim(),
                proofMedia,
                staffId,
                staffName: String(item?.staffName || "").trim(),
                status,
                doneAt
            };
        })
        .filter((item) => item.time || item.food || item.amount || item.note || item.staffId || item.proofMedia.length > 0);
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
            const proofMedia = normalizeProofMedia(item?.proofMedia);
            return {
                _id: normalizeObjectId(item?._id),
                time: normalizeTime(item?.time),
                activity: String(item?.activity || "").trim(),
                durationMinutes,
                note: String(item?.note || "").trim(),
                proofMedia,
                staffId,
                staffName: String(item?.staffName || "").trim(),
                status,
                doneAt
            };
        })
        .filter((item) => item.time || item.activity || item.durationMinutes || item.note || item.staffId || item.proofMedia.length > 0);
};

const validateDoneScheduleEvidence = (
    items: any[],
    type: "feeding" | "exercise"
): string | null => {
    const label = type === "feeding" ? "Lịch ăn" : "Lịch vận động";
    const titleField = type === "feeding" ? "food" : "activity";

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (item?.status !== "done") continue;
        const proofMedia = Array.isArray(item?.proofMedia) ? item.proofMedia : [];
        if (proofMedia.length > 0) continue;

        const title = String(item?.[titleField] || "").trim();
        return `${label} dòng ${index + 1}${title ? ` (${title})` : ""} phải có ít nhất 1 ảnh hoặc video minh chứng trước khi chuyển sang "Đã hoàn thành"`;
    }

    return null;
};

const generateBoardingCode = () => {
    const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const rand = Math.floor(100 + Math.random() * 900);
    return `BRD${stamp}${rand}`;
};

// [GET] /api/v1/admin/boarding-booking/hotel-staffs
export const listBoardingHotelStaffs = async (_req: Request, res: Response) => {
    try {
        if (!canAssignBoardingHotelStaff(_req, res)) {
            return res.status(403).json({ code: 403, message: "Ban khong co quyen gan nhan vien khach san" });
        }

        const queryDate = pickParam(_req.query.date);
        let scheduledStaffIds: string[] | undefined;

        if (queryDate) {
            const dateObj = new Date(queryDate);
            if (!Number.isNaN(dateObj.getTime())) {
                const startOfDay = new Date(dateObj);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(dateObj);
                endOfDay.setHours(23, 59, 59, 999);

                scheduledStaffIds = (await WorkSchedule.distinct("staffId", {
                    date: { $gte: startOfDay, $lte: endOfDay },
                    status: { $in: ["scheduled", "checked-in", "checked-out"] },
                })).map((item: any) => String(item));
            }
        }

        // Nếu có danh sách nhân viên trực ca thì lấy theo ca, 
        // nếu không có ai trực (có thể do chưa phân ca) thì lấy tất cả nhân viên thuộc bộ phận
        const staffs = await getBoardingHotelStaffAccounts(
            scheduledStaffIds && scheduledStaffIds.length > 0 ? scheduledStaffIds : undefined
        );

        return res.json({ code: 200, data: staffs });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Loi he thong" });
    }
};

// [POST] /api/v1/admin/boarding-booking/create
export const createBoardingBooking = async (req: Request, res: Response) => {
    let lockedCageId: string | null = null;
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

        const lockedCage = await acquireCageBookingLock(String(cageId));
        if (!lockedCage) {
            return res.status(409).json({
                code: 409,
                message: "Chuong dang duoc xu ly dat phong boi yeu cau khac, vui long thu lai sau vai giay"
            });
        }
        lockedCageId = String(lockedCage._id);

        const cage = lockedCage;
        if (!cage) {
            return res.status(404).json({ code: 404, message: "Khong tim thay chuong" });
        }
        if (cage.status === "maintenance") {
            return res.status(400).json({ code: 400, message: "Chuong dang bao tri" });
        }
        if (cage.maxWeightCapacity && Number(pet.weight || 0) > Number(cage.maxWeightCapacity)) {
            return res.status(400).json({ code: 400, message: "Thu cung vuot qua tai trong chuong" });
        }

        const overlapBookings = await BoardingBooking.find({
            cageId,
            deleted: false,
            boardingStatus: { $in: ["held", "confirmed", "checked-in"] },
            checkInDate: { $lt: checkOut },
            checkOutDate: { $gt: checkIn }
        }).select("quantity petIds").lean();
        const bookedRooms = overlapBookings.reduce((sum, booking) => sum + getBookingQuantity(booking), 0);
        const remainingRooms = Math.max(0, MAX_ROOMS_PER_CAGE - bookedRooms);
        if (remainingRooms < 1) {
            return res.status(400).json({ code: 400, message: "Chuong da het cho trong khoang thoi gian nay" });
        }

        const totalDays = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const pricePerDay = Number(cage.dailyPrice || 0);
        const subTotal = totalDays * pricePerDay;
        const finalDiscount = Math.max(Number(discount || 0), 0);
        const total = Math.max(subTotal - finalDiscount, 0);
        const defaultCareSchedule = buildDefaultBoardingCareSchedule([pet as any]);

        const depositAmount = getDepositAmount(total, paymentMethod, totalDays);
        const depositPercent = depositAmount > 0 ? COUNTER_DEPOSIT_PERCENT : 0;
        const allowBoardingStatus = ["pending", "held", "confirmed", "checked-in", "checked-out", "cancelled"];
        const allowPaymentStatus = ["unpaid", "partial", "paid", "refunded"];
        const allowPaymentMethod = ["money", "vnpay", "zalopay", "pay_at_site", "prepaid"];

        const nextBoardingStatus = allowBoardingStatus.includes(boardingStatus) ? boardingStatus : "confirmed";
        const nextPaymentStatus = allowPaymentStatus.includes(paymentStatus) ? paymentStatus : "unpaid";
        const nextPaymentMethod = allowPaymentMethod.includes(paymentMethod) ? paymentMethod : "pay_at_site";
        const paidAmount = getPaidAmountByStatus({ total, depositAmount }, nextPaymentStatus);

        if (nextBoardingStatus === "checked-in" && depositAmount > 0 && paidAmount < depositAmount) {
            return res.status(400).json({ code: 400, message: `Don thanh toan tai quay tu ${COUNTER_DEPOSIT_MIN_DAYS} ngay tro len phai dat coc ${COUNTER_DEPOSIT_PERCENT}% truoc khi nhan chuong` });
        }

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
            depositPercent,
            depositAmount,
            paidAmount,
            paymentMethod: nextPaymentMethod,
            paymentStatus: nextPaymentStatus,
            notes: String(notes || "").trim(),
            specialCare: String(specialCare || "").trim(),
            feedingSchedule: defaultCareSchedule.feedingSchedule,
            exerciseSchedule: defaultCareSchedule.exerciseSchedule,
            boardingStatus: nextBoardingStatus,
            holdExpiresAt: nextBoardingStatus === "held" ? new Date(Date.now() + 15 * 60 * 1000) : null,
            actualCheckInDate: nextBoardingStatus === "checked-in" ? new Date() : null,
            actualCheckOutDate: nextBoardingStatus === "checked-out" ? new Date() : null,
            cancelledAt: nextBoardingStatus === "cancelled" ? new Date() : null,
            cancelledBy: nextBoardingStatus === "cancelled" ? "admin" : null,
            cancelledReason: nextBoardingStatus === "cancelled" ? "Admin tao don o trang thai huy" : null,
        });

        booking.search = convertToSlug(`${booking.code} ${booking.fullName || ""} ${booking.phone || ""}`).replace(/-/g, " ");
        await booking.save();

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
    } finally {
        if (lockedCageId) {
            try {
                await releaseCageBookingLock(lockedCageId);
            } catch (_) {
                // no-op
            }
        }
    }
};

// [GET] /api/v1/admin/boarding-booking
export const listBoardingBookings = async (req: Request, res: Response) => {
    try {
        const { search, status, paymentStatus } = req.query as Record<string, string>;
        const filter: any = { deleted: false };
        const canAssignHotelStaff = canAssignBoardingHotelStaff(req, res);
        const currentStaffId = getCurrentBoardingStaffId(req);

        if (status) filter.boardingStatus = status;
        if (paymentStatus) filter.paymentStatus = paymentStatus;

        const andConditions: any[] = [];
        const keyword = req.query.keyword || req.query.q || req.query.search;
        if (keyword) {
            const cleanCode = String(keyword).replace(/^#/, "");
            const keywordRegex = new RegExp(String(keyword), "i");
            const codeRegex = new RegExp(cleanCode, "i");
            const slugKeyword = convertToSlug(String(keyword)).replace(/-/g, " ");

            andConditions.push({
                $or: [
                    { search: new RegExp(slugKeyword, "i") },
                    { code: codeRegex },
                    { fullName: keywordRegex },
                    { phone: keywordRegex },
                ]
            });
        }

        if (!canAssignHotelStaff) {
            if (!currentStaffId) {
                return res.status(403).json({ code: 403, message: "Ban khong co quyen xem lich cham soc nay" });
            }
            andConditions.push({
                $or: [
                    { "feedingSchedule.staffId": currentStaffId },
                    { "exerciseSchedule.staffId": currentStaffId },
                    { "feedingSchedule.staffId": null },
                    { "exerciseSchedule.staffId": null },
                ]
            });
        }

        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }

        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const [recordList, totalRecords, counts] = await Promise.all([
            BoardingBooking.find(filter)
                .populate("userId", "fullName phone email avatar")
                .populate("petIds", "name type breed avatar weight")
                .populate("cageId", "cageCode type size dailyPrice status")
                .populate("feedingSchedule.staffId", "fullName phone employeeCode")
                .populate("exerciseSchedule.staffId", "fullName phone employeeCode")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            BoardingBooking.countDocuments(filter),
            BoardingBooking.aggregate([
                { $match: { deleted: false } },
                { $group: { _id: "$boardingStatus", count: { $sum: 1 } } }
            ])
        ]);

        const statusCounts: any = {
            all: await BoardingBooking.countDocuments({ deleted: false }),
            pending: 0,
            held: 0,
            confirmed: 0,
            "checked-in": 0,
            "checked-out": 0,
            cancelled: 0
        };

        counts.forEach((item: any) => {
            if (statusCounts.hasOwnProperty(item._id)) {
                statusCounts[item._id] = item.count;
            }
        });

        const processedList = !canAssignHotelStaff && currentStaffId
            ? recordList.map((booking: any) => filterBookingCareScheduleForStaffView(booking, currentStaffId))
            : recordList;

        return res.json({
            code: 200,
            data: {
                recordList: processedList,
                statusCounts,
                pagination: {
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limit),
                    currentPage: page,
                    limit
                }
            }
        });
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

        const canAssignHotelStaff = canAssignBoardingHotelStaff(req, res);
        const currentStaffId = getCurrentBoardingStaffId(req);

        const booking = await BoardingBooking.findOne({ _id: id, deleted: false })
            .populate("userId", "fullName phone email avatar")
            .populate("petIds", "name type breed avatar weight")
            .populate("cageId", "cageCode type size dailyPrice status description avatar amenities")
            .populate("feedingSchedule.staffId", "fullName phone employeeCode")
            .populate("exerciseSchedule.staffId", "fullName phone employeeCode");

        if (!booking) return res.status(404).json({ code: 404, message: "Khong tim thay don khach san" });

        if (!canAssignHotelStaff) {
            if (!currentStaffId) {
                return res.status(403).json({ code: 403, message: "Ban khong co quyen xem lich cham soc nay" });
            }
            const filteredBooking = filterBookingCareScheduleForStaffView(booking, currentStaffId);
            const hasAssignedItems = (filteredBooking.feedingSchedule?.length || 0) + (filteredBooking.exerciseSchedule?.length || 0) > 0;
            if (!hasAssignedItems) {
                return res.status(403).json({ code: 403, message: "Ban khong co quyen xem lich cham soc nay" });
            }
            return res.json({ code: 200, data: filteredBooking });
        }

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

        if (boardingStatus === "checked-in" && !hasSatisfiedCheckInPayment(booking)) {
            return res.status(400).json({ code: 400, message: `Don thanh toan tai quay tu ${COUNTER_DEPOSIT_MIN_DAYS} ngay tro len phai dat coc ${COUNTER_DEPOSIT_PERCENT}% truoc khi nhan chuong` });
        }

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
        if (!["unpaid", "partial", "paid", "refunded"].includes(paymentStatus)) {
            return res.status(400).json({ code: 400, message: "Trang thai thanh toan khong hop le" });
        }

        const booking = await BoardingBooking.findOne({ _id: id, deleted: false });
        if (!booking) return res.status(404).json({ code: 404, message: "Khong tim thay don khach san" });

        const nextPaidAmount = getPaidAmountByStatus(booking, paymentStatus);
        const updatePayload: any = {
            paymentStatus,
            paidAmount: nextPaidAmount,
        };
        if ((paymentStatus === "partial" || paymentStatus === "paid") && String(booking.boardingStatus || "") === "held") {
            updatePayload.boardingStatus = "confirmed";
            updatePayload.holdExpiresAt = null;
        }

        const updated = await BoardingBooking.findOneAndUpdate(
            { _id: id, deleted: false },
            updatePayload,
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

        const { feedingSchedule, exerciseSchedule, careDate, resetTemplate } = req.body as {
            feedingSchedule?: any[];
            exerciseSchedule?: any[];
            careDate?: string;
            resetTemplate?: boolean;
        };

        if (feedingSchedule !== undefined && !Array.isArray(feedingSchedule)) {
            return res.status(400).json({ code: 400, message: "feedingSchedule phai la mang" });
        }
        if (exerciseSchedule !== undefined && !Array.isArray(exerciseSchedule)) {
            return res.status(400).json({ code: 400, message: "exerciseSchedule phai la mang" });
        }
        const booking: any = await BoardingBooking.findOne({ _id: id, deleted: false });
        if (!booking) return res.status(404).json({ code: 404, message: "Khong tim thay don khach san" });

        const canAssignHotelStaff = canAssignBoardingHotelStaff(req, res);
        const currentStaffId = getCurrentBoardingStaffId(req);
        const currentStaffName = getCurrentBoardingStaffName(req);

        if (!canAssignHotelStaff && !currentStaffId) {
            return res.status(403).json({ code: 403, message: "Ban khong co quyen cap nhat lich cham soc nay" });
        }

        if (resetTemplate) {
            if (!canAssignHotelStaff) {
                return res.status(403).json({ code: 403, message: "Ban khong co quyen tao lai lich mau" });
            }
            const pets = await Pet.find({
                _id: { $in: Array.isArray(booking.petIds) ? booking.petIds : [] },
                deleted: false,
            }).select("type weight name").lean();

            const template = buildDefaultBoardingCareSchedule(pets as any[]);
            booking.feedingSchedule = template.feedingSchedule;
            booking.exerciseSchedule = template.exerciseSchedule;
            await booking.save();

            return res.json({
                code: 200,
                message: "Da tao lai lich mau theo loai thu cung",
                data: booking
            });
        }

        const visibleExistingFeeding = !canAssignHotelStaff
            ? filterCareItemsByStaff(Array.isArray(booking.feedingSchedule) ? booking.feedingSchedule : [], currentStaffId || "")
            : Array.isArray(booking.feedingSchedule) ? booking.feedingSchedule : [];
        const visibleExistingExercise = !canAssignHotelStaff
            ? filterCareItemsByStaff(Array.isArray(booking.exerciseSchedule) ? booking.exerciseSchedule : [], currentStaffId || "")
            : Array.isArray(booking.exerciseSchedule) ? booking.exerciseSchedule : [];

        const sanitizedFeeding = feedingSchedule !== undefined
            ? (
                canAssignHotelStaff
                    ? sanitizeFeedingSchedule(feedingSchedule)
                    : restrictSubmittedAssignedStaff(
                        sanitizeFeedingSchedule(feedingSchedule),
                        visibleExistingFeeding
                    )
            ).slice(0, 30)
            : undefined;
        const sanitizedExercise = exerciseSchedule !== undefined
            ? (
                canAssignHotelStaff
                    ? sanitizeExerciseSchedule(exerciseSchedule)
                    : restrictSubmittedAssignedStaff(
                        sanitizeExerciseSchedule(exerciseSchedule),
                        visibleExistingExercise
                    )
            ).slice(0, 30)
            : undefined;

        const feedingEvidenceError = sanitizedFeeding !== undefined
            ? validateDoneScheduleEvidence(sanitizedFeeding, "feeding")
            : null;
        if (feedingEvidenceError) {
            return res.status(400).json({ code: 400, message: feedingEvidenceError });
        }

        const exerciseEvidenceError = sanitizedExercise !== undefined
            ? validateDoneScheduleEvidence(sanitizedExercise, "exercise")
            : null;
        if (exerciseEvidenceError) {
            return res.status(400).json({ code: 400, message: exerciseEvidenceError });
        }

        const staffIds = Array.from(new Set(
            [
                ...(sanitizedFeeding || []).map((item: any) => item?.staffId ? String(item.staffId) : ""),
                ...(sanitizedExercise || []).map((item: any) => item?.staffId ? String(item.staffId) : ""),
            ].filter(Boolean)
        ));

        if (staffIds.length > 0) {
            const existingAssignedStaffIds = new Set(
                [
                    ...(Array.isArray(booking.feedingSchedule) ? booking.feedingSchedule : []).map((item: any) => item?.staffId ? String(item.staffId) : ""),
                    ...(Array.isArray(booking.exerciseSchedule) ? booking.exerciseSchedule : []).map((item: any) => item?.staffId ? String(item.staffId) : ""),
                ].filter(Boolean)
            );

            const hotelStaffs = await getBoardingHotelStaffAccounts(staffIds);
            const hotelStaffSet = new Set(hotelStaffs.map((item: any) => String(item._id)));
            const invalidDepartmentIds = staffIds.filter((staffId) => !hotelStaffSet.has(staffId) && !existingAssignedStaffIds.has(staffId));

            if (invalidDepartmentIds.length > 0) {
                const invalidStaffs = await AccountAdmin.find({ _id: { $in: invalidDepartmentIds } }).select("fullName").lean();
                const invalidNames = invalidStaffs.map((item: any) => item.fullName).filter(Boolean);
                return res.status(400).json({
                    code: 400,
                    message: `${invalidNames.join(", ") || "Nhan vien duoc chon"} khong thuoc Ban khach san nen khong the gan vao lich cham soc khach san`,
                });
            }

            const hotelStaffIds = staffIds.filter((staffId) => hotelStaffSet.has(staffId));
            if (hotelStaffIds.length > 0) {
                const baseDateRaw = careDate || booking.checkInDate;
                const baseDate = new Date(baseDateRaw);
                if (!Number.isNaN(baseDate.getTime())) {
                    const startOfDay = new Date(baseDate);
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(baseDate);
                    endOfDay.setHours(23, 59, 59, 999);

                    const schedules = await WorkSchedule.find({
                        staffId: { $in: hotelStaffIds },
                        date: { $gte: startOfDay, $lte: endOfDay },
                        status: { $in: ["scheduled", "checked-in", "checked-out"] },
                    }).select("staffId").lean();

                    const availableSet = new Set(schedules.map((item: any) => String(item.staffId)));
                    const unavailableIds = hotelStaffIds.filter((staffId) => !availableSet.has(staffId));

                    if (unavailableIds.length > 0) {
                        const staffNames = hotelStaffs
                            .filter((item: any) => unavailableIds.includes(String(item._id)))
                            .map((item: any) => item.fullName)
                            .filter(Boolean);
                        const dateText = `${String(startOfDay.getDate()).padStart(2, "0")}/${String(startOfDay.getMonth() + 1).padStart(2, "0")}/${startOfDay.getFullYear()}`;
                        return res.status(400).json({
                            code: 400,
                            message: `${staffNames.join(", ") || "Nhan vien duoc chon"} khong co lich lam viec ngay ${dateText}`,
                        });
                    }
                }
            }
        }

        if (sanitizedFeeding !== undefined) {
            booking.feedingSchedule = canAssignHotelStaff
                ? sanitizedFeeding
                : mergeOwnAssignedScheduleItems({
                    existingItems: Array.isArray(booking.feedingSchedule) ? booking.feedingSchedule : [],
                    submittedItems: sanitizedFeeding,
                    currentStaffId: currentStaffId || "",
                    currentStaffName: currentStaffName || "",
                    type: "feeding",
                });
        }
        if (sanitizedExercise !== undefined) {
            booking.exerciseSchedule = canAssignHotelStaff
                ? sanitizedExercise
                : mergeOwnAssignedScheduleItems({
                    existingItems: Array.isArray(booking.exerciseSchedule) ? booking.exerciseSchedule : [],
                    submittedItems: sanitizedExercise,
                    currentStaffId: currentStaffId || "",
                    currentStaffName: currentStaffName || "",
                    type: "exercise",
                });
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
