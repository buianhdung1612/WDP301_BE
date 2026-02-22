import express, { Request, Response } from "express";
import Booking from "../../models/booking.model";
import AccountUser from "../../models/account-user.model";
import Service from "../../models/service.model";
import Pet from "../../models/pet.model";
import AccountAdmin from "../../models/account-admin.model";
import Role from "../../models/role.model";
import WorkSchedule from "../../models/work-schedule.model";
import BookingConfig from "../../models/booking-config.model";
import BookingReview from "../../models/booking-review.model";
import dayjs from "dayjs";
import puppeteer from "puppeteer";
import { autoUpdateBookingStatuses } from "../../helpers/booking-job.helper";
import { findBestStaffForBooking, autoAssignPetsToStaff } from "../../helpers/booking-assignment.helper";

// [POST] /api/v1/admin/booking/bookings/create
export const createBooking = async (req: Request, res: Response) => {
    try {
        const {
            serviceId,
            staffId,
            userId,
            petIds,
            notes,
            start,
            end,
            bookingStatus,
            paymentMethod,
            paymentStatus,
            subTotal,
            total,
            discount,
            staffIds,
            petStaffMap
        } = req.body;

        // Validate required fields
        if (!serviceId) {
            return res.status(400).json({ code: 400, message: "Vui lòng chọn dịch vụ" });
        }

        if (!start || !end) {
            return res.status(400).json({ code: 400, message: "Vui lòng chọn thời gian bắt đầu và kết thúc" });
        }

        const startDate = new Date(start);
        const endDate = new Date(end);
        const now = new Date();

        // 1. Validate past time
        if (startDate < now) {
            return res.status(400).json({ code: 400, message: "Thời gian bắt đầu không thể ở quá khứ" });
        }

        // 2. Validate minutes step (Temporarily disabled)
        /*
        if (startDate.getMinutes() % 15 !== 0 || endDate.getMinutes() % 15 !== 0) {
            return res.status(400).json({ code: 400, message: "Thời gian phải là bội số của 15 phút (00, 15, 30, 45)" });
        }
        */

        // 3. Validate working blocks (Temporarily disabled)
        /*
        const targetDate = dayjs(startDate).startOf('day');
        const schedules = await WorkSchedule.find({
            date: {
                $gte: targetDate.toDate(),
                $lte: targetDate.endOf('day').toDate()
            },
            status: { $in: ["scheduled", "checked-in"] }
        }).populate("shiftId");

        const dynamicBlocks = schedules.map(s => {
            if (s.shiftId) {
                const [sH, sM] = (s.shiftId as any).startTime.split(':').map(Number);
                const [eH, eM] = (s.shiftId as any).endTime.split(':').map(Number);
                return { start: sH * 60 + sM, end: eH * 60 + eM, label: `${(s.shiftId as any).startTime}-${(s.shiftId as any).endTime}` };
            }
            return null;
        }).filter(Boolean) as { start: number, end: number, label: string }[];

        const uniqueShiftLabels = Array.from(new Set(dynamicBlocks.map(b => b.label))).sort();

        let workingBlocks = dynamicBlocks.length > 0 ? dynamicBlocks : [
            { start: 8 * 60, end: 12 * 60 },
            { start: 13 * 60, end: 17 * 60 },
            { start: 17 * 60, end: 23 * 60 }
        ];

        const startTotalMinutes = startDate.getHours() * 60 + startDate.getMinutes();
        const endTotalMinutes = endDate.getHours() * 60 + endDate.getMinutes();

        const isValidBlock = workingBlocks.some(block =>
            startTotalMinutes >= block.start && endTotalMinutes <= block.end
        );

        if (!isValidBlock) {
            const shiftInfo = uniqueShiftLabels.length > 0 ? uniqueShiftLabels.join(", ") : "08:00-12:00, 13:00-17:00, 17:00-23:00";
            return res.status(400).json({
                code: 400,
                message: `Thời gian đặt lịch phải nằm trong các ca làm việc (${shiftInfo}) và không được vượt quá thời gian kết thúc ca.`
            });
        }
        */

        // Verify service exists
        const service = await Service.findById(serviceId);
        if (!service || service.deleted) {
            return res.status(400).json({ code: 400, message: "Dịch vụ không tồn tại" });
        }

        // Fetch user data if userId provided
        let userDetail = null;
        if (userId) {
            userDetail = await AccountUser.findById(userId);
        }

        // Generate booking code if not provided
        const bookingCode = `BK${Date.now()}`;

        // 5. Automated Staff Assignment (if no staffId selected)
        let finalStaffIds: string[] = [];
        let finalStaffId: string | null = staffId || null;
        let finalDuration = service.duration || 30;
        const numPets = Array.isArray(petIds) ? petIds.filter((id: string) => id != null && id !== "").length : 1;

        if (!staffId) {
            // "Parallel First" Strategy
            const bestStaffList = await findBestStaffForBooking(
                startDate,
                startDate,
                endDate,
                serviceId as string,
                numPets
            );

            if (bestStaffList.length > 0) {
                finalStaffIds = bestStaffList.map(s => s._id.toString());
                finalStaffId = finalStaffIds[0]; // Set staffId for backward compatibility

                // If we got enough staff for all pets -> Parallel (base duration)
                // If not enough -> Sequential (multiple duration)
                if (finalStaffIds.length < numPets) {
                    finalDuration = (service.duration || 30) * numPets;
                }
            } else {
                return res.status(400).json({
                    code: 400,
                    message: "Không tìm thấy nhân viên phù hợp cho khung giờ này."
                });
            }
        } else {
            // Manual staff selection -> Sequential (base * pets)
            finalDuration = (service.duration || 30) * numPets;
            finalStaffIds = [staffId];
        }

        // Adjust final end time based on calculated duration
        const finalEndDate = new Date(startDate.getTime() + finalDuration * 60000);

        // 6. Check for customer overlapping bookings (Same customer, overlapping time, shared pets)
        if (userId && petIds && petIds.length > 0) {
            const customerOverlap = await Booking.findOne({
                userId,
                bookingStatus: { $nin: ["cancelled", "completed"] },
                deleted: false,
                petIds: { $in: petIds },
                $or: [{ start: { $lt: finalEndDate }, end: { $gt: startDate } }]
            });

            if (customerOverlap) {
                return res.status(400).json({
                    code: 400,
                    message: "Thú cưng này đã có lịch đặt khác trong khung giờ này."
                });
            }
        }

        // Create new booking
        const newBooking = new Booking({
            code: bookingCode,
            serviceId,
            staffId: (Array.isArray(staffIds) && staffIds.length > 0) ? staffIds[0] : finalStaffId,
            staffIds: (Array.isArray(staffIds) && staffIds.length > 0) ? staffIds : finalStaffIds,
            petStaffMap: (petStaffMap && petStaffMap.length > 0)
                ? petStaffMap
                : autoAssignPetsToStaff(
                    Array.isArray(petIds) ? petIds.filter((id: string) => id != null && id !== "") : [],
                    (Array.isArray(staffIds) && staffIds.length > 0) ? staffIds : finalStaffIds
                ),
            userId: userId || null,
            petIds: Array.isArray(petIds) ? petIds.filter((id: string) => id != null && id !== "") : [],
            notes: notes || "",
            start: startDate,
            end: finalEndDate,
            bookingStatus: bookingStatus || (finalStaffId ? "confirmed" : "pending"),
            paymentMethod: paymentMethod || "money",
            paymentStatus: paymentStatus || "unpaid",
            subTotal: subTotal || (service as any).basePrice || 0,
            total: total || (service as any).basePrice * numPets || 0,
            discount: discount || 0,
            deleted: false
        });

        await newBooking.save();
        const populatedBooking = await Booking.findById(newBooking._id).populate("userId");

        res.status(201).json({
            code: 201,
            message: "Tạo lịch đặt thành công",
            data: populatedBooking
        });
    } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi tạo lịch đặt",
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

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

        // 2. Kiểm tra xem nhân viên có thuộc Role "Nhân viên thực hiện dịch vụ" (isStaff: true) không
        const roles = await Role.find({
            _id: { $in: staff.roles },
            isStaff: true,
            status: "active",
            deleted: false
        });

        if (roles.length === 0) {
            return res.status(400).json({
                code: 400,
                message: "Tài khoản này không phải là nhân viên thực hiện dịch vụ (vui lòng kiểm tra Nhóm quyền)"
            });
        }

        // 3. Kiểm tra tính khả dụng (Lịch làm việc và trùng lịch)
        if (booking.start && booking.end) {
            const startDate = booking.start;
            const endDate = booking.end;

            // 3.1 Kiểm tra ca trực
            const schedule = await WorkSchedule.findOne({
                staffId: staffId,
                date: {
                    $gte: dayjs(startDate).startOf('day').toDate(),
                    $lte: dayjs(startDate).endOf('day').toDate()
                }
            }).populate("shiftId");

            if (!schedule || !(schedule.shiftId as any)) {
                return res.status(400).json({
                    code: 400,
                    message: "Nhân viên không có lịch làm việc trong ngày này"
                });
            }

            const shift = schedule.shiftId as any;
            const [sH, sM] = shift.startTime.split(':').map(Number);
            const [eH, eM] = shift.endTime.split(':').map(Number);
            const shiftStart = sH * 60 + sM;
            const shiftEnd = eH * 60 + eM;
            const reqStartMin = startDate.getHours() * 60 + startDate.getMinutes();
            const reqEndMin = endDate.getHours() * 60 + endDate.getMinutes();

            if (reqStartMin < shiftStart || reqEndMin > shiftEnd) {
                return res.status(400).json({
                    code: 400,
                    message: `Thời gian đặt lịch (${dayjs(startDate).format("HH:mm")} - ${dayjs(endDate).format("HH:mm")}) nằm ngoài ca làm việc của nhân viên (${shift.startTime} - ${shift.endTime})`
                });
            }

            // 3.2 Kiểm tra trùng lịch
            const overlappingBooking = await Booking.findOne({
                _id: { $ne: booking._id },
                staffId: staffId,
                bookingStatus: { $in: ["confirmed", "delayed", "in-progress"] },
                deleted: false,
                start: { $lt: endDate },
                end: { $gt: startDate }
            });

            if (overlappingBooking) {
                return res.status(400).json({
                    code: 400,
                    message: `Nhân viên đã có lịch bận khác (${dayjs(overlappingBooking.start).format("HH:mm")} - ${dayjs(overlappingBooking.end).format("HH:mm")})`
                });
            }
        }

        booking.staffId = staffId;
        booking.staffIds = [staffId];
        await booking.save();

        res.json({
            code: 200,
            message: "Phân công nhân viên thành công",
            data: {
                bookingId: booking._id,
                staffName: staff.fullName,
                serviceIds: roles.flatMap(r => r.serviceIds || [])
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
        await autoUpdateBookingStatuses();
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status as string;
        const noLimit = req.query.noLimit === 'true';

        let filter: any = { deleted: false };
        if (status) {
            filter.bookingStatus = status;
        }

        if (req.query.staffId) {
            filter.$or = [
                { staffId: req.query.staffId },
                { staffIds: req.query.staffId }
            ];
        }

        // Filter by appointment date (start field)
        if (req.query.date) {
            const date = dayjs(req.query.date as string);
            filter.start = {
                $gte: date.startOf('day').toDate(),
                $lte: date.endOf('day').toDate()
            };
        } else if (req.query.startTime && req.query.endTime) {
            filter.start = {
                $gte: new Date(req.query.startTime as string),
                $lte: new Date(req.query.endTime as string)
            };
        }

        // Add creation date range filtering if provided
        if (req.query.startDate && req.query.endDate) {
            filter.createdAt = {
                $gte: new Date(req.query.startDate as string),
                $lte: new Date(req.query.endDate as string)
            };
        }

        let query = Booking.find(filter)
            .populate("serviceId", "name basePrice duration")
            .populate("userId", "fullName phone email")
            .populate("staffId", "fullName")
            .populate("staffIds", "fullName")
            .populate("petStaffMap.staffId", "fullName")
            .populate("petStaffMap.petId", "name avatar breed image")
            .sort({ createdAt: -1 });

        if (!noLimit) {
            query = query.skip(skip).limit(limit);
        }

        const bookings = await query;
        const total = await Booking.countDocuments(filter);

        res.json({
            code: 200,
            message: "Danh sách lịch đặt",
            data: bookings,
            pagination: noLimit ? null : {
                currentPage: page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error listing bookings:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách lịch đặt"
        });
    }
};

// [POST] /api/v1/admin/bookings/auto-assign
export const autoAssignBookings = async (req: Request, res: Response) => {
    try {
        const { date } = req.body;
        const targetDate = date ? dayjs(date) : dayjs();

        const pendingBookings = await Booking.find({
            bookingStatus: "pending",
            staffId: null,
            deleted: false,
            start: {
                $gte: targetDate.startOf('day').toDate(),
                $lte: targetDate.endOf('day').toDate()
            }
        }).populate("serviceId");

        if (pendingBookings.length === 0) {
            return res.json({
                code: 200,
                message: "Không có đơn hàng nào cần phân công trong ngày này",
                data: []
            });
        }

        const results = [];

        for (const booking of pendingBookings) {
            const serviceId = (booking.serviceId as any)?._id?.toString();

            if (!serviceId || !booking.start || !booking.end) {
                continue;
            }

            const bestStaffList = await findBestStaffForBooking(
                booking.start as any,
                booking.start as any,
                booking.end as any,
                serviceId as string,
                booking.petIds?.length || 1
            );

            if (bestStaffList.length > 0) {
                booking.staffIds = bestStaffList.map(s => s._id);
                booking.staffId = booking.staffIds[0];
                booking.bookingStatus = "confirmed";
                await booking.save();

                results.push({
                    bookingId: booking._id,
                    code: booking.code,
                    staffNames: bestStaffList.map(s => s.fullName).join(", ")
                });
            }
        }

        res.json({
            code: 200,
            message: `Tự động phân công thành công ${results.length} đơn hàng`,
            data: results
        });

    } catch (error) {
        console.error("Auto Assign Error:", error);
        res.status(500).json({ code: 500, message: "Lỗi khi tự động phân công" });
    }
};

// [GET] /api/v1/admin/bookings/staff-tasks
export const listStaffTasks = async (req: Request, res: Response) => {
    try {
        await autoUpdateBookingStatuses();
        const staffId = res.locals.accountAdmin._id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const noLimit = req.query.noLimit === 'true';

        let filter: any = {
            deleted: false,
            $or: [
                { staffId: staffId },
                { staffIds: staffId }
            ]
        };

        if (req.query.status) {
            filter.bookingStatus = req.query.status;
        }

        if (req.query.date) {
            const date = dayjs(req.query.date as string);
            filter.start = {
                $gte: date.startOf('day').toDate(),
                $lte: date.endOf('day').toDate()
            };
        }

        const query = Booking.find(filter)
            .populate("serviceId", "name basePrice duration")
            .populate("userId", "fullName phone avatar")
            .populate("petIds", "name breed weight")
            .populate("petStaffMap.petId", "name avatar breed")
            .sort({ start: 1 });

        if (!noLimit) {
            query.skip(skip).limit(limit);
        }

        const tasks = await query;
        const total = await Booking.countDocuments(filter);

        res.json({
            code: 200,
            message: "Danh sách công việc của tôi",
            data: tasks,
            pagination: noLimit ? null : {
                page,
                limit,
                total,
                totalPage: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách công việc"
        });
    }
};

// [GET] /api/v1/admin/bookings/staff-detail/:id
export const getStaffBookingDetail = async (req: Request, res: Response) => {
    try {
        const staffId = res.locals.accountAdmin._id;
        const booking = await Booking.findOne({
            _id: req.params.id,
            staffId: staffId,
            deleted: false
        })
            .populate("serviceId", "name basePrice duration")
            .populate("userId", "fullName phone email avatar")
            .populate("staffId", "fullName email")
            .populate("staffIds", "fullName email avatar")
            .populate("petIds");

        if (!booking) {
            return res.status(404).json({
                code: 404,
                message: "Lịch đặt không tồn tại hoặc bạn không có quyền truy cập"
            });
        }

        res.json({
            code: 200,
            message: "Chi tiết công việc",
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy chi tiết công việc"
        });
    }
};

// [GET] /api/v1/admin/bookings/:id
export const getBooking = async (req: Request, res: Response) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate("serviceId", "name basePrice duration")
            .populate("userId", "fullName phone email avatar")
            .populate("staffId", "fullName email")
            .populate("staffIds", "fullName email avatar")
            .populate("petIds");

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

        booking.bookingStatus = "confirmed";
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

        booking.bookingStatus = "cancelled";
        booking.cancelledReason = reason || "Hủy từ admin";
        booking.cancelledAt = new Date();
        booking.cancelledBy = "admin";

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
// [PATCH] /api/v1/admin/bookings/:id/start
export const startInProgress = async (req: Request, res: Response) => {
    try {
        const { petId } = req.body;
        const booking = await Booking.findById(req.params.id).populate("serviceId");

        if (!booking || booking.deleted) {
            return res.status(404).json({ code: 404, message: "Lịch đặt không tồn tại" });
        }

        // 1. Kiểm tra trạng thái hợp lệ
        if (booking.bookingStatus === "pending") {
            return res.status(400).json({
                code: 400,
                message: "Đơn hàng đang chờ xác nhận, không thể bắt đầu thực hiện dịch vụ."
            });
        }

        if (["completed", "cancelled"].includes(booking.bookingStatus)) {
            return res.status(400).json({
                code: 400,
                message: `Lịch đặt này đã ${booking.bookingStatus === 'completed' ? 'hoàn thành' : 'bị hủy'}, không thể bắt đầu.`
            });
        }

        // 2. Kiểm tra thời gian bắt đầu sớm
        const config = await BookingConfig.findOne({}) || { allowEarlyStartMinutes: 30 };
        const now = new Date();
        const scheduledStart = booking.start ? new Date(booking.start as any) : now;

        const earliestAllowed = new Date(scheduledStart.getTime() - (config.allowEarlyStartMinutes || 30) * 60000);

        if (now < earliestAllowed) {
            return res.status(400).json({
                code: 400,
                message: `Bắt đầu quá sớm! Chỉ cho phép làm sớm tối đa ${config.allowEarlyStartMinutes} phút so với lịch hẹn (${dayjs(scheduledStart).format("HH:mm")}).`
            });
        }

        // 3. Cập nhật trạng thái từng thú cưng
        if (petId) {
            const petMapping = booking.petStaffMap.find((m: any) => m.petId.toString() === petId.toString());
            if (petMapping) {
                petMapping.status = "in-progress";
                petMapping.startedAt = new Date();
            }
        } else {
            // Quy trình cũ: Chuyển tất cả sang in-progress
            booking.petStaffMap.forEach((m: any) => {
                if (m.status === "pending") {
                    m.status = "in-progress";
                    m.startedAt = new Date();
                }
            });
        }

        // Cập nhật trạng thái tổng đơn nếu chưa in-progress
        if (booking.bookingStatus !== "in-progress") {
            const actualStart = new Date();
            const duration = (booking.serviceId as any)?.duration || 60;
            const expectedFinish = new Date(actualStart.getTime() + duration * 60000);

            booking.bookingStatus = "in-progress";
            booking.actualStart = actualStart;
            booking.expectedFinish = expectedFinish;
        }

        await booking.save();

        res.json({
            code: 200,
            message: "Đã bắt đầu thực hiện dịch vụ",
            data: booking
        });
    } catch (error) {
        console.error("Error starting booking:", error);
        res.status(500).json({ code: 500, message: "Lỗi hệ thống khi bắt đầu dịch vụ" });
    }
};

// [PATCH] /api/v1/admin/bookings/:id/reschedule
export const rescheduleBooking = async (req: Request, res: Response) => {
    try {
        const { start, end, staffId } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking || booking.deleted) {
            return res.status(404).json({ code: 404, message: "Lịch đặt không tồn tại" });
        }

        // Cập nhật thời gian mới và giải phóng slot cũ
        if (start) booking.start = new Date(start);
        if (end) booking.end = new Date(end);
        if (staffId) booking.staffId = staffId;

        booking.bookingStatus = "confirmed";

        await booking.save();

        res.json({
            code: 200,
            message: "Đổi lịch thành công",
            data: booking
        });
    } catch (error) {
        res.status(500).json({ code: 500, message: "Lỗi khi đổi lịch đặt" });
    }
};

// [PATCH] /api/v1/admin/bookings/:id/update
export const updateBooking = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);

        if (!booking || booking.deleted) {
            return res.status(404).json({ code: 404, message: "Lịch đặt không tồn tại" });
        }

        // Chỉ cho phép cập nhật khi chưa hoàn thành hoặc bị hủy
        if (["completed", "cancelled"].includes(booking.bookingStatus)) {
            return res.status(400).json({
                code: 400,
                message: `Không thể chỉnh sửa lịch đặt đã ${booking.bookingStatus === 'completed' ? 'hoàn thành' : 'bị hủy'}`
            });
        }

        // Validate time if changed
        if (req.body.start || req.body.end) {
            const checkStart = new Date(req.body.start || booking.start);
            const checkEnd = new Date(req.body.end || booking.end);
            const now = new Date();

            // 1. Past time (only if changed to a new time)
            if (req.body.start && checkStart < now && checkStart.getTime() !== booking.start?.getTime()) {
                return res.status(400).json({ code: 400, message: "Thời gian bắt đầu không thể ở quá khứ" });
            }

            // 2. 15-min intervals (Temporarily disabled)
            /*
            if (checkStart.getMinutes() % 15 !== 0 || checkEnd.getMinutes() % 15 !== 0) {
                return res.status(400).json({ code: 400, message: "Thời gian phải là bội số của 15 phút (00, 15, 30, 45)" });
            }
            */

            // 3. Working blocks (Temporarily disabled)
            /*
            const targetDate = dayjs(checkStart).startOf('day');
            const schedules = await WorkSchedule.find({
                date: {
                    $gte: targetDate.toDate(),
                    $lte: targetDate.endOf('day').toDate()
                },
                status: { $in: ["scheduled", "checked-in"] }
            }).populate("shiftId");

            const dynamicBlocks = schedules.map(s => {
                if (s.shiftId) {
                    const [sH, sM] = (s.shiftId as any).startTime.split(':').map(Number);
                    const [eH, eM] = (s.shiftId as any).endTime.split(':').map(Number);
                    return { start: sH * 60 + sM, end: eH * 60 + eM, label: `${(s.shiftId as any).startTime}-${(s.shiftId as any).endTime}` };
                }
                return null;
            }).filter(Boolean) as { start: number, end: number, label: string }[];

            const uniqueShiftLabels = Array.from(new Set(dynamicBlocks.map(b => b.label))).sort();

            let workingBlocks = dynamicBlocks.length > 0 ? dynamicBlocks : [
                { start: 8 * 60, end: 12 * 60 },
                { start: 13 * 60, end: 17 * 60 },
                { start: 17 * 60, end: 23 * 60 }
            ];

            const startTotalMinutes = checkStart.getHours() * 60 + checkStart.getMinutes();
            const endTotalMinutes = checkEnd.getHours() * 60 + checkEnd.getMinutes();

            const isValidBlock = workingBlocks.some(block =>
                startTotalMinutes >= block.start && endTotalMinutes <= block.end
            );

            if (!isValidBlock) {
                const shiftInfo = uniqueShiftLabels.length > 0 ? uniqueShiftLabels.join(", ") : "08:00-12:00, 13:00-17:00, 17:00-23:00";
                return res.status(400).json({
                    code: 400,
                    message: `Thời gian đặt lịch phải nằm trong các ca làm việc (${shiftInfo}) và không được vượt quá thời gian kết thúc ca.`
                });
            }
            */
        }

        // Validate overlapping if time or pets or user changes
        const checkStart = req.body.start ? new Date(req.body.start) : booking.start;
        const checkEnd = req.body.end ? new Date(req.body.end) : booking.end;
        const checkUserId = req.body.userId || booking.userId;
        const checkPetIds = req.body.petIds || booking.petIds;

        if (checkUserId && checkPetIds && checkPetIds.length > 0) {
            const customerOverlap = await Booking.findOne({
                _id: { $ne: id },
                userId: checkUserId,
                bookingStatus: { $nin: ["cancelled", "completed"] },
                deleted: false,
                petIds: { $in: checkPetIds },
                $or: [
                    { start: { $lt: checkEnd }, end: { $gt: checkStart } }
                ]
            });

            if (customerOverlap) {
                return res.status(400).json({
                    code: 400,
                    message: "Thú cưng này đã có lịch đặt khác trong khung giờ này. Vui lòng kiểm tra lại!"
                });
            }
        }

        const allowedUpdates = [
            "serviceId", "userId", "petIds", "notes",
            "start", "end", "staffId", "staffIds", "petStaffMap", "discount",
            "paymentMethod", "paymentStatus"
        ];

        allowedUpdates.forEach(update => {
            if (req.body[update] !== undefined) {
                (booking as any)[update] = req.body[update];
            }
        });

        // Sync staffId if staffIds updated
        if (req.body.staffIds && Array.isArray(req.body.staffIds) && req.body.staffIds.length > 0) {
            booking.staffId = req.body.staffIds[0];
        } else if (req.body.staffId && (!req.body.staffIds || req.body.staffIds.length === 0)) {
            (booking as any).staffIds = [req.body.staffId];
        }

        // Auto-fix petStaffMap if pets or staff changed but petStaffMap wasn't provided
        const petsChanged = req.body.petIds !== undefined;
        const staffChanged = req.body.staffIds !== undefined || req.body.staffId !== undefined;
        const mapProvided = req.body.petStaffMap !== undefined && req.body.petStaffMap.length > 0;

        if ((petsChanged || staffChanged) && !mapProvided) {
            (booking as any).petStaffMap = autoAssignPetsToStaff(booking.petIds, booking.staffIds);
        }

        await booking.save();

        res.json({
            code: 200,
            message: "Cập nhật lịch đặt thành công",
            data: booking
        });
    } catch (error) {
        console.error("Update Booking Error:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật lịch đặt"
        });
    }
};

