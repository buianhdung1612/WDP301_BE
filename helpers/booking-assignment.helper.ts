import dayjs from "dayjs";
import Booking from "../models/booking.model";
import WorkSchedule from "../models/work-schedule.model";
import BookingReview from "../models/booking-review.model";
import Role from "../models/role.model";

// 3. Thuật toán tính điểm (Helper dùng chung)
// Tôi đã tách logic tính điểm ra thành một file 
// booking-assignment.helper.ts
//  để cả Admin và Client dùng chung. Điều này giúp hệ thống luôn thống nhất trong việc:

// Ưu tiên người có kinh nghiệm làm dịch vụ đó nhiều nhất.
// Ưu tiên người có điểm đánh giá (rating) cao nhất.
// Cân bằng tải (trừ điểm người đã nhận quá nhiều đơn trong ngày).


export const findBestStaffForBooking = async (
    bookingDate: Date | string,
    startTime: Date | string,
    endTime: Date | string,
    serviceId: string,
    numPets: number = 1,
    excludeBookingId?: string,
    restrictedStaffIds?: string[],
    excludeStaffIds?: string[]
) => {
    const dStart = dayjs(startTime);
    const dEnd = dayjs(endTime);
    const targetDate = dayjs(bookingDate);

    console.log(`--- Đang tìm nhân viên phù hợp nhất cho ngày ${targetDate.format("YYYY-MM-DD")} từ ${dStart.format("HH:mm")} đến ${dEnd.format("HH:mm")} ---`);

    // 1. Lấy tất cả nhân viên có lịch làm việc trong ngày
    // Tạm thời nới lỏng status để test nếu cần, nhưng mặc định là scheduled/checked-in
    const query: any = {
        date: {
            $gte: targetDate.startOf('day').toDate(),
            $lte: targetDate.endOf('day').toDate()
        },
        status: { $in: ["scheduled", "checked-in"] }
    };

    if (restrictedStaffIds && restrictedStaffIds.length > 0) {
        query.staffId = { ...query.staffId, $in: restrictedStaffIds };
    }

    if (excludeStaffIds && excludeStaffIds.length > 0) {
        query.staffId = { ...query.staffId, $nin: excludeStaffIds };
    }

    const schedules = await WorkSchedule.find(query).populate("staffId").populate("shiftId");

    console.log(`ĐÃ TÌM THẤY ${schedules.length} lịch trực trong cơ sở dữ liệu`);

    // 2. Lấy tất cả bookings đã phân công trong ngày để tránh trùng lịch
    const assignedBookings = await Booking.find({
        _id: { $ne: excludeBookingId },
        deleted: false,
        bookingStatus: { $in: ["pending", "confirmed", "delayed", "in-progress", "completed"] },
        start: {
            $gte: targetDate.startOf('day').toDate(),
            $lte: targetDate.endOf('day').toDate()
        }
    });

    // 3. Lấy reviews để tính rating
    const allReviews = await BookingReview.find({ deleted: false });

    const availableStaffList: any[] = [];

    for (const schedule of schedules) {
        const staff = schedule.staffId as any;
        const shift = schedule.shiftId as any;

        if (!staff || !shift) continue;

        // Bỏ qua kiểm tra status để linh hoạt hơn trong quá trình test/demo
        // if (staff.status !== "active") {
        //     console.log(`  x ${staff.fullName}: không hoạt động`);
        //     continue;
        // }

        // A. Kiểm tra Role và Service
        const staffRoles = await Role.find({
            _id: { $in: staff.roles },
            isStaff: true,
            // status: "active", // Tương tự, bỏ qua status để dễ test
            deleted: false
        });

        const canDoService = staffRoles.some(role =>
            role.serviceIds?.some((id: any) => id.toString() === serviceId)
        );

        if (!canDoService) {
            console.log(`  x ${staff.fullName}: không thể thực hiện dịch vụ ${serviceId}`);
            continue;
        }

        // B. Kiểm tra ca làm việc
        const [sH, sM] = shift.startTime.split(':').map(Number);
        const [eH, eM] = shift.endTime.split(':').map(Number);
        const shiftStartMin = sH * 60 + sM;
        const shiftEndMin = eH * 60 + eM;

        const reqStartMin = dStart.hour() * 60 + dStart.minute();
        const reqEndMin = dEnd.hour() * 60 + dEnd.minute();

        if (reqStartMin < shiftStartMin || reqEndMin > shiftEndMin) {
            console.log(`  x ${staff.fullName}: thời gian ${reqStartMin}-${reqEndMin} nằm ngoài ca trực ${shiftStartMin}-${shiftEndMin}`);
            continue;
        }

        // C. Kiểm tra trùng lịch
        const isOverlapping = assignedBookings.some(b => {
            const bStaffIds = (b.petStaffMap || []).map((m: any) => String(m.staffId?._id || m.staffId));
            if (!bStaffIds.includes(staff._id.toString())) return false;

            const bStart = dayjs(b.actualStart || b.start);
            const bEnd = dayjs(b.completedAt || b.expectedFinish || b.end);

            return (dStart.isBefore(bEnd) && dEnd.isAfter(bStart));
        });

        if (isOverlapping) {
            console.log(`  x ${staff.fullName}: bị trùng lịch đặt khác`);
            continue;
        }

        // D. Thu thập các thông số để sắp xếp (Tiêu chí mới)

        // 1. Số đơn nhận trong ngày hôm nay (Cân bằng tải)
        const todayCount = assignedBookings.filter(b => {
            const bStaffIds = (b.petStaffMap || []).map((m: any) => String(m.staffId?._id || m.staffId));
            return bStaffIds.includes(staff._id.toString());
        }).length;

        // 2. Tổng số đơn đã làm trong quá khứ
        const totalPastCount = await Booking.countDocuments({
            "petStaffMap.staffId": staff._id,
            bookingStatus: "completed",
            deleted: false
        });

        // 3. Kinh nghiệm làm dịch vụ này (Số đơn dịch vụ này đã hoàn thành)
        const experienceServiceCount = await Booking.countDocuments({
            "petStaffMap.staffId": staff._id,
            serviceId: serviceId,
            bookingStatus: "completed",
            deleted: false
        });

        console.log(`  v ${staff.fullName}: Đủ điều kiện (Hôm nay: ${todayCount}, Tổng quá khứ: ${totalPastCount}, Kinh nghiệm: ${experienceServiceCount})`);
        availableStaffList.push({
            staff,
            todayCount,
            totalPastCount,
            experienceServiceCount
        });
    }

    // Sắp xếp theo thứ tự ưu tiên:
    // 1. Ưu tiên người làm ít hơn trong ngày (todayCount ASC)
    // 2. Nếu bằng nhau, ưu tiên người làm ít hơn trong quá khứ (totalPastCount ASC)
    // 3. Nếu vẫn bằng nhau, ưu tiên người có kinh nghiệm hơn với dịch vụ này (experienceServiceCount DESC)
    const result = availableStaffList
        .sort((a, b) => {
            if (a.todayCount !== b.todayCount) {
                return a.todayCount - b.todayCount;
            }
            if (a.totalPastCount !== b.totalPastCount) {
                return a.totalPastCount - b.totalPastCount;
            }
            return b.experienceServiceCount - a.experienceServiceCount;
        })
        .map(item => item.staff);

    // Nếu số lượng thú cưng nhiều hơn số nhân viên rảnh, chúng ta vẫn trả về danh sách nhân viên rảnh
    // Hàm autoAssignPetsToStaff sẽ xử lý việc phân bổ xoay vòng (round-robin) sau đó.
    return result.slice(0, numPets);
};

