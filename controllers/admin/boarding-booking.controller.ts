import { Request, Response } from "express";
import mongoose from "mongoose";
import dayjs from "dayjs";
import BoardingBooking from "../../models/boarding-booking.model";
import BoardingCage from "../../models/boarding-cage.model";
import BoardingConfig from "../../models/boarding-config.model";
import AccountAdmin from "../../models/account-admin.model";
import AccountUser from "../../models/account-user.model";
import Department from "../../models/department.model";
import Pet from "../../models/pet.model";
import Role from "../../models/role.model";
import WorkSchedule from "../../models/work-schedule.model";
import BoardingPetDiary from "../../models/boarding-pet-diary.model";
import { buildDefaultBoardingCareSchedule } from "../../utils/boarding-care-template.util";
import { convertToSlug } from "../../helpers/slug.helper";

const MAX_ROOMS_PER_CAGE = Math.max(1, Number(process.env.BOARDING_CAGE_CAPACITY || 4));
const DEFAULT_HOLD_MINUTES = Number(process.env.BOARDING_HOLD_MINUTES || 5);

import {
    getFreestBoardingStaffForDate,
    getBoardingHotelStaffAccounts
} from "../../helpers/boarding-staff-assignment.helper";

const BOOKING_LOCK_MS = Math.max(3000, Number(process.env.BOARDING_BOOKING_LOCK_MS || 8000));

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

const shouldRequireCounterDeposit = (paymentMethod: string, totalDays: number, config: any) =>
    String(paymentMethod || "").toLowerCase() === "pay_at_site" && Number(totalDays || 0) >= (config?.minDaysForDeposit || 2);

const getDepositAmount = (total: number, paymentMethod: string, totalDays: number, config: any) => {
    if (!shouldRequireCounterDeposit(paymentMethod, totalDays, config)) return 0;
    const percent = config?.depositPercentage || 20;
    return Math.floor((total * percent) / 100);
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

const getCurrentBoardingStaffId = (req: Request, res: Response) => normalizeObjectIdString(res.locals.accountAdmin?._id || (req as any).user?.id);
const getCurrentBoardingStaffName = (req: Request, res: Response) => String(res.locals.accountAdmin?.fullName || (req as any).user?.fullName || (req as any).user?.name || "").trim();

const filterCareItemsByStaff = (items: any[], staffId: string) => {
    if (!Array.isArray(items) || !staffId) return [];
    return items.filter((item: any) => {
        const assignedId = normalizeObjectIdString(item?.staffId?._id || item?.staffId);
        return assignedId === staffId;
    });
};

const filterBookingCareScheduleForStaffView = (booking: any, staffId: string) => {
    const plain = booking?.toObject ? booking.toObject() : { ...booking };
    plain.feedingSchedule = filterCareItemsByStaff(plain.feedingSchedule, staffId);
    plain.exerciseSchedule = filterCareItemsByStaff(plain.exerciseSchedule, staffId);
    return plain;
};

const buildCareScheduleSummary = (booking: any, currentStaffId?: string | null) => {
    const feedingSchedule = Array.isArray(booking?.feedingSchedule) ? booking.feedingSchedule : [];
    const exerciseSchedule = Array.isArray(booking?.exerciseSchedule) ? booking.exerciseSchedule : [];
    const normalizeStaff = (value: any) => normalizeObjectIdString(value?._id || value);

    const hasMyAssigned = Boolean(currentStaffId) && (
        feedingSchedule.some((item: any) => normalizeStaff(item?.staffId) === currentStaffId) ||
        exerciseSchedule.some((item: any) => normalizeStaff(item?.staffId) === currentStaffId)
    );

    return {
        feedingCount: feedingSchedule.length,
        exerciseCount: exerciseSchedule.length,
        feedingAssignedCount: feedingSchedule.filter((item: any) => Boolean(normalizeStaff(item?.staffId))).length,
        exerciseAssignedCount: exerciseSchedule.filter((item: any) => Boolean(normalizeStaff(item?.staffId))).length,
        hasMyAssigned,
    };
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

        const updatedItem: any = {
            ...existingItem,
            note: String(submittedItem?.note || "").trim(),
            proofMedia: normalizeProofMedia(submittedItem?.proofMedia),
            status,
            doneAt,
            time: String(submittedItem?.time || "").trim() || existingItem.time,
            staffId: assignedId ? existingItem?.staffId : currentStaffId,
            staffName: assignedId ? existingItem?.staffName : String(submittedItem?.staffName || existingItem?.staffName || currentStaffName).trim(),
        };

        if (type === "feeding") {
            updatedItem.food = String(submittedItem?.food || "").trim() || existingItem.food;
            updatedItem.amount = String(submittedItem?.amount || "").trim() || existingItem.amount;
        } else if (type === "exercise") {
            updatedItem.activity = String(submittedItem?.activity || "").trim() || existingItem.activity;
            updatedItem.durationMinutes = submittedItem?.durationMinutes !== undefined ? submittedItem.durationMinutes : existingItem.durationMinutes;
        }

        return updatedItem;
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
                doneAt,
                petId: normalizeObjectId(item?.petId),
                petName: String(item?.petName || "").trim(),
                petType: String(item?.petType || "all").trim()
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
                doneAt,
                petId: normalizeObjectId(item?.petId),
                petName: String(item?.petName || "").trim(),
                petType: String(item?.petType || "all").trim()
            };
        })
        .filter((item) => item.time || item.activity || item.durationMinutes || item.note || item.staffId || item.proofMedia.length > 0);
};