// [GET] /api/v1/admin/bookings/available-slots
export const getAvailableSlots = async (req: Request, res: Response) => {
    try {
        await autoUpdateBookingStatuses();
        const { date, serviceId, departmentId } = req.query;

        if (!date || !serviceId) {
            return res.status(400).json({ code: 400, message: "Thiếu thông tin ngày hoặc dịch vụ" });
        }

        const queryDate = new Date(date as string);
        const service = await Service.findById(serviceId);
        const duration = (service as any)?.duration || 60;

        // 1. Tìm tất cả nhân viên có lịch làm việc vào ngày này (lọc theo phòng ban nếu có)
        const scheduleFilter: any = {
            date: {
                $gte: new Date(queryDate.setHours(0, 0, 0, 0)),
                $lt: new Date(queryDate.setHours(23, 59, 59, 999))
            }
        };
        if (departmentId) scheduleFilter.departmentId = departmentId;

        const schedules = await WorkSchedule.find(scheduleFilter).populate("staffId").populate("shiftId");
        const staffIds = schedules.map(s => s.staffId?._id);

        // 2. Lấy tất cả Booking của các nhân viên này trong ngày
        const bookings = await Booking.find({
            staffId: { $in: staffIds },
            bookingStatus: { $in: ["confirmed", "delayed", "in-progress"] },
            deleted: false,
            $or: [
                { start: { $gte: new Date(queryDate.setHours(0, 0, 0, 0)), $lt: new Date(queryDate.setHours(23, 59, 59, 999)) } },
                { actualStart: { $exists: true } } // Bao gồm cả đơn đang làm dở từ hôm trước (nếu có, hiếm)
            ]
        });

        const availableSlots: any[] = [];
        const timeStep = 30; // 30 phút

        // 3. Tính toán ô trống cho từng nhân viên
        schedules.forEach(schedule => {
            const staffBookings = bookings.filter(b => b.staffId?.toString() === schedule.staffId?._id.toString());

            // Giả định ca làm việc từ schedule.startTime đến schedule.endTime (ví dụ "08:00" đến "17:00")
            // Ở đây tôi dùng service duration để kiểm tra xem có đủ chỗ không

            // Logic đơn giản: Chia ngày thành các mốc 30p từ 08:00 đến 20:00 (hoặc theo ca làm)
            const workStart = (schedule.shiftId as any)?.startTime || "08:00";
            const workEnd = (schedule.shiftId as any)?.endTime || "23:00";

            let current = new Date(queryDate);
            const [startH, startM] = workStart.split(":").map(Number);
            const [endH, endM] = workEnd.split(":").map(Number);

            current.setHours(startH, startM, 0, 0);
            const limit = new Date(queryDate);
            limit.setHours(endH, endM, 0, 0);

            while (current.getTime() + duration * 60000 <= limit.getTime()) {
                const slotStart = new Date(current);
                const slotEnd = new Date(current.getTime() + duration * 60000);

                // Kiểm tra xem slot này có bị đè bởi booking nào không
                const isBusy = staffBookings.some(b => {
                    const bStart = b.actualStart || b.start;
                    const bEnd = b.expectedFinish || b.end;

                    if (!bStart || !bEnd) return false;

                    // Overlap logic: (start1 < end2) && (end1 > start2)
                    return (slotStart < bEnd && slotEnd > bStart);
                });

                if (!isBusy) {
                    availableSlots.push({
                        time: slotStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                        staffId: schedule.staffId?._id,
                        staffName: (schedule.staffId as any)?.fullName,
                        fullTime: slotStart
                    });
                }

                current.setMinutes(current.getMinutes() + timeStep);
            }
        });

        // Nhóm lại và trả về các mốc thời gian duy nhất
        const uniqueTimes = Array.from(new Set(availableSlots.map(s => s.time))).sort();

        res.json({
            code: 200,
            message: "Danh sách khung giờ trống (Live)",
            data: uniqueTimes,
            details: availableSlots // Cho phép frontend biết nhân viên nào rảnh giờ nào
        });
    } catch (error) {
        console.error("Error calculating available slots:", error);
        res.status(500).json({ code: 500, message: "Lỗi khi tính toán khung giờ trống" });
    }
};