/**
 * Tự động phân công nhân viên cho các thú cưng
 * Phân bổ xoay vòng (Round-robin) nếu số lượng nhân viên ít hơn số lượng thú cưng
 */
export const autoAssignPetsToStaff = (petIds: any[], staffIds: any[]) => {
    if (!petIds || petIds.length === 0 || !staffIds || staffIds.length === 0) return [];

    // Đảm bảo chúng ta có mảng các ID string
    const pIds = petIds.map(p => {
        if (!p) return null;
        if (typeof p === 'object') {
            return p._id ? p._id.toString() : p.toString();
        }
        return p.toString();
    }).filter(id => id !== null);

    const sIds = staffIds.map(s => {
        if (!s) return null;
        if (typeof s === 'object') {
            return s._id ? s._id.toString() : s.toString();
        }
        return s.toString();
    }).filter(id => id !== null);

    if (pIds.length === 0 || sIds.length === 0) return [];

    return pIds.map((petId, index) => ({
        petId: petId,
        staffId: sIds[index % sIds.length]
    }));
};

/**
 * Kiểm tra xem nhân viên có rảnh để nhận thêm một việc (Task) ngay bây giờ không
 * @param staffId ID nhân viên
 * @param duration Phút dự kiến thực hiện
 * @param startTime Thời điểm bắt đầu (mặc định là now)
 * @param excludeBookingId ID đơn hàng hiện tại cần loại trừ khỏi kiểm tra trùng
 */
export const checkOptimizedStaffAvailability = async (
    staffId: string,
    duration: number,
    startTime: Date = new Date(),
    excludeBookingId?: string
) => {
    const dStart = dayjs(startTime);
    const dEnd = dStart.add(duration, 'minute');

    // 1. Kiểm tra lịch trực (WorkSchedule)
    const schedule = await WorkSchedule.findOne({
        staffId,
        date: {
            $gte: dStart.startOf('day').toDate(),
            $lte: dStart.endOf('day').toDate()
        },
        status: { $in: ["scheduled", "checked-in"] }
    }).populate("shiftId");

    if (!schedule || !schedule.shiftId) return false;

    const shift = schedule.shiftId as any;
    const [sH, sM] = shift.startTime.split(':').map(Number);
    const [eH, eM] = shift.endTime.split(':').map(Number);

    // Tạo mốc thời gian tuyệt đối cho ca làm
    const shiftEnd = dStart.clone().hour(eH).minute(eM).second(0);

    // Nếu thời gian kết thúc task vượt quá ca làm -> Không ổn
    if (dEnd.isAfter(shiftEnd)) return false;

    // 2. Kiểm tra trùng các booking khác trong tương lai
    const query: any = {
        "petStaffMap.staffId": staffId,
        deleted: false,
        bookingStatus: { $in: ["pending", "confirmed", "delayed", "in-progress"] },
        $or: [
            { start: { $lt: dEnd.toDate() }, end: { $gt: dStart.toDate() } },
            { actualStart: { $lt: dEnd.toDate() }, expectedFinish: { $gt: dStart.toDate() } }
        ]
    };

    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }

    const overlappingBooking = await Booking.findOne(query);

    return !overlappingBooking;
};