const sanitizeBelongings = (items: any[]): any[] => {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => {
            const status = String(item?.status || "received").toLowerCase() === "returned" ? "returned" : "received";
            const returnedAt = status === "returned"
                ? (item?.returnedAt ? new Date(item.returnedAt) : new Date())
                : (item?.returnedAt ? new Date(item.returnedAt) : null);

            return {
                _id: normalizeObjectId(item?._id),
                name: String(item?.name || "").trim(),
                description: String(item?.description || "").trim(),
                quantity: Math.max(1, Number(item?.quantity || 1)),
                status,
                images: Array.isArray(item?.images) ? item.images.map((img: any) => String(img).trim()).filter(Boolean) : [],
                receivedAt: item?.receivedAt ? new Date(item.receivedAt) : new Date(),
                returnedAt
            };
        })
        .filter((item) => item.name);
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

        // 2. Lấy thông tin tài khoản của các nhân viên này
        const staffs = await getBoardingHotelStaffAccounts(
            scheduledStaffIds && scheduledStaffIds.length > 0 ? scheduledStaffIds : undefined
        );

        if (staffs.length === 0) {
            return res.json({ code: 200, data: [] });
        }

        // 3. Tính toán "tải trọng" (workload) dựa trên số lượng thú cưng (item) đang được gán
        const config = await BoardingConfig.findOne() || { maxCagesPerStaff: 10 };
        const maxLimit = config.maxCagesPerStaff || 10;

        const staffWorkloads = await Promise.all(staffs.map(async (staff) => {
            const staffIdStr = String(staff._id);

            const activeBookings = await BoardingBooking.find({
                deleted: false,
                boardingStatus: { $in: ["confirmed", "checked-in"] },
                $or: [
                    { "feedingSchedule.staffId": staffIdStr },
                    { "exerciseSchedule.staffId": staffIdStr }
                ]
            }).select("feedingSchedule exerciseSchedule").lean();

            let itemWorkload = 0;
            activeBookings.forEach(b => {
                const petsForStaff = new Set<string>();
                (b.feedingSchedule || []).forEach((f: any) => {
                    if (String(f.staffId?._id || f.staffId) === staffIdStr && f.petId) {
                        petsForStaff.add(String(f.petId?._id || f.petId));
                    }
                });
                (b.exerciseSchedule || []).forEach((e: any) => {
                    if (String(e.staffId?._id || e.staffId) === staffIdStr && e.petId) {
                        petsForStaff.add(String(e.petId?._id || e.petId));
                    }
                });
                itemWorkload += petsForStaff.size;
            });

            return {
                ...staff,
                workload: itemWorkload,
                maxLimit,
                isFull: itemWorkload >= maxLimit
            };
        }));

        // Sắp xếp: workload thấp nhất lên đầu
        staffWorkloads.sort((a, b) => a.workload - b.workload);

        return res.json({ code: 200, data: staffWorkloads });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Loi he thong" });
    }
};

