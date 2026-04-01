import BoardingBooking from "../models/boarding-booking.model";
import WorkSchedule from "../models/work-schedule.model";
import AccountAdmin from "../models/account-admin.model";
import Department from "../models/department.model";
import Role from "../models/role.model";
import BoardingConfig from "../models/boarding-config.model";

const normalizeLookupText = (value: unknown) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

async function getBoardingHotelDepartmentIds() {
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
                name.includes("noi tru") ||
                name.includes("phong") ||
                name.includes("dich vu") ||
                code.includes("hotel") ||
                code.includes("boarding") ||
                code.includes("khachsan") ||
                code.includes("khach-san") ||
                code.includes("cs") ||
                code.includes("ks") ||
                code.includes("nt") ||
                code.includes("bc")
            );
        })
        .map((item: any) => item._id);
}

async function getBoardingHotelStaffRoleIds() {
    const departmentIds = await getBoardingHotelDepartmentIds();
    const filter: any = {
        deleted: false,
        status: "active",
    };

    if (departmentIds.length > 0) {
        filter.departmentId = { $in: departmentIds };
    } else {
        filter.isStaff = true;
    }

    const roles = await Role.find(filter).select("_id");
    return roles.map((item) => item._id);
}

export async function getBoardingHotelStaffAccounts(staffIds?: string[]) {
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
}

/**
 * Tìm nhân viên khách sạn rảnh nhất (có ít lượt gán nhiệm vụ nhất) trong một ngày cụ thể
 */
export async function getFreestBoardingStaffForDate(
    dateVal: string | Date | undefined, 
    batchWorkload: Record<string, number> = {},
    upcomingItemsCount: number = 1
) {
    if (!dateVal) return undefined;
    const dateObj = new Date(dateVal);
    if (Number.isNaN(dateObj.getTime())) return undefined;

    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Tìm tất cả nhân viên có lịch trực trong ngày
    const scheduledStaffIds = await WorkSchedule.distinct("staffId", {
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ["scheduled", "checked-in", "checked-out"] },
    });

    if (!Array.isArray(scheduledStaffIds) || scheduledStaffIds.length === 0) {
        return undefined;
    }

    // 2. Lấy thông tin tài khoản của họ
    const staffs = await getBoardingHotelStaffAccounts(scheduledStaffIds.map((id) => String(id)));
    if (staffs.length === 0) return undefined;

    // 3. Tính toán "tải trọng" (workload) dựa trên số lượng thú cưng (item) đang được gán
    const staffWorkloads = await Promise.all(staffs.map(async (staff) => {
        const staffIdStr = String(staff._id);

        const activeBookings = await BoardingBooking.find({
            deleted: false,
            boardingStatus: { $in: ["confirmed", "checked-in"] },
            $or: [
                { "feedingSchedule.staffId": staffIdStr },
                { "exerciseSchedule.staffId": staffIdStr }
            ]
        }).select("items feedingSchedule exerciseSchedule").lean();

        // Count items assigned to this staff across all bookings
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

        // Add workload from current batch in progress
        const inMemory = batchWorkload[staffIdStr] || 0;

        return {
            staff,
            workload: itemWorkload + inMemory
        };
    }));

    const config = (await BoardingConfig.findOne()) || { maxCagesPerStaff: 10 };
    const maxLimit = config.maxCagesPerStaff || 10;

    // 4. Lọc bỏ người đã đạt giới hạn (tính cả đơn hàng sắp gán này)
    const eligibleWorkloads = staffWorkloads.filter((sw) => sw.workload + upcomingItemsCount <= maxLimit);
    if (eligibleWorkloads.length === 0) {
        return undefined;
    }

    eligibleWorkloads.sort((a, b) => a.workload - b.workload);
    const freestStaff = eligibleWorkloads[0].staff;

    return {
        staffId: String(freestStaff._id),
        staffName: String(freestStaff.fullName || ""),
    };
}
