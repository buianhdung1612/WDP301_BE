import { Request, Response } from 'express';
import Order from '../../models/order.model';
import Booking from '../../models/booking.model';
import BoardingBooking from '../../models/boarding-booking.model';
import Product from '../../models/product.model';
import AccountAdmin from '../../models/account-admin.model';
import AccountUser from '../../models/account-user.model';
import Pet from "../../models/pet.model";
import BookingConfig from "../../models/booking-config.model";
import WorkSchedule from "../../models/work-schedule.model";
import CategoryProduct from '../../models/category-product.model';
import dayjs from 'dayjs';

/**
 * [GET] /api/v1/admin/dashboard/ecommerce-stats
 * Cập nhật logic: Nhóm Doanh thu theo DANH MỤC CẤP CHA CAO NHẤT (Root Category)
 */
export const getEcommerceStats = async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const baseMatch = { orderStatus: "completed", deleted: false };

        const [
            currentStats, lastStats, yearlyData, topCategoriesRes,
            totalProducts, totalUsers, recentOrders, recentProducts, topProducts
        ] = await Promise.all([
            // 1. Doanh thu tháng này
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfMonth }, ...baseMatch } },
                { $group: { _id: null, total: { $sum: { $subtract: ["$total", { $ifNull: ["$shipping.fee", 0] }] } }, count: { $sum: 1 } } }
            ]),
            // 2. Doanh thu tháng trước
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }, ...baseMatch } },
                { $group: { _id: null, total: { $sum: { $subtract: ["$total", { $ifNull: ["$shipping.fee", 0] }] } }, count: { $sum: 1 } } }
            ]),
            // 3. Doanh thu theo tháng
            Order.aggregate([
                { $match: { createdAt: { $gte: new Date(now.getFullYear(), 0, 1) }, ...baseMatch } },
                { $group: { _id: { $month: "$createdAt" }, total: { $sum: { $subtract: ["$total", { $ifNull: ["$shipping.fee", 0] }] } } } },
                { $sort: { "_id": 1 } }
            ]),
            // 4. Doanh thu theo DANH MỤC CẤP CAO NHẤT (Sử dụng $graphLookup để tìm cha gốc)
            Order.aggregate([
                { $match: baseMatch },
                { $unwind: "$items" },
                {
                    $lookup: {
                        from: "products",
                        localField: "items.productId",
                        foreignField: "_id",
                        as: "productInfo"
                    }
                },
                { $unwind: "$productInfo" },
                // Tìm tất cả tổ tiên của danh mục hiện tại
                {
                    $graphLookup: {
                        from: "categories-product",
                        startWith: "$productInfo.categoryId",
                        connectFromField: "parent",
                        connectToField: "_id",
                        as: "ancestors"
                    }
                },
                // Chọn danh mục cha gốc (là danh mục trong ancestors mà có parent == null hoặc chính là danh mục đó nếu nó là gốc)
                {
                    $addFields: {
                        rootCategory: {
                            $reduce: {
                                input: "$ancestors",
                                initialValue: null,
                                in: {
                                    $cond: [
                                        { $eq: ["$$this.parent", null] },
                                        "$$this.name",
                                        "$$value"
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: { $ifNull: ["$rootCategory", "Khác"] },
                        total: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
                    }
                },
                { $sort: { total: -1 } },
                { $limit: 10 }
            ]),
            Product.countDocuments({ deleted: false }),
            AccountUser.countDocuments({ deleted: false }),
            Order.find({ deleted: false }).sort({ createdAt: -1 }).limit(5).populate('userId', 'fullName avatar'),
            Product.find({ deleted: false }).sort({ createdAt: -1 }).limit(5),
            Order.aggregate([
                { $match: baseMatch },
                { $unwind: "$items" },
                { $group: { _id: "$items.productId", name: { $first: "$items.name" }, totalQuantity: { $sum: "$items.quantity" }, totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } } } },
                { $sort: { totalQuantity: -1 } },
                { $limit: 5 }
            ])
        ]);

        const topCustomersRaw = await Order.aggregate([
            { $match: baseMatch },
            { $group: { _id: "$userId", totalSpent: { $sum: "$total" }, totalOrders: { $sum: 1 } } },
            { $sort: { totalSpent: -1 } },
            { $limit: 5 }
        ]);

        const topCustomers = await Promise.all(topCustomersRaw.map(async (c) => {
            const user = await AccountUser.findById(c._id).select('fullName avatar');
            return { ...c, fullName: user?.fullName || 'Khách vãng lai', avatar: user?.avatar };
        }));

        const yearlyRevenueChart = Array(12).fill(0);
        yearlyData.forEach(item => { yearlyRevenueChart[item._id - 1] = item.total; });

        const [serviceCount, boardingCount] = await Promise.all([
            Booking.countDocuments({ bookingStatus: 'completed', deleted: false }),
            BoardingBooking.countDocuments({ boardingStatus: 'checked-out', deleted: false })
        ]);

        const currentRevenue = currentStats[0]?.total || 0;
        const lastRevenue = lastStats[0]?.total || 0;
        const revenueMonthPercent = lastRevenue === 0 ? 100 : ((currentRevenue - lastRevenue) / lastRevenue) * 100;

        res.json({
            success: true,
            data: {
                summary: {
                    monthlyRevenue: currentRevenue,
                    revenueMonthPercent,
                    totalOrders: currentStats[0]?.count || 0,
                    totalServiceBookings: serviceCount,
                    totalBoardingBookings: boardingCount,
                    totalProducts,
                    totalUsers
                },
                recentOrders,
                recentProducts,
                topSellingProducts: topProducts,
                topCustomers,
                yearlyRevenueChart,
                topCategories: topCategoriesRes.map(c => ({ label: c._id, total: c.total }))
            }
        });
    } catch (error: any) {
        console.error("Ecommerce Stats Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * [GET] /api/v1/admin/dashboard/analytics-stats
 */
export const getAnalyticsStats = async (req: Request, res: Response) => {
    try {
        const now = dayjs();
        const thisWeekStart = now.subtract(7, 'day').startOf('day').toDate();
        const lastWeekStart = now.subtract(14, 'day').startOf('day').toDate();
        const lastWeekEnd = now.subtract(7, 'day').endOf('day').toDate();

        const [
            thisWeekSalesRes,
            lastWeekSalesRes,
            thisWeekUsers,
            lastWeekUsers,
            thisWeekOrders,
            lastWeekOrders,
            totalPets,
            lastWeekPets,
            ordersByStatus,
            monthlyOrdersRes,
            totalOrders
        ] = await Promise.all([
            // Sales
            Order.aggregate([
                { $match: { createdAt: { $gte: thisWeekStart }, deleted: false, orderStatus: 'completed' } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, total: { $sum: "$total" } } },
                { $sort: { "_id": 1 } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd }, deleted: false, orderStatus: 'completed' } },
                { $group: { _id: null, total: { $sum: "$total" } } }
            ]),
            // Users
            AccountUser.countDocuments({ createdAt: { $gte: thisWeekStart }, deleted: false }),
            AccountUser.countDocuments({ createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd }, deleted: false }),
            // Orders
            Order.countDocuments({ createdAt: { $gte: thisWeekStart }, deleted: false }),
            Order.countDocuments({ createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd }, deleted: false }),
            // Pets
            Pet.countDocuments({ deleted: false }),
            Pet.countDocuments({ createdAt: { $gte: thisWeekStart }, deleted: false }),
            // Distributions
            Order.aggregate([{ $match: { deleted: false } }, { $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
            Order.aggregate([
                { $match: { deleted: false, createdAt: { $gte: dayjs().startOf('year').toDate() } } },
                { $group: { _id: { month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { "_id.month": 1 } }
            ]),
            Order.countDocuments({ deleted: false })
        ]);

        const weeklyRevenueTable: Record<string, number> = {};
        thisWeekSalesRes.forEach(item => weeklyRevenueTable[item._id] = item.total);
        const weeklyRevenueData = Array.from({ length: 7 }).map((_, i) => {
            const d = dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD');
            return weeklyRevenueTable[d] || 0;
        });

        const thisWeekSalesTotal = weeklyRevenueData.reduce((a, b) => a + b, 0);
        const lastWeekSalesTotal = lastWeekSalesRes[0]?.total || 0;

        const monthlyVisits = Array(12).fill(0);
        monthlyOrdersRes.forEach(item => { monthlyVisits[item._id.month - 1] = item.count; });

        const calculatePercent = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return parseFloat(((current - previous) / previous * 100).toFixed(1));
        };

        const statusMap: any = {
            'pending': 'Chờ xác nhận',
            'confirmed': 'Đã xác nhận',
            'shipping': 'Đang giao',
            'completed': 'Hoàn thành',
            'cancelled': 'Đã hủy',
            'refunded': 'Hoàn tiền'
        };

        res.json({
            success: true,
            data: {
                weeklySales: {
                    total: thisWeekSalesTotal,
                    percent: calculatePercent(thisWeekSalesTotal, lastWeekSalesTotal),
                    data: weeklyRevenueData
                },
                newUsers: {
                    total: thisWeekUsers,
                    percent: calculatePercent(thisWeekUsers, lastWeekUsers)
                },
                purchaseOrders: {
                    total: totalOrders,
                    percent: calculatePercent(thisWeekOrders, lastWeekOrders) // Growth in orders this week vs last week
                },
                pets: {
                    total: totalPets,
                    percent: calculatePercent(lastWeekPets, totalPets - lastWeekPets) // Growth in pet count
                },
                orderDistribution: ordersByStatus.map(o => ({
                    label: statusMap[o._id] || o._id,
                    value: o.count
                })),
                websiteVisits: monthlyVisits
            }
        });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

/**
 * [GET] /api/v1/admin/dashboard/system-stats
 */
export const getSystemStats = async (req: Request, res: Response) => {
    try {
        const now = dayjs();
        const sevenDaysAgo = now.subtract(7, 'day').toDate();
        const fourteenDaysAgo = now.subtract(14, 'day').toDate();

        const [
            petStats,
            totalUsers, lastWeekUsers,
            totalAdmins, lastWeekAdmins,
            totalPets, lastWeekPets,
            newProducts, topProducts, topCustomersRes, serviceUsageRes,
            userTrendRes, petTrendRes
        ] = await Promise.all([
            Pet.aggregate([{ $match: { deleted: false } }, { $group: { _id: "$type", count: { $sum: 1 } } }]),
            AccountUser.countDocuments({ deleted: false }),
            AccountUser.countDocuments({ deleted: false, createdAt: { $lte: sevenDaysAgo } }),
            AccountAdmin.countDocuments({ deleted: false }),
            AccountAdmin.countDocuments({ deleted: false, createdAt: { $lte: sevenDaysAgo } }),
            Pet.countDocuments({ deleted: false }),
            Pet.countDocuments({ deleted: false, createdAt: { $lte: sevenDaysAgo } }),
            Product.find({ deleted: false }).sort({ createdAt: -1 }).limit(5),
            Order.aggregate([
                { $match: { deleted: false } },
                { $unwind: "$items" },
                { $group: { _id: "$items.productId", name: { $first: "$items.name" }, totalQuantity: { $sum: "$items.quantity" }, totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } } } },
                { $sort: { totalQuantity: -1 } },
                { $limit: 5 }
            ]),
            Order.aggregate([
                { $match: { deleted: false } },
                { $group: { _id: "$userId", totalSpent: { $sum: "$total" }, totalOrders: { $sum: 1 } } },
                { $sort: { totalSpent: -1 } },
                { $limit: 3 }
            ]),
            Booking.aggregate([
                { $match: { deleted: false } },
                { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "serviceInfo" } },
                { $unwind: "$serviceInfo" },
                { $group: { _id: "$serviceInfo.name", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 3 }
            ]),
            // Trends
            AccountUser.aggregate([
                { $match: { deleted: false, createdAt: { $gte: sevenDaysAgo } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }
            ]),
            Pet.aggregate([
                { $match: { deleted: false, createdAt: { $gte: sevenDaysAgo } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }
            ])
        ]);

        const topCustomers = await Promise.all(topCustomersRes.map(async (c) => {
            const user = await AccountUser.findById(c._id).select('fullName avatar');
            return { ...c, fullName: user?.fullName || 'Khách vãng lai', avatar: user?.avatar };
        }));

        const calculatePercent = (current: number, previousTotal: number) => {
            if (previousTotal === 0) return current > 0 ? 100 : 0;
            const newCount = current - previousTotal;
            return parseFloat(((newCount / previousTotal) * 100).toFixed(1));
        };

        const getTrendData = (res: any[]) => {
            const map: any = {};
            res.forEach(i => map[i._id] = i.count);
            return Array.from({ length: 7 }).map((_, i) => {
                const d = dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD');
                return map[d] || 0;
            });
        };

        res.json({
            success: true,
            data: {
                petDistribution: petStats.map(p => ({ label: p._id === 'dog' ? 'Chó' : p._id === 'cat' ? 'Mèo' : 'Khác', count: p.count })),
                systemStats: {
                    users: { total: totalUsers, percent: calculatePercent(totalUsers, lastWeekUsers), trend: getTrendData(userTrendRes) },
                    admins: { total: totalAdmins, percent: calculatePercent(totalAdmins, lastWeekAdmins), trend: [1, 1, 0, 0, 1, 0, 0] },
                    pets: { total: totalPets, percent: calculatePercent(totalPets, lastWeekPets), trend: getTrendData(petTrendRes) }
                },
                newProducts,
                topSellingProducts: topProducts,
                topCustomers,
                serviceUsage: serviceUsageRes.map(s => ({ name: s._id, count: s.count }))
            }
        });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

/**
 * [GET] /api/v1/admin/dashboard/staffing-status
 */
export const getStaffingStatus = async (req: Request, res: Response) => {
    try {
        const date = req.query.date ? new Date(req.query.date as string) : new Date();
        const startOfDay = dayjs(date).startOf('day').toDate();
        const endOfDay = dayjs(date).endOf('day').toDate();
        const [config, schedules] = await Promise.all([
            BookingConfig.findOne({}),
            WorkSchedule.find({ date: { $gte: startOfDay, $lte: endOfDay }, status: { $in: ["scheduled", "checked-in"] } }).populate({ path: 'staffId', select: 'fullName roles', populate: { path: 'roles', select: 'name' } })
        ]);
        if (!config || !config.staffingRules || config.staffingRules.length === 0) { return res.json({ code: 200, data: [], message: "Chưa cấu hình định mức nhân sự." }); }

        const results = config.staffingRules.map((rule: any) => {
            const shiftSchedules = schedules.filter(s => s.shiftId.toString() === rule.shiftId.toString());
            const requirements = rule.roleRequirements.map((reqRef: any) => {
                const actualStaffCount = shiftSchedules.filter(s => {
                    const staff = s.staffId as any;
                    return staff?.roles?.some((r: any) => r._id.toString() === reqRef.roleId.toString());
                }).length;
                return { roleId: reqRef.roleId, required: reqRef.minStaff, actual: actualStaffCount, status: actualStaffCount >= reqRef.minStaff ? "vừa đủ" : "thiếu", diff: actualStaffCount - reqRef.minStaff };
            });
            return { shiftId: rule.shiftId, requirements };
        });
        res.json({ code: 200, data: results });
    } catch (error) { res.status(500).json({ code: 500, message: "Lỗi kiểm tra định mức nhân sự" }); }
};

/**
 * [GET] /api/v1/admin/dashboard/boarding-stats
 */
export const getBoardingStats = async (req: Request, res: Response) => {
    try {
        const [totalBookings, checkedInBookings, confirmedBookings] = await Promise.all([
            BoardingBooking.countDocuments({ deleted: false }),
            BoardingBooking.countDocuments({ boardingStatus: "checked-in", deleted: false }),
            BoardingBooking.countDocuments({ boardingStatus: "confirmed", deleted: false }),
        ]);
        const urgentBookings = await BoardingBooking.find({ boardingStatus: "checked-in", deleted: false }).select('feedingSchedule exerciseSchedule');
        let urgentFeeding = 0; let urgentExercise = 0;
        urgentBookings.forEach(b => {
            urgentFeeding += (b.feedingSchedule || []).filter((f: any) => f.status === 'pending').length;
            urgentExercise += (b.exerciseSchedule || []).filter((e: any) => e.status === 'pending').length;
        });
        res.json({ success: true, data: { totalBookings, activeBookings: checkedInBookings, upcomingBookings: confirmedBookings, urgentFeeding, urgentExercise } });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const getServiceStats = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const match: any = { deleted: false };
        if (startDate && endDate) { match.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) }; }
        const [popularServices, staffPerformance, revenueByCategory] = await Promise.all([
            // Top 10 dịch vụ được đặt nhiều nhất
            Booking.aggregate([
                { $match: match },
                { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "serviceInfo" } },
                { $unwind: "$serviceInfo" },
                { $group: { _id: "$serviceInfo.name", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            // Hiệu suất nhân viên: Số dịch vụ đã xử lý hoàn thành
            Booking.aggregate([
                { $match: { ...match, bookingStatus: "completed" } },
                { $unwind: "$petStaffMap" },
                { $match: { "petStaffMap.status": "completed" } },
                { $group: { _id: "$petStaffMap.staffId", count: { $sum: 1 } } },
                { $lookup: { from: "accounts-admin", localField: "_id", foreignField: "_id", as: "staff" } },
                { $unwind: "$staff" },
                { $project: { _id: 1, count: 1, name: "$staff.fullName" } }
            ]),
            // Doanh mục dịch vụ mang lại doanh thu cao nhất
            Booking.aggregate([
                { $match: { ...match, bookingStatus: "completed" } },
                { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "serviceInfo" } },
                { $unwind: "$serviceInfo" },
                { $lookup: { from: "categories-service", localField: "serviceInfo.categoryId", foreignField: "_id", as: "cat" } },
                { $unwind: "$cat" },
                { $group: { _id: "$cat.name", total: { $sum: "$total" }, count: { $sum: 1 } } }
            ])
        ]);
        res.json({ success: true, data: { popularServices, staffPerformance, revenueByCategory } });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const getOrderStats = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const match: any = { deleted: false, orderStatus: 'completed' };
        if (startDate && endDate) { match.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) }; }
        const [revenueByCategory, topProducts, orderDistribution] = await Promise.all([
            Order.aggregate([
                { $match: match },
                { $unwind: "$items" },
                { $lookup: { from: "products", localField: "items.productId", foreignField: "_id", as: "product" } },
                { $unwind: "$product" },
                { $lookup: { from: "categories-product", localField: "product.categoryId", foreignField: "_id", as: "cat" } },
                { $unwind: "$cat" },
                { $group: { _id: "$cat.name", total: { $sum: { $multiply: ["$items.quantity", "$items.price"] } } } }
            ]),
            Order.aggregate([
                { $match: match },
                { $unwind: "$items" },
                { $group: { _id: "$items.productId", name: { $first: "$items.name" }, totalQuantity: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } } } },
                { $sort: { totalQuantity: -1 } },
                { $limit: 5 }
            ]),
            Order.aggregate([{ $match: { deleted: false } }, { $group: { _id: "$orderStatus", count: { $sum: 1 } } }])
        ]);
        res.json({ success: true, data: { revenueByCategory, topProducts, orderDistribution } });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const getDetailedBoardingStats = async (req: Request, res: Response) => {
    try {
        const [occupancyRes, revenueByCageType, stayDuration] = await Promise.all([
            // Occupancy
            BoardingBooking.aggregate([
                { $match: { boardingStatus: "checked-in", deleted: false } }, 
                { $lookup: { from: "boarding-cages", localField: "cageId", foreignField: "_id", as: "cageInfo" } }, 
                { $unwind: { path: "$cageInfo", preserveNullAndEmptyArrays: true } },
                { $group: { _id: { $ifNull: ["$cageInfo.cageCode", "Khác"] }, count: { $sum: 1 } } }
            ]),
            // Revenue by cage
            BoardingBooking.aggregate([
                { $match: { boardingStatus: "checked-out", deleted: false } }, 
                { $lookup: { from: "boarding-cages", localField: "cageId", foreignField: "_id", as: "cage" } }, 
                { $unwind: { path: "$cage", preserveNullAndEmptyArrays: true } }, 
                { $group: { _id: { $ifNull: ["$cage.type", "Khác"] }, total: { $sum: "$total" } } }
            ]),
            // Stay Duration
            BoardingBooking.aggregate([
                { $match: { boardingStatus: "checked-out", deleted: false } }, 
                { $group: { _id: null, avgDays: { $avg: "$numberOfDays" } } }
            ])
        ]);
        res.json({ success: true, data: { occupancyRes, revenueByCageType, avgStayDuration: stayDuration[0]?.avgDays || 0 } });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const getStaffStats = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const match: any = { deleted: false };
        if (startDate && endDate) { match.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) }; }
        const [servicePerformance, workAttendance] = await Promise.all([
            Booking.aggregate([{ $match: { ...match, bookingStatus: "completed" } }, { $unwind: "$petStaffMap" }, { $match: { "petStaffMap.status": "completed" } }, { $group: { _id: "$petStaffMap.staffId", count: { $sum: 1 } } }, { $lookup: { from: "accounts-admin", localField: "_id", foreignField: "_id", as: "staff" } }, { $unwind: "$staff" }, { $project: { name: "$staff.fullName", count: 1 } }, { $sort: { count: -1 } }]),
            WorkSchedule.aggregate([{ $match: { date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }, status: "scheduled" } }, { $group: { _id: "$staffId", count: { $sum: 1 } } }, { $lookup: { from: "accounts-admin", localField: "_id", foreignField: "_id", as: "staff" } }, { $unwind: "$staff" }, { $project: { name: "$staff.fullName", count: 1 } }])
        ]);
        res.json({ success: true, data: { servicePerformance, workAttendance } });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};
