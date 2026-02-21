import { Request, Response } from "express";
import Attendance from "../../models/attendance.model";
import WorkSchedule from "../../models/work-schedule.model";
import AccountAdmin from "../../models/account-admin.model";
import Booking from "../../models/booking.model";
import Service from "../../models/service.model";
import Role from "../../models/role.model";
import dayjs from "dayjs";

// [GET] /api/v1/admin/attendance
export const index = async (req: Request, res: Response) => {
    try {
        const filter: any = {};

        if (req.query.staffId) {
            filter.staffId = req.query.staffId;
        }

        if (req.query.month) {
            filter.month = parseInt(req.query.month as string);
        }

        if (req.query.year) {
            filter.year = parseInt(req.query.year as string);
        }

        if (req.query.status) {
            filter.status = req.query.status;
        }

        if (req.query.departmentId) {
            const roles = await Role.find({
                departmentId: req.query.departmentId,
                deleted: false
            }).select("_id");
            const roleIds = roles.map(r => r._id);

            const staffList = await AccountAdmin.find({
                roles: { $in: roleIds },
                deleted: false
            }).select("_id");
            const staffIds = staffList.map(s => s._id);

            filter.staffId = { $in: staffIds };
        }

        const attendances = await Attendance.find(filter)
            .populate("staffId", "fullName employeeCode baseSalary")
            .populate("approvedBy", "fullName")
            .sort({ year: -1, month: -1 });

        res.json({
            code: 200,
            message: "Danh sách chấm công",
            data: attendances
        });
    } catch (error) {
        console.error("Error fetching attendance:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách chấm công"
        });
    }
};

// [GET] /api/v1/admin/attendance/:id
export const detail = async (req: Request, res: Response) => {
    try {
        const attendance = await Attendance.findById(req.params.id)
            .populate("staffId", "fullName employeeCode baseSalary")
            .populate("approvedBy", "fullName");

        if (!attendance) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy bảng công"
            });
        }

        res.json({
            code: 200,
            message: "Chi tiết bảng công",
            data: attendance
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy chi tiết bảng công"
        });
    }
};

// [POST] /api/v1/admin/attendance/generate
// Generate attendance for a month
export const generate = async (req: Request, res: Response) => {
    try {
        const { month, year, staffIds } = req.body;

        if (!month || !year) {
            return res.status(400).json({
                code: 400,
                message: "Thiếu tháng hoặc năm"
            });
        }

        const startDate = dayjs(`${year}-${month}-01`).startOf('month');
        const endDate = dayjs(`${year}-${month}-01`).endOf('month');

        // Get list of staff to generate
        let staffList;
        if (staffIds && Array.isArray(staffIds) && staffIds.length > 0) {
            staffList = await AccountAdmin.find({
                _id: { $in: staffIds },
                deleted: false
            });
        } else {
            staffList = await AccountAdmin.find({ deleted: false });
        }

        const results = [];

        for (const staff of staffList) {
            try {
                // Check if attendance already exists
                const existing = await Attendance.findOne({
                    staffId: staff._id,
                    month,
                    year
                });

                if (existing) {
                    results.push({
                        staffId: staff._id,
                        staffName: staff.fullName,
                        status: 'skipped',
                        message: 'Đã có bảng công'
                    });
                    continue;
                }

                // Get all work schedules for this staff in this month
                const schedules = await WorkSchedule.find({
                    staffId: staff._id,
                    date: {
                        $gte: startDate.toDate(),
                        $lte: endDate.toDate()
                    }
                }).populate("shiftId", "salaryMultiplier");

                // Calculate stats
                let totalWorkDays = 0;
                let totalWorkHours = 0;
                let totalOvertimeHours = 0;
                let totalAbsentDays = 0;
                let totalLeaveDays = 0;

                for (const schedule of schedules) {
                    if (schedule.status === 'checked-out') {
                        totalWorkDays++;
                        totalWorkHours += schedule.actualWorkHours || 0;

                        // Overtime if > 8 hours
                        if (schedule.actualWorkHours && schedule.actualWorkHours > 8) {
                            totalOvertimeHours += (schedule.actualWorkHours - 8);
                        }
                    } else if (schedule.status === 'absent') {
                        totalAbsentDays++;
                    } else if (schedule.status === 'on-leave') {
                        totalLeaveDays++;
                    }
                }

                // Calculate commission from completed bookings
                const completedBookings = await Booking.find({
                    staffId: staff._id,
                    bookingStatus: 'completed',
                    completedAt: {
                        $gte: startDate.toDate(),
                        $lte: endDate.toDate()
                    }
                }).populate({
                    path: 'serviceId',
                    select: 'basePrice commissionRate'
                });

                let totalCommission = 0;

                // Get roles to check for default commission rate
                const staffWithRoles = await AccountAdmin.findById(staff._id).populate('roles');
                const defaultRolesCommission = Math.max(...(staffWithRoles?.roles as any || []).map((r: any) => r.commissionRate || 0), 0);

                for (const booking of completedBookings) {
                    const service = booking.serviceId as any;
                    const commissionRate = (service?.commissionRate > 0) ? service.commissionRate : defaultRolesCommission;

                    if (commissionRate > 0) {
                        totalCommission += (booking.total || 0) * (commissionRate / 100);
                    }
                }

                // Calculate salary
                const baseSalary = staff.baseSalary || 0;
                const dailySalary = baseSalary / 26; // Assume 26 working days/month
                const hourlySalary = dailySalary / 8;

                const workDaysPay = totalWorkDays * dailySalary;
                const overtimePay = totalOvertimeHours * hourlySalary * 1.5;
                const totalSalary = workDaysPay + overtimePay + totalCommission;

                const attendance = new Attendance({
                    staffId: staff._id,
                    month,
                    year,
                    totalWorkDays,
                    totalWorkHours,
                    totalOvertimeHours,
                    totalAbsentDays,
                    totalLeaveDays,
                    baseSalary,
                    overtimePay,
                    bonuses: totalCommission, // Use bonuses field to store commission for now, or we could add a new field
                    deductions: 0,
                    totalSalary,
                    status: 'draft',
                    notes: totalCommission > 0 ? `Hoa hồng dịch vụ: ${totalCommission.toLocaleString()}đ` : ""
                });

                await attendance.save();

                results.push({
                    staffId: staff._id,
                    staffName: staff.fullName,
                    status: 'created',
                    totalSalary
                });
            } catch (err) {
                results.push({
                    staffId: staff._id,
                    staffName: staff.fullName,
                    status: 'error',
                    message: 'Lỗi tạo bảng công'
                });
            }
        }

        res.status(201).json({
            code: 201,
            message: "Tạo bảng công thành công",
            data: results
        });
    } catch (error) {
        console.error("Error generating attendance:", error);
        res.status(500).json({
            code: 500,
            message: "Lỗi khi tạo bảng công"
        });
    }
};