// [POST] /api/v1/admin/boarding-booking/batch-create
export const batchCreateBoardingBooking = async (req: Request, res: Response) => {
    try {
        const {
            userId,
            checkInDate,
            checkOutDate,
            fullName,
            phone,
            email,
            paymentMethod = "pay_at_site",
            paymentStatus = "unpaid",
            boardingStatus = "confirmed",
            items = [], // Array<{ petId, cageId, discount, notes, specialCare }>
        } = req.body;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ code: 400, message: "Khách hàng không hợp lệ" });
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ code: 400, message: "Danh sách thú cưng và chuồng không hợp lệ" });
        }
        if (!checkInDate || !checkOutDate) {
            return res.status(400).json({ code: 400, message: "Thiếu ngày nhận hoặc ngày trả chuồng" });
        }

        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
            return res.status(400).json({ code: 400, message: "Khoảng thời gian lưu trú không hợp lệ" });
        }

        const user = await AccountUser.findOne({ _id: userId, deleted: false }).lean();
        if (!user) {
            return res.status(404).json({ code: 404, message: "Không tìm thấy khách hàng" });
        }

        const config = await BoardingConfig.findOne() || { depositPercentage: 20, minDaysForDeposit: 2 };

        const totalDays = Math.max(1, dayjs(checkOut).startOf('day').diff(dayjs(checkIn).startOf('day'), 'day'));
        const createdBookings = [];
        const sharedCode = generateBoardingCode();

        // Pre-fetch all pets and cages to validate and use later
        const petIds = items.map(i => i.petId);
        const cageIds = items.map(i => i.cageId);

        const pets = await Pet.find({ _id: { $in: petIds }, userId, deleted: false }).select("name type breed weight age avatar").lean();
        const cages = await BoardingCage.find({ _id: { $in: cageIds }, deleted: false }).lean();

        // Check if any pet already has a booking in this period
        const overlappingBookings = await BoardingBooking.find({
            deleted: false,
            boardingStatus: { $nin: ["cancelled"] },
            $or: [
                { petIds: { $in: petIds } },
                { petId: { $in: petIds } }
            ],
            checkInDate: { $lt: checkOut },
            checkOutDate: { $gt: checkIn }
        }).select("petIds petId code").lean();

        if (overlappingBookings.length > 0) {
            const allBusyPetIds = new Set([
                ...overlappingBookings.flatMap(b => (b.petIds || []).map(id => String(id))),
                ...overlappingBookings.map(b => (b as any).petId ? String((b as any).petId) : "").filter(Boolean)
            ]);
            const foundPet = pets.find(p => allBusyPetIds.has(String(p._id)));
            const bookingRef = overlappingBookings[0].code ? ` (Đơn #${overlappingBookings[0].code})` : "";
            return res.status(400).json({
                code: 400,
                message: `Thú cưng ${foundPet?.name || "của bạn"} đã có lịch đặt khách sạn trong thời gian này${bookingRef}. Vui lòng kiểm tra lại.`
            });
        }

        const allOrderItems: any[] = [];
        const allFeeding: any[] = [];
        const allExercise: any[] = [];
        const batchWorkload: Record<string, number> = {};
        let totalSubTotal = 0;
        let totalDiscount = 0;
        let totalOrderTotal = 0;

        for (const item of items) {
            const pet = pets.find(p => String(p._id) === String(item.petId));
            const cage = cages.find(c => String(c._id) === String(item.cageId));

            if (!pet) return res.status(400).json({ code: 400, message: `Thú cưng ${item.petId} không thuộc khách hàng đã chọn` });

            if ((Number(pet.age) || 0) < 6) {
                return res.status(400).json({
                    code: 400,
                    message: `Thú cưng ${pet.name} chưa đủ 6 tháng tuổi (Hiện tại: ${pet.age} tháng). Khách sạn chỉ nhận thú cưng từ 6 tháng tuổi trở lên.`
                });
            }
            if (!cage) return res.status(400).json({ code: 400, message: `Không tìm thấy chuồng ${item.cageId}` });
            if (cage.status === "maintenance") return res.status(400).json({ code: 400, message: `Chuồng ${cage.cageCode} đang bảo trì` });
            if (cage.maxWeightCapacity && Number(pet.weight || 0) > Number(cage.maxWeightCapacity)) {
                return res.status(400).json({ code: 400, message: `Thú cưng ${pet.name} vượt quá tải trọng chuồng ${cage.cageCode}` });
            }

            // Check overlap
            const overlapBookings = await BoardingBooking.find({
                cageId: item.cageId,
                deleted: false,
                boardingStatus: { $in: ["held", "confirmed", "checked-in"] },
                checkInDate: { $lt: checkOut },
                checkOutDate: { $gt: checkIn }
            }).select("quantity petIds items").lean();

            const bookedRooms = overlapBookings.reduce((sum, b) => {
                // If the booking has items, we should count relevant cage usage
                if (Array.isArray(b.items) && b.items.length > 0) {
                    const cageItems = b.items.filter((ci: any) => String(ci.cageId) === String(item.cageId));
                    return sum + cageItems.reduce((s: number, ci: any) => s + (Array.isArray(ci.petIds) ? ci.petIds.length : 1), 0);
                }
                return sum + getBookingQuantity(b);
            }, 0);

            if (bookedRooms >= MAX_ROOMS_PER_CAGE) {
                return res.status(400).json({ code: 400, message: `Chuồng ${cage.cageCode} đã hết chỗ trong khoảng thời gian này` });
            }

            const pricePerDay = Number(cage.dailyPrice || 0);
            const subTotal = totalDays * pricePerDay;
            const finalDiscount = Math.max(Number(item.discount || 0), 0);
            const total = Math.max(subTotal - finalDiscount, 0);

            totalSubTotal += subTotal;
            totalDiscount += finalDiscount;
            totalOrderTotal += total;

            const defaultStaff = await getFreestBoardingStaffForDate(checkIn, batchWorkload);
            if (!defaultStaff) {
                (item as any).noStaffWarning = true;
            } else {
                batchWorkload[defaultStaff.staffId] = (batchWorkload[defaultStaff.staffId] || 0) + 1;
            }
            const defaultCareSchedule = buildDefaultBoardingCareSchedule(
                [pet as any],
                defaultStaff,
                undefined,
                undefined,
                { careDate: checkIn, checkInDate: checkIn }
            );

            allOrderItems.push({
                cageId: item.cageId,
                petIds: [item.petId],
                pricePerDay,
                subTotal,
                discount: finalDiscount,
                total,
                notes: String(item.notes || "").trim(),
                specialCare: String(item.specialCare || "").trim()
            });

            allFeeding.push(...defaultCareSchedule.feedingSchedule);
            allExercise.push(...defaultCareSchedule.exerciseSchedule);
        }

        const depositAmount = getDepositAmount(totalOrderTotal, paymentMethod, totalDays, config);
        const depositPercent = depositAmount > 0 ? (config.depositPercentage || 20) : 0;
        const paidAmount = getPaidAmountByStatus({ total: totalOrderTotal, depositAmount }, paymentStatus);

        const booking = await BoardingBooking.create({
            code: sharedCode,
            userId,
            petIds: Array.from(new Set(items.map(i => i.petId))),
            cageId: items[0].cageId, // Representative cage for listing/backward-compat
            items: allOrderItems,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            numberOfDays: totalDays,
            fullName: String(fullName || user.fullName || "").trim(),
            phone: String(phone || user.phone || "").trim(),
            email: String(email || user.email || "").trim(),
            pricePerDay: allOrderItems[0].pricePerDay,
            subTotal: totalSubTotal,
            discount: totalDiscount,
            total: totalOrderTotal,
            depositPercent,
            depositAmount,
            paidAmount,
            paymentMethod,
            paymentStatus,
            notes: "",
            specialCare: "",
            feedingSchedule: allFeeding,
            exerciseSchedule: allExercise,
            boardingStatus: boardingStatus,
            holdExpiresAt: boardingStatus === "held" ? new Date(Date.now() + DEFAULT_HOLD_MINUTES * 60 * 1000) : null,
            actualCheckInDate: boardingStatus === "checked-in" ? new Date() : null,
            actualCheckOutDate: boardingStatus === "checked-out" ? new Date() : null,
            search: ""
        });

        booking.search = convertToSlug(`${booking.code} ${booking.fullName || ""} ${booking.phone || ""}`).replace(/-/g, " ");
        await booking.save();
        createdBookings.push(booking);

        const hasStaffWarning = items.some(i => (i as any).noStaffWarning);
        const warningSuffix = hasStaffWarning ? ". LƯU Ý: Đã hết nhân viên rảnh, một số đơn chưa được gán người phụ trách!" : "";

        return res.json({
            code: 200,
            message: `Đã tạo thành công ${createdBookings.length} đơn đặt${warningSuffix}`,
            data: createdBookings,
            warning: hasStaffWarning ? "staff_limit_exceeded" : null
        });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Lỗi hệ thống" });
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

        const config = await BoardingConfig.findOne() || {
            checkInTime: "14:00",
            checkOutTime: "12:00",
            depositPercentage: 20,
            minDaysForDeposit: 2
        };

        const [inH, inM] = (config.checkInTime || "14:00").split(":").map(Number);
        const [outH, outM] = (config.checkOutTime || "12:00").split(":").map(Number);

        const checkIn = dayjs(checkInDate).startOf("day").set("hour", inH).set("minute", inM).toDate();
        const checkOut = dayjs(checkOutDate).startOf("day").set("hour", outH).set("minute", outM).toDate();

        if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
            return res.status(400).json({ code: 400, message: "Khoang thoi gian luu tru khong hop le" });
        }

        const user = await AccountUser.findOne({ _id: userId, deleted: false }).lean();
        if (!user) {
            return res.status(404).json({ code: 404, message: "Khong tim thay khach hang" });
        }

        const pet = await Pet.findOne({ _id: petId, userId, deleted: false }).select("name type breed weight age avatar").lean();
        if (!pet) {
            return res.status(400).json({ code: 400, message: "Thu cung khong thuoc khach hang da chon" });
        }

        if ((Number(pet.age) || 0) < 6) {
            return res.status(400).json({
                code: 400,
                message: `Thú cưng ${pet.name} chưa đủ 6 tháng tuổi (Hiện tại: ${pet.age} tháng). Khách sạn chỉ nhận thú cưng từ 6 tháng tuổi trở lên.`
            });
        }

        // Check if pet already has a booking in this period
        const busyPet = await BoardingBooking.findOne({
            deleted: false,
            boardingStatus: { $nin: ["cancelled"] },
            petIds: petId,
            checkInDate: { $lt: checkOut },
            checkOutDate: { $gt: checkIn }
        }).select("code").lean();

        if (busyPet) {
            const bookingRef = busyPet.code ? ` (Đơn #${busyPet.code})` : "";
            return res.status(400).json({
                code: 400,
                message: `Thú cưng ${pet?.name || "của bạn"} đã có lịch đặt khách sạn trong thời gian này${bookingRef}. Vui lòng kiểm tra lại.`
            });
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

        const totalDays = Math.max(1, dayjs(checkOut).startOf('day').diff(dayjs(checkIn).startOf('day'), 'day'));
        const pricePerDay = Number(cage.dailyPrice || 0);
        const subTotal = totalDays * pricePerDay;
        const finalDiscount = Math.max(Number(discount || 0), 0);
        const total = Math.max(subTotal - finalDiscount, 0);

        const defaultStaff = await getFreestBoardingStaffForDate(checkIn);
        let staffWarning = false;
        if (!defaultStaff) staffWarning = true;

        const defaultCareSchedule = buildDefaultBoardingCareSchedule(
            [pet as any],
            defaultStaff,
            undefined,
            undefined,
            { careDate: checkIn, checkInDate: checkIn }
        );



        const depositAmount = getDepositAmount(total, paymentMethod, totalDays, config);
        const depositPercent = depositAmount > 0 ? (config.depositPercentage || 20) : 0;
        const allowBoardingStatus = ["pending", "held", "confirmed", "checked-in", "checked-out", "cancelled"];
        const allowPaymentStatus = ["unpaid", "partial", "paid", "refunded"];
        const allowPaymentMethod = ["money", "vnpay", "zalopay", "pay_at_site", "prepaid"];

        const nextBoardingStatus = allowBoardingStatus.includes(boardingStatus) ? boardingStatus : "confirmed";
        const nextPaymentStatus = allowPaymentStatus.includes(paymentStatus) ? paymentStatus : "unpaid";
        const nextPaymentMethod = allowPaymentMethod.includes(paymentMethod) ? paymentMethod : "pay_at_site";
        const paidAmount = getPaidAmountByStatus({ total, depositAmount }, nextPaymentStatus);

        if (nextBoardingStatus === "checked-in" && depositAmount > 0 && paidAmount < depositAmount) {
            return res.status(400).json({
                code: 400,
                message: `Đơn lưu trú từ ${config.minDaysForDeposit || 2} ngày trở lên phải đặt cọc ${config.depositPercentage || 20}% trước khi nhận thú`
            });
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
            holdExpiresAt: nextBoardingStatus === "held" ? new Date(Date.now() + DEFAULT_HOLD_MINUTES * 60 * 1000) : null,
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
            .populate("petIds", "name type breed avatar weight age")
            .populate("cageId", "cageCode type size dailyPrice status");

        const warningSuffix = staffWarning ? ". LƯU Ý: Hiện không có nhân viên rảnh, đơn chưa được gán người phụ trách!" : "";
        return res.json({
            code: 200,
            message: `Tạo đơn khách sạn thành công${warningSuffix}`,
            data: created || booking,
            warning: staffWarning ? "staff_limit_exceeded" : null
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
        const currentStaffId = getCurrentBoardingStaffId(req, res);

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

        if (!canAssignHotelStaff && currentStaffId) {
            andConditions.push({
                $or: [
                    { "feedingSchedule.staffId": currentStaffId },
                    { "exerciseSchedule.staffId": currentStaffId },
                    { "boardingStatus": "checked-in" },
                    { "boardingStatus": "confirmed" } // allow seeing all upcoming for today/active
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
                .populate("petIds", "name type breed avatar weight age")
                .populate("cageId", "cageCode type size dailyPrice status")
                .populate("items.cageId", "cageCode type size dailyPrice status")
                .populate("items.petIds", "name type breed avatar weight age")
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

        const processedList = recordList.map((booking: any) => {
            // For staff management, we allow seeing all care items of checked-in pets
            // Otherwise, we filter only items assigned to the staff member
            // BUT: if we want staff to take care of ANY checked-in pet, we don't filter.
            const visibleBooking = (!canAssignHotelStaff && currentStaffId && booking.boardingStatus !== 'checked-in')
                ? filterBookingCareScheduleForStaffView(booking, currentStaffId)
                : (booking?.toObject ? booking.toObject() : booking);

            const scheduleSummary = buildCareScheduleSummary(visibleBooking, currentStaffId);

            return {
                ...visibleBooking,
                scheduleSummary
            };
        });

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

// [GET] /api/v1/admin/boarding-booking/busy-pets
export const listBusyPetIdsForRange = async (req: Request, res: Response) => {
    try {
        const userId = pickParam(req.query.userId);
        const checkInDate = pickParam(req.query.checkInDate);
        const checkOutDate = pickParam(req.query.checkOutDate);

        if (!userId || !checkInDate || !checkOutDate) {
            return res.json({ code: 200, data: [] });
        }

        const start = dayjs(checkInDate).startOf("day").toDate();
        const end = dayjs(checkOutDate).startOf("day").toDate();

        const busyBookings = await BoardingBooking.find({
            deleted: false,
            boardingStatus: { $nin: ["cancelled"] },
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        }).select("petIds cageId items quantity").lean();

        // Occupancy calculation
        const allBusyPetIds = new Set([
            ...busyBookings.flatMap(b => (b.petIds || []).map(id => String(id))),
            ...busyBookings.map(b => (b as any).petId ? String((b as any).petId) : "").filter(Boolean)
        ]);

        const busyPetIds = Array.from(allBusyPetIds).filter(id => {
            const b = busyBookings.find(bk => (bk.petIds || []).map(pid => String(pid)).includes(String(id)) || String((bk as any).petId) === String(id));
            return b && String(b.userId || "") === String(userId);
        });

        // Busy Cage Ids (regardless of user, for all cages in the hotel)
        const cageOccupancy: Record<string, number> = {};
        busyBookings.forEach(b => {
            if (Array.isArray(b.items) && b.items.length > 0) {
                b.items.forEach((ci: any) => {
                    const cid = String(ci.cageId?._id || ci.cageId);
                    cageOccupancy[cid] = (cageOccupancy[cid] || 0) + (Array.isArray(ci.petIds) ? ci.petIds.length : 1);
                });
            } else if (b.cageId) {
                const cid = String(b.cageId?._id || b.cageId);
                const qty = Math.max(1, (b.quantity || 1), (b.petIds?.length || 0));
                cageOccupancy[cid] = (cageOccupancy[cid] || 0) + qty;
            }
        });

        const busyCageIds = Object.entries(cageOccupancy)
            .filter(([_, count]) => count >= MAX_ROOMS_PER_CAGE)
            .map(([cid]) => cid);

        return res.json({
            code: 200,
            data: {
                busyPetIds,
                busyCageIds
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
        const currentStaffId = getCurrentBoardingStaffId(req, res);

        const booking = await BoardingBooking.findOne({ _id: id, deleted: false })
            .populate("userId", "fullName phone email avatar")
            .populate("petIds", "name type breed avatar weight age")
            .populate("cageId", "cageCode type size dailyPrice status description avatar amenities")
            .populate("items.cageId", "cageCode type size dailyPrice status description avatar amenities")
            .populate("items.petIds", "name type breed avatar weight age")
            .populate("feedingSchedule.staffId", "fullName phone employeeCode")
            .populate("exerciseSchedule.staffId", "fullName phone employeeCode")
            .lean();

        if (!booking) return res.status(404).json({ code: 404, message: "Khong tim thay don khach san" });

        if (!canAssignHotelStaff) {
            if (!currentStaffId) {
                return res.status(403).json({ code: 403, message: "Ban khong co quyen xem lich cham soc nay" });
            }
            const filteredBooking = filterBookingCareScheduleForStaffView(booking, currentStaffId);
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
        const { boardingStatus, cancelledReason } = req.body as { boardingStatus: string, cancelledReason?: string };
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ code: 400, message: "ID khong hop le" });
        }

        const allowStatus = ["pending", "held", "confirmed", "checked-in", "checked-out", "cancelled"];
        if (!allowStatus.includes(boardingStatus)) {
            return res.status(400).json({ code: 400, message: "Trang thai khong hop le" });
        }

        const booking: any = await BoardingBooking.findOne({ _id: id, deleted: false });
        if (!booking) return res.status(404).json({ code: 404, message: "Khong tim thay don khach san" });

        const config = await BoardingConfig.findOne() || { lateCheckOutGracePeriod: 30, surchargeHalfDayPrice: 100000, surchargeFullDayPrice: 200000, minDaysForDeposit: 2, depositPercentage: 20 };

        if (boardingStatus === "checked-in" && !hasSatisfiedCheckInPayment(booking)) {
            return res.status(400).json({
                code: 400,
                message: `Đơn lưu trú từ ${config.minDaysForDeposit || 2} ngày trở lên phải đặt cọc ${config.depositPercentage || 20}% trước khi nhận thú`
            });
        }

        const updateAllCageStatus = async (status: string) => {
            const cageIds = new Set<string>();
            if (booking.cageId) cageIds.add(String(booking.cageId));
            if (Array.isArray(booking.items)) {
                booking.items.forEach((item: any) => {
                    if (item.cageId) cageIds.add(String(item.cageId?._id || item.cageId));
                });
            }
            if (cageIds.size > 0) {
                await BoardingCage.updateMany({ _id: { $in: Array.from(cageIds) } }, { status });
            }
        };

        booking.boardingStatus = boardingStatus;

        if (boardingStatus === "checked-in") {
            booking.actualCheckInDate = new Date();
            await updateAllCageStatus("occupied");
        } else if (boardingStatus === "checked-out") {
            const actualOut = new Date();
            booking.actualCheckOutDate = actualOut;

            // Logic phụ thu: quá gracePeriod so với checkOutDate
            const scheduledOut = new Date(booking.checkOutDate);
            const diffMs = actualOut.getTime() - scheduledOut.getTime();
            const diffMins = Math.floor(diffMs / (1000 * 60));

            const gracePeriod = config?.lateCheckOutGracePeriod || 30;

            if (diffMins > gracePeriod) {
                // Tầng phụ thu: <= 6 tiếng (nửa buổi), > 6 tiếng (1 ngày)
                if (diffMins <= 360) {
                    booking.surcharge = config?.surchargeHalfDayPrice || 100000;
                    booking.surchargeReason = `Trả chuồng trễ ${diffMins} phút (quá giới hạn ${gracePeriod} phút - Phụ thu nửa buổi)`;
                } else {
                    booking.surcharge = config?.surchargeFullDayPrice || 200000;
                    booking.surchargeReason = `Trả chuồng trễ ${diffMins} phút (Phụ thu trọn 1 ngày)`;
                }

                // Gửi thông báo cho khách hàng
                try {
                    const Notification = (await import("../../models/notification.model")).default;
                    await Notification.create({
                        receiverId: booking.userId,
                        title: "Thông báo phụ thu trả chuồng trễ",
                        content: `Bạn đã trả chuồng trễ ${diffMins} phút. Phí phụ thu phát sinh là ${booking.surcharge.toLocaleString("vi-VN")}đ. Lý do: ${booking.surchargeReason}`,
                        type: "boarding",
                        metadata: {
                            boardingId: booking._id,
                            surcharge: booking.surcharge,
                            diffMins
                        },
                        status: "unread"
                    });
                } catch (notifError) {
                    console.error("Lỗi gửi thông báo phụ thu:", notifError);
                }
            } else {
                booking.surcharge = 0;
                booking.surchargeReason = "";
            }
            // Luôn cập nhật lại total để tránh sai sót
            booking.total = Math.max(0, (booking.subTotal || 0) - (booking.discount || 0) + (booking.surcharge || 0));
            await updateAllCageStatus("under-cleaning");
        } else {
            // Nếu đổi sang trạng thái khác (Confirmed, Pending...) thì reset thông tin checkout/phụ phí
            if (boardingStatus !== "cancelled") {
                booking.surcharge = 0;
                booking.surchargeReason = "";
                booking.actualCheckOutDate = null;
                booking.total = Math.max(0, (booking.subTotal || 0) - (booking.discount || 0));
            }

            if (boardingStatus === "cancelled") {
                booking.cancelledAt = new Date();
                booking.cancelledBy = "admin";
                booking.cancelledReason = (cancelledReason || "Admin cập nhật").trim();
                await updateAllCageStatus("available");
            } else if (["held", "confirmed", "pending"].includes(boardingStatus)) {
                await updateAllCageStatus("occupied");
            }
        }

        await booking.save();
        return res.json({ code: 200, message: "Cap nhat trang thai thanh cong", data: booking });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Lỗi hệ thống" });
    }
};

// [PATCH] /api/v1/admin/boarding-booking/:id/payment-status
export const updateBoardingPaymentStatus = async (req: Request, res: Response) => {
    try {
        const id = pickParam(req.params.id);
        const { paymentStatus } = req.body as { paymentStatus: string };
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ code: 400, message: "ID không hợp lệ" });
        }
        if (!["unpaid", "partial", "paid", "refunded"].includes(paymentStatus)) {
            return res.status(400).json({ code: 400, message: "Trạng thái thanh toán không hợp lệ" });
        }

        const booking = await BoardingBooking.findOne({ _id: id, deleted: false });
        if (!booking) return res.status(404).json({ code: 404, message: "Không tìm thấy đơn khách sạn" });

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

        if (!updated) return res.status(404).json({ code: 404, message: "Không tìm thấy đơn khách sạn" });
        return res.json({ code: 200, message: "Cập nhật thanh toán thành công", data: updated });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Lỗi hệ thống" });
    }
};

// [PUT] /api/v1/admin/boarding-booking/:id
export const updateBoardingBookingDetail = async (req: Request, res: Response) => {
    try {
        const id = pickParam(req.params.id);
        const data = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ code: 400, message: "ID không hợp lệ" });
        }

        const booking = await BoardingBooking.findOne({ _id: id, deleted: false });
        if (!booking) {
            return res.status(404).json({ code: 404, message: "Không tìm thấy đơn" });
        }

        // Nếu chuồng thay đổi, giải phóng chuồng cũ và chuyển sang chuồng mới
        if (booking.boardingStatus === "checked-in") {
            const oldCageIds = new Set<string>();
            const newCageIds = new Set<string>();

            if (booking.cageId) oldCageIds.add(booking.cageId.toString());
            if (Array.isArray(booking.items)) {
                booking.items.forEach((item: any) => {
                    if (item.cageId) oldCageIds.add(item.cageId.toString());
                });
            }

            if (data.cageId) newCageIds.add(data.cageId.toString());
            if (Array.isArray(data.items)) {
                data.items.forEach((item: any) => {
                    if (item.cageId) newCageIds.add(item.cageId.toString());
                });
            }

            const toEmpty = Array.from(oldCageIds).filter(id => !newCageIds.has(id));
            const toOccupied = Array.from(newCageIds).filter(id => !oldCageIds.has(id));

            if (toEmpty.length > 0) {
                await BoardingCage.updateMany({ _id: { $in: toEmpty } }, { status: "empty" });
            }
            if (toOccupied.length > 0) {
                await BoardingCage.updateMany({ _id: { $in: toOccupied } }, { status: "occupied" });
            }
        } else {
            // Cập nhật lại logic cũ để an toàn cho trường hợp khác
            if (data.cageId && data.cageId !== booking.cageId?.toString()) {
                if (booking.cageId) {
                    await BoardingCage.findByIdAndUpdate(booking.cageId, { status: "empty" });
                }
                await BoardingCage.findByIdAndUpdate(data.cageId, { status: "occupied" });
            }
        }

        // Tính lại số ngày nếu ngày nhận/trả thay đổi
        if (data.checkInDate || data.checkOutDate) {
            const config = await BoardingConfig.findOne() || { checkInTime: "14:00", checkOutTime: "12:00" };
            const [inH, inM] = (config.checkInTime || "14:00").split(":").map(Number);
            const [outH, outM] = (config.checkOutTime || "12:00").split(":").map(Number);

            const checkIn = dayjs(data.checkInDate || booking.checkInDate).startOf("day").set("hour", inH).set("minute", inM);
            const checkOut = dayjs(data.checkOutDate || booking.checkOutDate).startOf("day").set("hour", outH).set("minute", outM);

            data.checkInDate = checkIn.toDate();
            data.checkOutDate = checkOut.toDate();
            data.numberOfDays = Math.max(1, dayjs(checkOut).startOf('day').diff(dayjs(checkIn).startOf('day'), 'day'));
        }

        // Check occupancy for pets (excluding current booking)
        const petIdsToCheck = data.petIds || booking.petIds;
        if (petIdsToCheck) {
            const targetIn = dayjs(data.checkInDate || booking.checkInDate).toDate();
            const targetOut = dayjs(data.checkOutDate || booking.checkOutDate).toDate();

            const busyPet = await BoardingBooking.findOne({
                _id: { $ne: booking._id },
                deleted: false,
                boardingStatus: { $nin: ["cancelled"] },
                petIds: { $in: Array.isArray(petIdsToCheck) ? petIdsToCheck : [petIdsToCheck] },
                checkInDate: { $lt: targetOut },
                checkOutDate: { $gt: targetIn }
            }).select("code").lean();

            if (busyPet) {
                const bookingRef = busyPet.code ? ` (Đơn #${busyPet.code})` : "";
                return res.status(400).json({
                    code: 400,
                    message: `Thú cưng đã có lịch đặt khách sạn trong thời gian này${bookingRef}.`
                });
            }
        }

        // Cập nhật các trường thông tin
        Object.assign(booking, data);
        await booking.save();

        return res.json({
            code: 200,
            message: "Cập nhật thông tin đơn thành công",
            data: booking
        });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Lỗi hệ thống" });
    }
};

// [PATCH] /api/v1/admin/boarding-booking/:id/care-schedule
export const updateBoardingCareSchedule = async (req: Request, res: Response) => {
    try {
        const id = pickParam(req.params.id);
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ code: 400, message: "ID khong hop le" });
        }

        const { feedingSchedule, exerciseSchedule, belongings, careDate, resetTemplate } = req.body as {
            feedingSchedule?: any[];
            exerciseSchedule?: any[];
            belongings?: any[];
            careDate?: string;
            resetTemplate?: boolean;
        };

        if (feedingSchedule !== undefined && !Array.isArray(feedingSchedule)) {
            return res.status(400).json({ code: 400, message: "feedingSchedule phai la mang" });
        }
        if (exerciseSchedule !== undefined && !Array.isArray(exerciseSchedule)) {
            return res.status(400).json({ code: 400, message: "exerciseSchedule phai la mang" });
        }
        if (belongings !== undefined && !Array.isArray(belongings)) {
            return res.status(400).json({ code: 400, message: "belongings phai la mang" });
        }
        const booking: any = await BoardingBooking.findOne({ _id: id, deleted: false });
        if (!booking) return res.status(404).json({ code: 404, message: "Khong tim thay don khach san" });

        const canAssignHotelStaff = canAssignBoardingHotelStaff(req, res);
        const currentStaffId = getCurrentBoardingStaffId(req, res);
        const currentStaffName = getCurrentBoardingStaffName(req, res);

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
            }).select("type weight name age breed").lean();

            const template = buildDefaultBoardingCareSchedule(
                pets as any[],
                await getFreestBoardingStaffForDate(careDate || booking.checkInDate),
                undefined,
                undefined,
                { careDate: careDate || booking.checkInDate, checkInDate: booking.checkInDate }
            );
            booking.feedingSchedule = template.feedingSchedule;
            booking.exerciseSchedule = template.exerciseSchedule;
            await booking.save();

            const updatedBooking = await BoardingBooking.findById(booking._id)
                .populate("userId", "fullName phone email avatar")
                .populate("petIds", "name type breed avatar weight age")
                .populate("cageId", "cageCode type size dailyPrice status description avatar amenities")
                .populate("feedingSchedule.staffId", "fullName phone employeeCode")
                .populate("exerciseSchedule.staffId", "fullName phone employeeCode");

            return res.json({
                code: 200,
                message: "Da tao lai lich mau theo loai thu cung",
                data: updatedBooking || booking
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
            ).slice(0, 100)
            : undefined;
        const sanitizedExercise = exerciseSchedule !== undefined
            ? (
                canAssignHotelStaff
                    ? sanitizeExerciseSchedule(exerciseSchedule)
                    : restrictSubmittedAssignedStaff(
                        sanitizeExerciseSchedule(exerciseSchedule),
                        visibleExistingExercise
                    )
            ).slice(0, 100)
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

        if (belongings !== undefined) {
            booking.belongings = sanitizeBelongings(belongings);
        }

        await booking.save();

        // --- Auto-Sync To Pet Diary ---
        try {
            const feedingItems = Array.isArray(booking.feedingSchedule) ? booking.feedingSchedule : [];
            const doneFeedingItems = feedingItems.filter((item: any) => String(item.status).toLowerCase() === "done");

            if (doneFeedingItems.length > 0 && Array.isArray(booking.petIds) && booking.petIds.length > 0) {
                const careDateValue = new Date(careDate || booking.checkInDate || new Date());
                careDateValue.setHours(0, 0, 0, 0);

                for (const item of doneFeedingItems) {
                    const hour = parseInt(String(item.time || "00:00").split(":")[0]);
                    let meal = "Tối";
                    if (hour < 11) meal = "Sáng";
                    else if (hour < 16) meal = "Trưa";

                    // Chốt PetId cụ thể nếu có, nếu không sync hết như cũ (legacy logic)
                    const targetPetIds = item.petId ? [item.petId] : (Array.isArray(booking.petIds) ? booking.petIds : []);

                    for (const pId of targetPetIds) {
                        await BoardingPetDiary.findOneAndUpdate(
                            {
                                bookingId: booking._id,
                                petId: pId,
                                date: careDateValue,
                                meal: meal,
                                deleted: false
                            },
                            {
                                $set: {
                                    eatingStatus: "Hết", // Default when marking done from schedule
                                    note: item.note || "",
                                    proofMedia: item.proofMedia || [],
                                    staffId: item.staffId || currentStaffId,
                                    staffName: item.staffName || currentStaffName || "Staff"
                                }
                            },
                            { upsert: true, new: true }
                        );
                    }
                }
            }
        } catch (syncError) {
            console.error("Failed to auto-sync boarding care schedule to pet diary:", syncError);
            // Non-blocking error, we still return success for the main update
        }
        // --- End Auto-Sync ---

        const updatedBooking = await BoardingBooking.findById(booking._id)
            .populate("userId", "fullName phone email avatar")
            .populate("petIds", "name type breed avatar weight")
            .populate("cageId", "cageCode type size dailyPrice status description avatar amenities")
            .populate("feedingSchedule.staffId", "fullName phone employeeCode")
            .populate("exerciseSchedule.staffId", "fullName phone employeeCode");

        return res.json({
            code: 200,
            message: "Cap nhat lich cham soc thanh cong",
            data: updatedBooking || booking
        });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Loi he thong" });
    }
};