// [PATCH] /api/v1/admin/bookings/:id/complete
export const completeBooking = async (req: Request, res: Response) => {
    try {
        const { petId } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking || booking.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Lịch đặt không tồn tại"
            });
        }

        // 1. Cập nhật trạng thái từng thú cưng
        if (petId) {
            const petMapping = booking.petStaffMap.find((m: any) => m.petId.toString() === petId.toString());
            if (petMapping) {
                // FETCH SERVICE FOR VALIDATION
                const service: any = await Service.findById(booking.serviceId);
                if (!service) {
                    return res.status(404).json({ code: 404, message: "Dịch vụ không tồn tại" });
                }

                // Check minDuration
                const now = new Date();
                const startedAt = petMapping.startedAt ? new Date(petMapping.startedAt) : null;
                const timeElapsed = startedAt ? Math.floor((now.getTime() - startedAt.getTime()) / 60000) : 0;

                if (startedAt && service.minDuration > 0 && timeElapsed < service.minDuration) {
                    return res.status(400).json({
                        code: 400,
                        message: `Hoàn thành quá sớm! Dịch vụ này yêu cầu tối thiểu ${service.minDuration} phút (hiện tại: ${timeElapsed} phút).`
                    });
                }

                // Calculate Surcharge if maxDuration exceeded
                if (startedAt && service.maxDuration > 0 && timeElapsed > service.maxDuration) {
                    let surcharge = 0;
                    let notes = "";
                    if (service.surchargeType === 'fixed') {
                        surcharge = service.surchargeValue;
                        notes = `Phụ thu quá giờ (Cố định): ${surcharge.toLocaleString()}đ`;
                    } else if (service.surchargeType === 'per-minute') {
                        const overtime = timeElapsed - service.maxDuration;
                        surcharge = overtime * service.surchargeValue;
                        notes = `Phụ thu quá giờ (${overtime} phút x ${service.surchargeValue.toLocaleString()}đ/phút): ${surcharge.toLocaleString()}đ`;
                    }

                    if (surcharge > 0) {
                        petMapping.surchargeAmount = surcharge;
                        petMapping.surchargeNotes = notes;
                    }
                }

                petMapping.status = "completed";
                petMapping.completedAt = now;

                // Recalculate Booking Total if there are surcharges
                const totalSurcharge = booking.petStaffMap.reduce((sum: number, m: any) => sum + (m.surchargeAmount || 0), 0);
                // We assume 'total' was set at creation. We add the latest surcharges.
                // Note: If we want to be safe, we'd need subtraction of old surcharges if this was an update, 
                // but since it's transitions from in-progress to completed, it's usually the first time.
                // However, to be robust:
                // Let's store the initial total if we haven't done it yet, or just recalculate total based on subTotal
                if (booking.subTotal) {
                    booking.total = (booking.subTotal - (booking.discount || 0)) + totalSurcharge;
                }
            }
        } else {
            // Quy trình cũ: Hoàn thành tất cả (có thể bỏ qua validation nếu làm hàng loạt, 
            // hoặc áp dụng cho từng con - ở đây tôi giữ logic đơn giản cho bulk)
            booking.petStaffMap.forEach((m: any) => {
                m.status = "completed";
                if (!m.completedAt) m.completedAt = new Date();
            });
        }

        // 2. Kiểm tra xem tất cả thú cưng đã xong chưa
        const allCompleted = booking.petStaffMap.every((m: any) => m.status === "completed");

        if (allCompleted) {
            booking.bookingStatus = "completed";
            booking.completedAt = new Date();
        }

        await booking.save();

        res.json({
            code: 200,
            message: allCompleted ? "Hoàn thành lịch đặt thành công" : "Đã cập nhật trạng thái thú cưng",
            data: booking
        });
    } catch (error) {
        console.error("Error completing booking:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi hoàn thành lịch đặt"
        });
    }
};
// [GET] /api/v1/admin/bookings/:id/recommend-staff
export const getRecommendedStaff = async (req: Request, res: Response) => {
    try {
        const booking = await Booking.findById(req.params.id).populate("serviceId");
        if (!booking) {
            return res.status(404).json({ code: 404, message: "Lịch đặt không tồn tại" });
        }

        const startDate = booking.start;
        const endDate = booking.end;

        if (!startDate || !endDate) {
            return res.status(400).json({ code: 400, message: "Lịch đặt thiếu thời gian bắt đầu/kết thúc" });
        }

        // 1. Tìm tất cả nhân viên có lịch làm việc trong ngày này
        const schedules = await WorkSchedule.find({
            date: {
                $gte: dayjs(startDate).startOf('day').toDate(),
                $lte: dayjs(startDate).endOf('day').toDate()
            }
        }).populate("staffId", "fullName email avatar").populate("shiftId");

        // 2. Lấy tất cả các ca đặt lịch của các nhân viên đó trong ngày
        const allBookingsToday = await Booking.find({
            bookingStatus: { $in: ["confirmed", "delayed", "in-progress", "completed"] },
            deleted: false,
            start: {
                $gte: dayjs(startDate).startOf('day').toDate(),
                $lte: dayjs(startDate).endOf('day').toDate()
            }
        });

        const recommendations = [];

        for (const schedule of schedules) {
            const staff = schedule.staffId as any;
            const shift = schedule.shiftId as any;

            if (!staff || !shift) continue;

            // 2.1 Kiểm tra xem thời gian đặt có nằm trong ca làm của nhân viên không
            const [sH, sM] = shift.startTime.split(':').map(Number);
            const [eH, eM] = shift.endTime.split(':').map(Number);
            const shiftStart = sH * 60 + sM;
            const shiftEnd = eH * 60 + eM;
            const reqStartMin = startDate.getHours() * 60 + startDate.getMinutes();
            const reqEndMin = endDate.getHours() * 60 + endDate.getMinutes();

            const isInShift = reqStartMin >= shiftStart && reqEndMin <= shiftEnd;

            // 2.2 Kiểm tra trùng lịch (bận hay rảnh)
            const staffBookings = allBookingsToday.filter(b =>
                b.staffId?.toString() === staff._id.toString() &&
                b._id.toString() !== booking._id.toString()
            );

            const isOverlapping = staffBookings.some(b => {
                const bStart = b.actualStart || b.start;
                const bEnd = b.completedAt || b.expectedFinish || b.end;
                if (!bStart || !bEnd) return false;
                return (startDate < bEnd && endDate > bStart);
            });

            // 2.3 Tính khối lượng công việc (số ca đã nhận trong ngày)
            const workloadCount = staffBookings.length;
            const totalMinutes = staffBookings.reduce((sum, b) => {
                const bStart = b.actualStart || b.start;
                const bEnd = b.completedAt || b.expectedFinish || b.end;
                if (!bStart || !bEnd) return sum;
                const diff = (bEnd.getTime() - bStart.getTime()) / 60000;
                return sum + diff;
            }, 0);

            recommendations.push({
                staffId: staff._id,
                fullName: staff.fullName,
                avatar: staff.avatar,
                email: staff.email,
                shift: `${shift.startTime} - ${shift.endTime}`,
                isAvailable: isInShift && !isOverlapping,
                isBusy: isOverlapping,
                notInShift: !isInShift,
                workloadCount,
                totalMinutes,
                staffBookings: staffBookings.map(b => {
                    const bStart = b.actualStart || b.start;
                    const bEnd = b.completedAt || b.expectedFinish || b.end;
                    return {
                        code: b.code,
                        time: `${bStart ? dayjs(bStart).format("HH:mm") : "??"} - ${bEnd ? dayjs(bEnd).format("HH:mm") : "??"}`,
                        isActual: !!b.actualStart,
                        isCompleted: b.bookingStatus === 'completed'
                    }
                })
            });
        }

        // Sắp xếp: Ưu tiên người rảnh và người có ít ca làm hơn lên đầu
        recommendations.sort((a, b) => {
            if (a.isAvailable && !b.isAvailable) return -1;
            if (!a.isAvailable && b.isAvailable) return 1;
            return a.workloadCount - b.workloadCount;
        });

        res.json({
            code: 200,
            message: "Đề xuất nhân viên",
            data: recommendations
        });
    } catch (error) {
        res.status(500).json({ code: 500, message: "Lỗi khi lấy đề xuất nhân viên" });
    }
};