// [PATCH] /api/v1/admin/attendance/:id
export const update = async (req: Request, res: Response) => {
    try {
        const { bonuses, deductions, notes } = req.body;

        const attendance = await Attendance.findById(req.params.id);

        if (!attendance) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy bảng công"
            });
        }

        if (bonuses !== undefined) attendance.bonuses = bonuses;
        if (deductions !== undefined) attendance.deductions = deductions;
        if (notes !== undefined) attendance.notes = notes;

        // Recalculate total salary
        const workDaysPay = attendance.totalWorkDays * (attendance.baseSalary / 26);
        attendance.totalSalary = workDaysPay + attendance.overtimePay + attendance.bonuses - attendance.deductions;

        await attendance.save();

        res.json({
            code: 200,
            message: "Cập nhật bảng công thành công",
            data: attendance
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật bảng công"
        });
    }
};

// [POST] /api/v1/admin/attendance/:id/approve
export const approve = async (req: Request, res: Response) => {
    try {
        const approvedBy = (req as any).user?.id;

        const attendance = await Attendance.findById(req.params.id);

        if (!attendance) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy bảng công"
            });
        }

        if (attendance.status !== 'draft') {
            return res.status(400).json({
                code: 400,
                message: "Bảng công đã được phê duyệt hoặc đã thanh toán"
            });
        }

        attendance.status = 'approved';
        attendance.approvedBy = approvedBy;
        attendance.approvedAt = new Date();

        await attendance.save();

        res.json({
            code: 200,
            message: "Phê duyệt bảng công thành công",
            data: attendance
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi phê duyệt bảng công"
        });
    }
};

// [DELETE] /api/v1/admin/attendance/:id
export const remove = async (req: Request, res: Response) => {
    try {
        const attendance = await Attendance.findById(req.params.id);

        if (!attendance) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy bảng công"
            });
        }

        if (attendance.status === 'paid') {
            return res.status(400).json({
                code: 400,
                message: "Không thể xóa bảng công đã thanh toán"
            });
        }

        const result = await Attendance.deleteOne({ _id: req.params.id });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy bảng công để xóa"
            });
        }

        res.json({
            code: 200,
            message: "Xóa bảng công vĩnh viễn thành công"
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa bảng công"
        });
    }
};