// [GET] /api/v1/admin/boarding-booking/availability
export const checkBoardingAvailability = async (req: Request, res: Response) => {
    try {
        const { checkInDate, checkOutDate } = req.query;
        if (!checkInDate || !checkOutDate) {
            return res.status(400).json({ code: 400, message: "Thiếu ngày check-in hoặc check-out" });
        }

        // Use dayjs to match client-side date parsing for consistency
        const start = dayjs(checkInDate as string).hour(9).minute(0).second(0).millisecond(0).toDate();
        const end = dayjs(checkOutDate as string).hour(9).minute(0).second(0).millisecond(0).toDate();

        // Get all active bookings in this period to calculate occupancy
        // Including "pending" and "held" to match client-side availability logic
        const overlappingBookings = await BoardingBooking.find({
            deleted: false,
            boardingStatus: { $in: ["pending", "held", "confirmed", "checked-in"] },
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        }).select("cageId quantity items petIds petId").lean();

        // Calculate occupancy map: cageId -> roomsUsed
        const occupancyMap: Record<string, number> = {};
        overlappingBookings.forEach(b => {
            if (Array.isArray((b as any).items) && (b as any).items.length > 0) {
                (b as any).items.forEach((item: any) => {
                    const cid = String(item.cageId?._id || item.cageId);
                    const itemQty = Array.isArray(item.petIds) ? item.petIds.length : (item.petId ? 1 : 1);
                    occupancyMap[cid] = (occupancyMap[cid] || 0) + itemQty;
                });
            } else {
                const cageIdStr = String(b.cageId?._id || b.cageId);
                let qty = Number(b.quantity || 0);
                if (qty <= 0) {
                    if (Array.isArray(b.petIds) && b.petIds.length > 0) qty = b.petIds.length;
                    else if ((b as any).petId) qty = 1;
                    else qty = 1;
                }
                occupancyMap[cageIdStr] = (occupancyMap[cageIdStr] || 0) + qty;
            }
        });

        // Get all cages to know their totalRooms
        const allCages = await BoardingCage.find({ deleted: false }).select("_id totalRooms").lean();

        const cageAvailability: Record<string, number> = {};
        const busyCageIds: string[] = [];

        allCages.forEach(cage => {
            const cageIdStr = String(cage._id);
            const total = Number((cage as any).totalRooms || 4);
            const used = occupancyMap[cageIdStr] || 0;
            const remaining = Math.max(0, total - used);

            cageAvailability[cageIdStr] = remaining;
            if (remaining <= 0) {
                busyCageIds.push(cageIdStr);
            }
        });

        // Calculate busy pets
        const busyPetIds = Array.from(new Set([
            ...overlappingBookings.flatMap(b => (b.petIds || []).map(id => String(id))),
            ...overlappingBookings.map(b => (b as any).petId ? String((b as any).petId) : "").filter(Boolean)
        ]));

        return res.json({
            code: 200,
            data: {
                busyCageIds,
                busyPetIds,
                cageAvailability
            }
        });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Lỗi hệ thống" });
    }
};
