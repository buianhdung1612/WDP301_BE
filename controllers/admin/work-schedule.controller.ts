import { Request, Response } from "express";
import WorkSchedule from "../../models/work-schedule.model";
import dayjs from "dayjs";

// [GET] /api/v1/admin/schedules
export const index = async (req: Request, res: Response) => {
    try {
        const filter: any = {};

        // Filter by staff
        if (req.query.staffId) {
            filter.staffId = req.query.staffId;
        }

        // Filter by department
        if (req.query.departmentId) {
            filter.departmentId = req.query.departmentId;
        }

        // Filter by date range
        if (req.query.startDate && req.query.endDate) {
            filter.date = {
                $gte: new Date(req.query.startDate as string),
                $lte: new Date(req.query.endDate as string)
            };
        } else if (req.query.date) {
            const date = new Date(req.query.date as string);
            filter.date = {
                $gte: dayjs(date).startOf('day').toDate(),
                $lte: dayjs(date).endOf('day').toDate()
            };
        }

        // Filter by status
        if (req.query.status) {
            filter.status = req.query.status;
        }

        const schedules = await WorkSchedule.find(filter)
            .populate({
                path: "staffId",
                select: "fullName email employeeCode roles",
                populate: { path: "roles", select: "name" }
            })
            .populate("shiftId", "name startTime endTime")
            .populate("departmentId", "name")
            .populate("createdBy", "fullName")
            .sort({ date: -1, 'shiftId.startTime': 1 });

        res.json({
            code: 200,
            message: "Danh sách lịch làm việc",
            data: schedules
        });
    } catch (error) {
        console.error("Error fetching schedules:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách lịch làm việc"
        });
    }
};

// [GET] /api/v1/admin/schedules/my-schedule
export const listMySchedules = async (req: Request, res: Response) => {
    try {
        const staffId = res.locals.accountAdmin._id;
        const filter: any = { staffId: staffId };

        if (req.query.startDate && req.query.endDate) {
            filter.date = {
                $gte: new Date(req.query.startDate as string),
                $lte: new Date(req.query.endDate as string)
            };
        }

        const schedules = await WorkSchedule.find(filter)
            .populate("shiftId", "name startTime endTime")
            .populate("departmentId", "name")
            .sort({ date: 1 });

        res.json({
            code: 200,
            message: "Lịch làm việc của tôi",
            data: schedules
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy lịch làm việc"
        });
    }
};

// [GET] /api/v1/admin/schedules/calendar
// Get schedules for calendar view
export const getCalendarData = async (req: Request, res: Response) => {
    try {
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({
                code: 400,
                message: "Thiếu tháng hoặc năm"
            });
        }

        const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
        const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();

        const schedules = await WorkSchedule.find({
            date: {
                $gte: startDate,
                $lte: endDate
            },
            ...(req.query.departmentId ? { departmentId: req.query.departmentId } : {})
        })
            .populate({
                path: "staffId",
                select: "fullName email employeeCode avatar roles",
                populate: { path: "roles", select: "name" }
            })
            .populate("shiftId", "name startTime endTime")
            .populate("departmentId", "name")
            .sort({ date: 1 });

        const events = schedules.map(schedule => {
            const staff = schedule.staffId as any;
            const staffRole = staff?.roles?.[0]?.name || 'Nhân viên';

            return {
                id: schedule._id,
                title: staff?.fullName || 'Nhân viên',
                start: dayjs(schedule.date).format('YYYY-MM-DD') + 'T' + (schedule.shiftId as any)?.startTime,
                end: dayjs(schedule.date).format('YYYY-MM-DD') + 'T' + (schedule.shiftId as any)?.endTime,
                backgroundColor: '#FFAB00',
                borderColor: 'transparent',
                extendedProps: {
                    staffId: staff?._id,
                    staffName: staff?.fullName,
                    staffEmail: staff?.email,
                    staffRole,
                    shiftId: (schedule.shiftId as any)?._id,
                    shiftName: (schedule.shiftId as any)?.name,
                    startTime: (schedule.shiftId as any)?.startTime,
                    endTime: (schedule.shiftId as any)?.endTime,
                    status: schedule.status,
                    departmentId: (schedule.departmentId as any)?._id,
                    departmentName: (schedule.departmentId as any)?.name,
                    notes: schedule.notes
                }
            };
        });

        res.json({
            code: 200,
            message: "Dữ liệu lịch",
            data: events
        });
    } catch (error) {
        console.error("Error fetching calendar data:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy dữ liệu lịch"
        });
    }
};

// [POST] /api/v1/admin/schedules
export const create = async (req: Request, res: Response) => {
    try {
        const { staffId, shiftId, departmentId, date, notes } = req.body;
        const createdBy = (req as any).user?.id;

        // Check if staff already has a schedule on this date
        const existingSchedule = await WorkSchedule.findOne({
            staffId,
            date: {
                $gte: dayjs(date).startOf('day').toDate(),
                $lte: dayjs(date).endOf('day').toDate()
            }
        }).populate("shiftId", "startTime endTime");

        if (existingSchedule) {
            return res.status(400).json({
                code: 400,
                message: `Nhân viên đã có ca làm việc vào ngày này (${(existingSchedule.shiftId as any)?.startTime} - ${(existingSchedule.shiftId as any)?.endTime})`
            });
        }

        const schedule = new WorkSchedule({
            staffId,
            shiftId,
            departmentId,
            date: new Date(date),
            status: "scheduled",
            notes,
            createdBy
        });

        await schedule.save();

        const populatedSchedule = await WorkSchedule.findById(schedule._id)
            .populate("staffId", "fullName email")
            .populate("shiftId", "name startTime endTime");

        res.status(201).json({
            code: 201,
            message: "Phân ca thành công",
            data: populatedSchedule
        });
    } catch (error) {
        console.error("Error creating schedule:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi phân ca"
        });
    }
};