// [GET] /api/v1/admin/bookings/export-staff-schedule
export const exportDailyStaffSchedule = async (req: Request, res: Response) => {
    try {
        const { date } = req.query;
        console.log("Exporting staff schedule for date:", date);
        if (!date) {
            return res.status(400).json({ message: "Vui lòng chọn ngày" });
        }

        const selectedDate = dayjs(date as string);
        const bookings = await Booking.find({
            deleted: false,
            start: {
                $gte: selectedDate.startOf('day').toDate(),
                $lte: selectedDate.endOf('day').toDate()
            },
            bookingStatus: { $in: ["confirmed", "delayed", "in-progress", "completed"] }
        })
            .populate("staffId", "fullName")
            .populate("serviceId", "name")
            .populate("petIds", "name")
            .sort({ start: 1 });

        console.log(`Found ${bookings.length} bookings to export`);

        // Group by staff
        const staffGroups: any = {};
        bookings.forEach((b: any) => {
            const staffName = b.staffId?.fullName || "Chưa phân công";
            if (!staffGroups[staffName]) staffGroups[staffName] = [];
            staffGroups[staffName].push(b);
        });

        const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Lịch phân công nhân viên ${selectedDate.format("DD/MM/YYYY")}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #f97316; padding-bottom: 10px; }
        .title { color: #f97316; font-size: 24px; font-weight: bold; }
        .staff-section { margin-bottom: 30px; page-break-inside: avoid; }
        .staff-name { background: #fff7ed; color: #c2410c; padding: 10px; font-size: 18px; font-weight: bold; border-left: 5px solid #f97316; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f8fafc; color: #475569; padding: 10px; border: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
        td { padding: 10px; border: 1px solid #e2e8f0; font-size: 13px; }
        .time-col { width: 100px; font-weight: bold; color: #0f172a; }
        .status-confirmed { color: #00B8D9; font-weight: bold; }
        .status-inprogress { color: #00A76F; font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">DANH SÁCH PHÂN CÔNG NHÂN VIÊN</div>
        <div style="margin-top: 5px;">Ngày: ${selectedDate.format("DD/MM/YYYY")}</div>
    </div>

    ${Object.keys(staffGroups).length === 0 ? '<p style="text-align:center;">Không có lịch hẹn nào được phân công trong ngày này.</p>' : ''}

    ${Object.entries(staffGroups).map(([name, items]: [string, any]) => `
        <div class="staff-section">
            <div class="staff-name">Nhân viên: ${name} (${items.length} ca)</div>
            <table>
                <thead>
                    <tr>
                        <th class="time-col">Thời gian</th>
                        <th>Dịch vụ</th>
                        <th>Thú cưng</th>
                        <th>Trạng thái</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((b: any) => `
                        <tr>
                            <td class="time-col">${dayjs(b.start).format("HH:mm")} - ${dayjs(b.end).format("HH:mm")}</td>
                            <td>${b.serviceId?.name || 'N/A'}</td>
                            <td>${b.petIds?.map((p: any) => p.name).join(", ") || 'N/A'}</td>
                            <td class="status-${b.bookingStatus}">${b.bookingStatus === 'confirmed' ? 'Đã xác nhận' : b.bookingStatus === 'in-progress' ? 'Đang làm' : b.bookingStatus === 'completed' ? 'Hoàn thành' : b.bookingStatus}</td>
                            <td>${b.notes || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('')}

    <div class="footer">
        <p>In lúc: ${dayjs().format("DD/MM/YYYY HH:mm")}</p>
        <p>TeddyPet Spa - Hệ thống quản lý vận hành chuyên nghiệp</p>
    </div>
</body>
</html>
        `;

        console.log("Launching puppeteer...");
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
            printBackground: true
        });
        await browser.close();
        console.log("PDF generated successfully");
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=staff_schedule_${selectedDate.format("YYYY-MM-DD")}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error("Error exporting schedule:", error);
        res.status(500).json({ code: 500, message: "Lỗi khi xuất file PDF" });
    }
};

// [POST] /api/v1/admin/bookings/suggest-assignment
export const suggestSmartAssignment = async (req: Request, res: Response) => {
    try {
        const { date, startTime, endTime, serviceId, petIds, staffIds } = req.body;
        console.log("SMART ASSIGN REQUEST:", { date, startTime, endTime, serviceId, petIds, staffIds });

        if (!date || !startTime || !endTime || !serviceId || !petIds) {
            return res.status(400).json({ code: 400, message: "Thiếu thông tin để gợi ý phân công" });
        }

        const startDateTime = new Date(startTime);
        const endDateTime = new Date(endTime);
        const bookingDate = new Date(date);

        const bestStaff = await findBestStaffForBooking(
            bookingDate,
            startDateTime,
            endDateTime,
            serviceId,
            petIds.length,
            undefined,
            staffIds
        );

        console.log(`SMART ASSIGN RESULT: Found ${bestStaff.length} suitable staff members`);

        if (!bestStaff || bestStaff.length === 0) {
            return res.status(404).json({ code: 404, message: "Không tìm thấy nhân viên phù hợp vào khung giờ này" });
        }

        const petStaffMap = autoAssignPetsToStaff(petIds, bestStaff.map(s => s._id));

        res.json({
            code: 200,
            message: "Gợi ý phân công thành công",
            data: {
                staffIds: bestStaff.map(s => s._id),
                petStaffMap
            }
        });
    } catch (error) {
        console.error("Error suggesting assignment:", error);
        res.status(500).json({ code: 500, message: "Lỗi khi gợi ý phân công" });
    }
};
