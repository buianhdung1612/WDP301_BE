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
    restrictedStaffIds?: string[]
) => {
    const dStart = dayjs(startTime);
    const dEnd = dayjs(endTime);
    const targetDate = dayjs(bookingDate);

    console.log(`--- Finding best staff for ${targetDate.format("YYYY-MM-DD")} ${dStart.format("HH:mm")}-${dEnd.format("HH:mm")} ---`);

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
        query.staffId = { $in: restrictedStaffIds };
    }

    const schedules = await WorkSchedule.find(query).populate("staffId").populate("shiftId");

    console.log(`FOUND ${schedules.length} schedules in DB`);

    // 2. Lấy tất cả bookings đã phân công trong ngày để tránh trùng lịch
    const assignedBookings = await Booking.find({
        _id: { $ne: excludeBookingId },
        deleted: false,
        bookingStatus: { $in: ["confirmed", "delayed", "in-progress", "completed"] },
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
        //     console.log(`  x ${staff.fullName}: inactive`);
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
            console.log(`  x ${staff.fullName}: cannot perform service ${serviceId}`);
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
            console.log(`  x ${staff.fullName}: time ${reqStartMin}-${reqEndMin} outside shift ${shiftStartMin}-${shiftEndMin}`);
            continue;
        }

        // C. Kiểm tra trùng lịch
        const isOverlapping = assignedBookings.some(b => {
            const bStaffIds = b.staffIds?.map((id: any) => id.toString()) || [];
            if (!bStaffIds.includes(staff._id.toString())) return false;

            const bStart = dayjs(b.actualStart || b.start);
            const bEnd = dayjs(b.completedAt || b.expectedFinish || b.end);

            return (dStart.isBefore(bEnd) && dEnd.isAfter(bStart));
        });

        if (isOverlapping) {
            console.log(`  x ${staff.fullName}: overlapping booking`);
            continue;
        }

        // D. Tính điểm
        let score = 100;

        // 1. History (completed tasks)
        const historyCount = await Booking.countDocuments({
            staffIds: staff._id,
            serviceId: serviceId,
            bookingStatus: "completed",
            deleted: false
        });
        score += historyCount * 5;

        // 2. Rating
        const staffReviews = allReviews.filter(r => r.staffId?.toString() === staff._id.toString());
        if (staffReviews.length > 0) {
            const avgRating = staffReviews.reduce((sum, r) => sum + r.rating, 0) / staffReviews.length;
            score += avgRating * 2;
        }

        // 3. Workload penalty
        const todayCount = assignedBookings.filter(b => {
            const bStaffIds = b.staffIds?.map((id: any) => id.toString()) || [];
            return bStaffIds.includes(staff._id.toString());
        }).length;
        score -= todayCount * 10;

        console.log(`  v ${staff.fullName}: eligible (score ${score})`);
        availableStaffList.push({ staff, score });
    }

    // Sort by score descending and return
    const result = availableStaffList
        .sort((a, b) => b.score - a.score)
        .map(item => item.staff);

    // If we have more pets than available staff, we still return the available staff
    // The autoAssignPetsToStaff helper will handle round-robin assignment
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