// [POST] /api/v1/admin/schedules/bulk
export const bulkCreate = async (req: Request, res: Response) => {
    try {
        const { staffIds, shiftId, departmentId, startDate, endDate, overwrite } = req.body;
        const createdBy = (req as any).user?.id;

        if (!staffIds || !Array.isArray(staffIds) || staffIds.length === 0) {
            return res.status(400).json({
                code: 400,
                message: "Vui lòng chọn nhân viên"
            });
        }

        const start = dayjs(startDate).startOf('day');
        const end = dayjs(endDate).startOf('day');

        // 1. Pre-fetch all existing schedules in the range for these staff
        const existingSchedules = await WorkSchedule.find({
            staffId: { $in: staffIds },
            date: {
                $gte: start.toDate(),
                $lte: end.toDate()
            }
        });

        // Map for quick lookup: "staffId:YYYY-MM-DD"
        const existingMap = new Map();
        existingSchedules.forEach(s => {
            const key = `${s.staffId.toString()}:${dayjs(s.date).format('YYYY-MM-DD')}`;
            existingMap.set(key, s);
        });

        const bulkOps: any[] = [];
        let createdCount = 0;
        let updatedCount = 0;
        let skipCount = 0;

        // Loop through each day
        let currentDate = start;
        while (currentDate.isBefore(end) || currentDate.isSame(end, 'day')) {
            const dateStr = currentDate.format('YYYY-MM-DD');
            const dateObj = currentDate.toDate();

            for (const staffId of staffIds) {
                const key = `${staffId}:${dateStr}`;
                const existing = existingMap.get(key);

                if (existing) {
                    if (overwrite) {
                        bulkOps.push({
                            updateOne: {
                                filter: { _id: existing._id },
                                update: {
                                    $set: {
                                        shiftId,
                                        departmentId,
                                        status: "scheduled",
                                        createdBy
                                    }
                                }
                            }
                        });
                        updatedCount++;
                    } else {
                        skipCount++;
                    }
                } else {
                    bulkOps.push({
                        insertOne: {
                            document: {
                                staffId,
                                shiftId,
                                departmentId,
                                date: dateObj,
                                status: "scheduled",
                                createdBy
                            }
                        }
                    });
                    createdCount++;
                }
            }
            currentDate = currentDate.add(1, 'day');
        }

        if (bulkOps.length > 0) {
            await WorkSchedule.bulkWrite(bulkOps);
        }

        let message = "Phân ca thành công";
        if (updatedCount > 0) {
            message = `Đã tạo mới ${createdCount} và cập nhật ${updatedCount} lịch làm việc thành công.`;
        } else if (createdCount > 0) {
            message = `Đã tạo mới ${createdCount} lịch làm việc thành công.`;
        } else if (skipCount > 0) {
            message = `Nhân viên đã có lịch cho toàn bộ các ngày được chọn.`;
        }

        res.status(201).json({
            code: 201,
            message,
            data: {
                created: createdCount,
                updated: updatedCount,
                skipped: skipCount
            }
        });
    } catch (error) {
        console.error("Error bulk creating schedules:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi phân ca hàng loạt"
        });
    }
};

// [DELETE] /api/v1/admin/schedules/bulk-delete
export const bulkRemove = async (req: Request, res: Response) => {
    try {
        const { staffIds, startDate, endDate, departmentId } = req.body;

        const filter: any = {};
        if (staffIds && Array.isArray(staffIds) && staffIds.length > 0) {
            filter.staffId = { $in: staffIds };
        }
        if (startDate && endDate) {
            filter.date = {
                $gte: dayjs(startDate).startOf('day').toDate(),
                $lte: dayjs(endDate).endOf('day').toDate()
            };
        }
        if (departmentId) {
            filter.departmentId = departmentId;
        }

        const result = await WorkSchedule.deleteMany(filter);

        res.json({
            code: 200,
            message: `Đã xóa ${result.deletedCount} lịch làm việc`,
            data: {
                deletedCount: result.deletedCount
            }
        });
    } catch (error) {
        console.error("Error bulk deleting schedules:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi xóa lịch hàng loạt"
        });
    }
};

// [PATCH] /api/v1/admin/schedules/:id
export const update = async (req: Request, res: Response) => {
    try {
        const { shiftId, departmentId, date, status, notes } = req.body;

        const schedule = await WorkSchedule.findById(req.params.id);

        if (!schedule) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy lịch làm việc"
            });
        }

        if (shiftId) schedule.shiftId = shiftId;
        if (departmentId) schedule.departmentId = departmentId;
        if (date) schedule.date = new Date(date);
        if (status) schedule.status = status;
        if (notes !== undefined) schedule.notes = notes;

        await schedule.save();

        const updatedSchedule = await WorkSchedule.findById(schedule._id)
            .populate("staffId", "fullName email")
            .populate("shiftId", "name startTime endTime");

        res.json({
            code: 200,
            message: "Cập nhật lịch thành công",
            data: updatedSchedule
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật lịch"
        });
    }
};


// [DELETE] /api/v1/admin/schedules/:id
export const remove = async (req: Request, res: Response) => {
    try {
        const result = await WorkSchedule.deleteOne({ _id: req.params.id });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy lịch làm việc"
            });
        }

        res.json({
            code: 200,
            message: "Xóa lịch thành công"
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa lịch làm việc"
        });
    }
};
