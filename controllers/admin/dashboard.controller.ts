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
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const baseMatch = { orderStatus: "completed", deleted: false };

        // 1. Fetch Month-over-Month Stats for all sources
        const [currShop, currService, currBoarding, prevShop, prevService, prevBoarding] = await Promise.all([
            Order.aggregate([{ $match: { createdAt: { $gte: startOfMonth }, ...baseMatch } }, { $group: { _id: null, total: { $sum: { $subtract: ["$total", { $ifNull: ["$shipping.fee", 0] }] } }, count: { $sum: 1 } } }]),
            Booking.aggregate([{ $match: { updatedAt: { $gte: startOfMonth }, bookingStatus: "completed", paymentStatus: "paid", deleted: false } }, { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } }]),
            BoardingBooking.aggregate([{ $match: { updatedAt: { $gte: startOfMonth }, boardingStatus: "checked-out", paymentStatus: "paid", deleted: false } }, { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } }]),
            Order.aggregate([{ $match: { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }, ...baseMatch } }, { $group: { _id: null, total: { $sum: { $subtract: ["$total", { $ifNull: ["$shipping.fee", 0] }] } }, count: { $sum: 1 } } }]),
            Booking.aggregate([{ $match: { updatedAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }, bookingStatus: "completed", paymentStatus: "paid", deleted: false } }, { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } }]),
            BoardingBooking.aggregate([{ $match: { updatedAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }, boardingStatus: "checked-out", paymentStatus: "paid", deleted: false } }, { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } }])
        ]);

        const currentRevenue = (currShop[0]?.total || 0) + (currService[0]?.total || 0) + (currBoarding[0]?.total || 0);
        const lastRevenue = (prevShop[0]?.total || 0) + (prevService[0]?.total || 0) + (prevBoarding[0]?.total || 0);
        const revenueMonthPercent = lastRevenue === 0 ? 100 : ((currentRevenue - lastRevenue) / lastRevenue) * 100;

        // 2. Yearly charts & top categories
        const [yearlyOrderData, yearlyServiceData, yearlyBoardingData, topCategoriesRes, totalProducts, totalUsers, recentOrders, recentProducts, topProducts, recentBookings, recentBoardings] = await Promise.all([
            Order.aggregate([{ $match: { createdAt: { $gte: startOfYear }, ...baseMatch } }, { $group: { _id: { $month: "$createdAt" }, total: { $sum: { $subtract: ["$total", { $ifNull: ["$shipping.fee", 0] }] } } } }, { $sort: { "_id": 1 } }]),
            Booking.aggregate([{ $match: { updatedAt: { $gte: startOfYear }, bookingStatus: "completed", paymentStatus: "paid", deleted: false } }, { $group: { _id: { $month: "$updatedAt" }, total: { $sum: "$total" } } }, { $sort: { "_id": 1 } }]),
            BoardingBooking.aggregate([{ $match: { updatedAt: { $gte: startOfYear }, boardingStatus: "checked-out", paymentStatus: "paid", deleted: false } }, { $group: { _id: { $month: "$updatedAt" }, total: { $sum: "$total" } } }, { $sort: { "_id": 1 } }]),
            Order.aggregate([
                { $match: baseMatch },
                { $unwind: "$items" },
                { $lookup: { from: "products", localField: "items.productId", foreignField: "_id", as: "p" } },
                { $unwind: "$p" },
                { $lookup: { from: "categories-product", localField: "p.categoryId", foreignField: "_id", as: "c" } },
                { $unwind: "$c" },
                { $group: { _id: "$c.name", total: { $sum: { $multiply: ["$items.quantity", "$items.price"] } } } },
                { $sort: { total: -1 } }, { $limit: 10 }
            ]),
            Product.countDocuments({ deleted: false }),
            AccountUser.countDocuments({ deleted: false }),
            Order.find({ deleted: false }).sort({ createdAt: -1 }).limit(5).populate('userId', 'fullName avatar'),
            Product.find({ deleted: false }).sort({ createdAt: -1 }).limit(5),
            Order.aggregate([
                { $match: baseMatch },
                { $unwind: "$items" },
                { $group: { _id: "$items.productId", name: { $first: "$items.name" }, totalQuantity: { $sum: "$items.quantity" }, totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } } } },
                { $sort: { totalQuantity: -1 } }, { $limit: 5 }
            ]),
            Booking.find({ bookingStatus: "completed", paymentStatus: "paid", deleted: false }).sort({ updatedAt: -1 }).limit(5).populate('userId', 'fullName avatar'),
            BoardingBooking.find({ boardingStatus: "checked-out", paymentStatus: "paid", deleted: false }).sort({ updatedAt: -1 }).limit(5).populate('userId', 'fullName avatar')
        ]);

        // 3. Process Yearly Charts
        const yearlyOrderChart = Array(12).fill(0);
        (yearlyOrderData as any[]).forEach(item => { yearlyOrderChart[item._id - 1] = item.total; });
        const yearlyServiceChart = Array(12).fill(0);
        (yearlyServiceData as any[]).forEach(item => { yearlyServiceChart[item._id - 1] = item.total; });
        const yearlyBoardingChart = Array(12).fill(0);
        (yearlyBoardingData as any[]).forEach(item => { yearlyBoardingChart[item._id - 1] = item.total; });

        // 4. All-time Totals
        const [allTimeShop, allTimeService, allTimeBoarding] = await Promise.all([
            Order.aggregate([{ $match: { orderStatus: 'completed', deleted: false } }, { $group: { _id: null, total: { $sum: { $subtract: ["$total", { $ifNull: ["$shipping.fee", 0] }] } } } }]),
            Booking.aggregate([{ $match: { bookingStatus: 'completed', paymentStatus: 'paid', deleted: false } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
            BoardingBooking.aggregate([{ $match: { boardingStatus: 'checked-out', paymentStatus: 'paid', deleted: false } }, { $group: { _id: null, total: { $sum: "$total" } } }])
        ]);

        const shopTotal = allTimeShop[0]?.total || 0;
        const serviceTotal = allTimeService[0]?.total || 0;
        const boardingTotal = allTimeBoarding[0]?.total || 0;
        const grandTotal = shopTotal + serviceTotal + boardingTotal;

        // 5. Recent Revenue Sources Hover History
        const recentRevenueSources: any[] = [];
        recentOrders.forEach((o: any) => {
            recentRevenueSources.push({ id: o._id, label: o.userId?.fullName || o.fullName || "Khách vãng lai", amount: o.total - (o.shipping?.fee || 0), time: o.createdAt, type: 'order' });
        });
        recentBookings.forEach((b: any) => {
            recentRevenueSources.push({ id: b._id, label: b.userId?.fullName || "Khách dịch vụ", amount: b.total, time: b.updatedAt, type: 'booking' });
        });
        recentBoardings.forEach((bb: any) => {
            recentRevenueSources.push({ id: bb._id, label: bb.userId?.fullName || "Khách lưu trú", amount: bb.total, time: bb.updatedAt, type: 'boarding' });
        });
        recentRevenueSources.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        const finalRecentSources = recentRevenueSources.slice(0, 8);

        // 6. Top Customers Calculation
        const topCustomersRaw = await Order.aggregate([
            { $match: baseMatch },
            { $group: { _id: "$userId", totalSpent: { $sum: "$total" }, totalOrders: { $sum: 1 } } },
            { $sort: { totalSpent: -1 } }, { $limit: 5 }
        ]);
        const topCustomers = await Promise.all(topCustomersRaw.map(async (c) => {
            const user = await AccountUser.findById(c._id).select('fullName avatar');
            return { ...c, fullName: user?.fullName || 'Khách vãng lai', avatar: user?.avatar };
        }));

        res.json({
            success: true,
            data: {
                summary: {
                    monthlyRevenue: currentRevenue,
                    shopRevenue: currShop[0]?.total || 0,
                    serviceRevenue: currService[0]?.total || 0,
                    boardingRevenue: currBoarding[0]?.total || 0,
                    revenueMonthPercent,
                    totalOrders: currShop[0]?.count || 0,
                    totalServiceBookings: currService[0]?.count || 0,
                    totalBoardingBookings: currBoarding[0]?.count || 0,
                    totalProducts,
                    totalUsers,
                    recentRevenueSources: finalRecentSources,
                    allTimeRevenue: {
                        total: grandTotal,
                        shop: shopTotal,
                        service: serviceTotal,
                        boarding: boardingTotal
                    }
                },
                recentOrders,
                recentProducts,
                topSellingProducts: topProducts,
                topCustomers,
                yearlyRevenueChart: {
                    shop: yearlyOrderChart,
                    service: yearlyServiceChart,
                    boarding: yearlyBoardingChart,
                    total: yearlyOrderChart.map((val, i) => val + yearlyServiceChart[i] + yearlyBoardingChart[i])
                },
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
            totalOrders,
            recentOrders,
            recentBookings,
            recentBoardings
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
            Order.countDocuments({ deleted: false }),
            Order.find({ deleted: false, orderStatus: "completed" }).sort({ createdAt: -1 }).limit(5).populate('userId', 'fullName avatar'),
            Booking.find({ bookingStatus: "completed", paymentStatus: "paid", deleted: false }).sort({ updatedAt: -1 }).limit(5).populate('userId', 'fullName avatar'),
            BoardingBooking.find({ boardingStatus: "completed", paymentStatus: "paid", deleted: false }).sort({ updatedAt: -1 }).limit(5).populate('userId', 'fullName avatar')
        ]);

        const recentRevenueSources: any[] = [];
        recentOrders.forEach((o: any) => {
            recentRevenueSources.push({
                id: o._id,
                label: o.userId?.fullName || o.fullName || "Khách hàng",
                amount: o.total - (o.shipping?.fee || 0),
                time: o.createdAt,
                type: 'order'
            });
        });
        recentBookings.forEach((b: any) => {
            recentRevenueSources.push({
                id: b._id,
                label: b.userId?.fullName || "Khách dịch vụ",
                amount: b.total,
                time: b.updatedAt,
                type: 'booking'
            });
        });
        recentBoardings.forEach((bb: any) => {
            recentRevenueSources.push({
                id: bb._id,
                label: bb.userId?.fullName || "Khách lưu trú",
                amount: bb.total,
                time: bb.updatedAt,
                type: 'boarding'
            });
        });
        recentRevenueSources.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        const finalRecentSources = recentRevenueSources.slice(0, 8);

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

        // Calculate All-time Totals
        const [allTimeShop, allTimeService, allTimeBoarding] = await Promise.all([
            Order.aggregate([
                { $match: { orderStatus: 'completed', deleted: false } },
                { $group: { _id: null, total: { $sum: { $subtract: ["$total", { $ifNull: ["$shipping.fee", 0] }] } } } }
            ]),
            Booking.aggregate([
                { $match: { bookingStatus: 'completed', paymentStatus: 'paid', deleted: false } },
                { $group: { _id: null, total: { $sum: "$total" } } }
            ]),
            BoardingBooking.aggregate([
                { $match: { boardingStatus: 'checked-out', paymentStatus: 'paid', deleted: false } },
                { $group: { _id: null, total: { $sum: "$total" } } }
            ])
        ]);

        const shopTotal = allTimeShop[0]?.total || 0;
        const serviceTotal = allTimeService[0]?.total || 0;
        const boardingTotal = allTimeBoarding[0]?.total || 0;
        const grandTotal = shopTotal + serviceTotal + boardingTotal;

        const calculatePercent = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return parseFloat(((current - previous) / previous * 100).toFixed(1));
        };

        const statusMap: any = {
            'pending': 'Chờ xác nhận',
            'confirmed': 'Đã xác nhận',
            'shipping': 'Đang giao',
            'shipped': 'Đã giao',
            'completed': 'Hoàn thành',
            'cancelled': 'Đã hủy',
            'refunded': 'Hoàn tiền',
            'returned': 'Trả hàng',
            'request_cancel': 'Yêu cầu hủy'
        };

        res.json({
            success: true,
            data: {
                weeklySales: {
                    total: thisWeekSalesTotal,
                    percent: calculatePercent(thisWeekSalesTotal, lastWeekSalesTotal),
                    data: weeklyRevenueData,
                    recentRevenueSources: finalRecentSources,
                    allTime: {
                        total: grandTotal,
                        shop: shopTotal,
                        service: serviceTotal,
                        boarding: boardingTotal
                    }
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
        const now = dayjs();
        const startOfMonth = now.startOf('month').toDate();
        const sixMonthsAgo = now.subtract(5, 'month').startOf('month').toDate();

        const match: any = { deleted: false };
        if (startDate && endDate) { match.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) }; }

        const [
            popularServices, staffPerformance, revenueByCategory, counts,
            thisMonthRevenueRes, revenueTrendRes, recentBookings
        ] = await Promise.all([
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
            // Danh mục dịch vụ mang lại doanh thu cao nhất
            Booking.aggregate([
                { $match: { ...match, bookingStatus: "completed" } },
                { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "serviceInfo" } },
                { $unwind: "$serviceInfo" },
                { $lookup: { from: "categories-service", localField: "serviceInfo.categoryId", foreignField: "_id", as: "cat" } },
                { $unwind: "$cat" },
                { $group: { _id: "$cat.name", total: { $sum: "$total" }, count: { $sum: 1 } } }
            ]),
            // Counts
            Promise.all([
                Booking.countDocuments({ deleted: false }),
                Booking.countDocuments({ bookingStatus: "pending", deleted: false }),
                Booking.countDocuments({ bookingStatus: "confirmed", deleted: false })
            ]),
            // This month revenue
            Booking.aggregate([
                { $match: { bookingStatus: "completed", paymentStatus: "paid", deleted: false, updatedAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: "$total" } } }
            ]),
            // Revenue Trend (6 months)
            Booking.aggregate([
                { $match: { bookingStatus: "completed", paymentStatus: "paid", deleted: false, updatedAt: { $gte: sixMonthsAgo } } },
                { $group: { _id: { month: { $month: "$updatedAt" }, year: { $year: "$updatedAt" } }, total: { $sum: "$total" } } },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),
            // Recent bookings for hover history
            Booking.find({ bookingStatus: "completed", paymentStatus: "paid", deleted: false })
                .sort({ updatedAt: -1 }).limit(8).populate('userId', 'fullName')
        ]);

        const recentRevenueSources = recentBookings.map((b: any) => ({
            id: b._id,
            label: b.userId?.fullName || "Khách dịch vụ",
            amount: b.total,
            time: b.updatedAt,
            type: 'booking'
        }));

        const revenueTrend = Array.from({ length: 6 }).map((_, i) => {
            const date = now.subtract(5 - i, 'month');
            const m = date.month() + 1;
            const y = date.year();
            const matchTrend = revenueTrendRes.find(r => r._id.month === m && r._id.year === y);
            return {
                month: `Thg ${m}`,
                total: matchTrend ? matchTrend.total : 0
            };
        });

        res.json({
            success: true,
            data: {
                popularServices,
                staffPerformance,
                revenueByCategory,
                totalBookings: counts[0],
                pendingBookings: counts[1],
                confirmedBookings: counts[2],
                thisMonthRevenue: thisMonthRevenueRes[0]?.total || 0,
                revenueTrend,
                recentRevenueSources
            }
        });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const getOrderStats = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const now = dayjs();
        const startOfMonth = now.startOf('month').toDate();
        const sixMonthsAgo = now.subtract(5, 'month').startOf('month').toDate();

        const match: any = { deleted: false, orderStatus: 'completed' };
        if (startDate && endDate) { match.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) }; }

        const [
            revenueByCategory, topProducts, orderDistribution, counts,
            thisMonthRevenueRes, revenueTrendRes, recentOrders
        ] = await Promise.all([
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
            Order.aggregate([{ $match: { deleted: false } }, { $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
            // Counts
            Promise.all([
                Order.countDocuments({ deleted: false }),
                Order.countDocuments({ orderStatus: "pending", deleted: false }),
                Order.countDocuments({ orderStatus: "confirmed", deleted: false })
            ]),
            // This month revenue
            Order.aggregate([
                { $match: { orderStatus: "completed", deleted: false, updatedAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: { $subtract: ["$total", { $ifNull: ["$shipping.fee", 0] }] } } } }
            ]),
            // Revenue Trend (6 months)
            Order.aggregate([
                { $match: { orderStatus: "completed", deleted: false, updatedAt: { $gte: sixMonthsAgo } } },
                { $group: { _id: { month: { $month: "$updatedAt" }, year: { $year: "$updatedAt" } }, total: { $sum: { $subtract: ["$total", { $ifNull: ["$shipping.fee", 0] }] } } } },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),
            // Recent orders for hover history
            Order.find({ orderStatus: "completed", deleted: false, updatedAt: { $gte: startOfMonth } })
                .sort({ updatedAt: -1 }).limit(8).populate('userId', 'fullName')
        ]);

        const recentRevenueSources = recentOrders.map((o: any) => ({
            id: o._id,
            label: o.userId?.fullName || o.fullName || "Khách vãng lai",
            amount: o.total - (o.shipping?.fee || 0),
            time: o.createdAt,
            type: 'order'
        }));

        const statusMap: any = {
            'pending': 'Chờ xác nhận',
            'confirmed': 'Đã xác nhận',
            'shipping': 'Đang giao',
            'shipped': 'Đã giao',
            'completed': 'Hoàn thành',
            'cancelled': 'Đã hủy',
            'returned': 'Trả hàng',
            'request_cancel': 'Yêu cầu hủy'
        };

        const revenueTrend = Array.from({ length: 6 }).map((_, i) => {
            const date = now.subtract(5 - i, 'month');
            const m = date.month() + 1;
            const y = date.year();
            const matchTrend = revenueTrendRes.find(r => r._id.month === m && r._id.year === y);
            return {
                month: `Thg ${m}`,
                total: matchTrend ? matchTrend.total : 0
            };
        });

        res.json({
            success: true,
            data: {
                revenueByCategory,
                topProducts,
                orderDistribution: orderDistribution.map((o: any) => ({ label: statusMap[o._id] || o._id, count: o.count })),
                totalOrders: counts[0],
                pendingOrders: counts[1],
                confirmedOrders: counts[2],
                thisMonthRevenue: thisMonthRevenueRes[0]?.total || 0,
                revenueTrend,
                recentRevenueSources
            }
        });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const getDetailedBoardingStats = async (req: Request, res: Response) => {
    try {
        const now = dayjs();
        const startOfMonth = now.startOf('month').toDate();
        const sixMonthsAgo = now.subtract(5, 'month').startOf('month').toDate();

        const [
            occupancyRes,
            revenueByCageType,
            stayDuration,
            counts,
            thisMonthRevenueRes,
            statusDist,
            revenueTrendRes
        ] = await Promise.all([
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
            ]),
            // General Counts
            Promise.all([
                BoardingBooking.countDocuments({ deleted: false }),
                BoardingBooking.countDocuments({ boardingStatus: "checked-in", deleted: false }),
                BoardingBooking.countDocuments({ boardingStatus: "confirmed", deleted: false })
            ]),
            // This month revenue
            BoardingBooking.aggregate([
                { $match: { boardingStatus: "checked-out", paymentStatus: "paid", deleted: false, updatedAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: "$total" } } }
            ]),
            // Status Distribution
            BoardingBooking.aggregate([
                { $match: { deleted: false } },
                { $group: { _id: "$boardingStatus", count: { $sum: 1 } } }
            ]),
            // Revenue Trend (6 months)
            BoardingBooking.aggregate([
                { $match: { boardingStatus: "checked-out", paymentStatus: "paid", deleted: false, updatedAt: { $gte: sixMonthsAgo } } },
                {
                    $group: {
                        _id: {
                            month: { $month: "$updatedAt" },
                            year: { $year: "$updatedAt" }
                        },
                        total: { $sum: "$total" }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ])
        ]);

        const revenueTrend = Array.from({ length: 6 }).map((_, i) => {
            const date = now.subtract(5 - i, 'month');
            const m = date.month() + 1;
            const y = date.year();
            const match = revenueTrendRes.find(r => r._id.month === m && r._id.year === y);
            return {
                month: `Thg ${m}`,
                total: match ? match.total : 0
            };
        });

        res.json({
            success: true,
            data: {
                occupancyRes,
                revenueByCageType,
                avgStayDuration: stayDuration[0]?.avgDays || 0,
                totalOrders: counts[0],
                checkedInOrders: counts[1],
                upcomingOrders: counts[2],
                thisMonthRevenue: thisMonthRevenueRes[0]?.total || 0,
                statusDist,
                revenueTrend
            }
        });
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
