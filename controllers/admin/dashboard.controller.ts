import { Request, Response } from 'express';
import Product from '../../models/product.model';
import Order from '../../models/order.model';
import Booking from '../../models/booking.model';
import BoardingBooking from '../../models/boarding-booking.model';
import AccountUser from '../../models/account-user.model';
import AccountAdmin from "../../models/account-admin.model";
import Pet from "../../models/pet.model";
import BookingConfig from "../../models/booking-config.model";
import WorkSchedule from "../../models/work-schedule.model";
import dayjs from 'dayjs';

export const getEcommerceStats = async (req: Request, res: Response) => {
    try {
        const TIMEZONE_OFFSET = 7 * 60 * 60 * 1000;
        const now = new Date();

        // Time ranges (Vietnam Timezone)
        const startToday = new Date(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime() - TIMEZONE_OFFSET);
        const endToday = new Date(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime() - TIMEZONE_OFFSET);
        const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);
        const endYesterday = new Date(endToday.getTime() - 24 * 60 * 60 * 1000);

        const startThisMonth = new Date(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime() - TIMEZONE_OFFSET);
        const endThisMonth = new Date(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime() - TIMEZONE_OFFSET);
        const startLastMonth = new Date(new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).getTime() - TIMEZONE_OFFSET);
        const endLastMonth = new Date(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime() - TIMEZONE_OFFSET);

        const baseMatch = { paymentStatus: "paid", orderStatus: "completed", deleted: false };

        const [
            todayRevenueRes, yesterdayRevenueRes,
            thisMonthRevenueRes, lastMonthRevenueRes,
            todayOrders, yesterdayOrders,
            thisMonthOrders, lastMonthOrders,
            totalProducts, totalOrders, totalUsers,
            totalServiceBookings, totalBoardingBookings,
            totalPendingReviews,
            recentOrders, recentProducts, topProducts,
            topCustomersRes, revenueByMonthRes, topCategoriesRes
        ] = await Promise.all([
            Order.aggregate([{ $match: { ...baseMatch, createdAt: { $gte: startToday, $lte: endToday } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
            Order.aggregate([{ $match: { ...baseMatch, createdAt: { $gte: startYesterday, $lte: endYesterday } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
            Order.aggregate([{ $match: { ...baseMatch, createdAt: { $gte: startThisMonth, $lte: endThisMonth } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
            Order.aggregate([{ $match: { ...baseMatch, createdAt: { $gte: startLastMonth, $lte: endLastMonth } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
            Order.countDocuments({ deleted: false, createdAt: { $gte: startToday, $lte: endToday } }),
            Order.countDocuments({ deleted: false, createdAt: { $gte: startYesterday, $lte: endYesterday } }),
            Order.countDocuments({ deleted: false, createdAt: { $gte: startThisMonth, $lte: endThisMonth } }),
            Order.countDocuments({ deleted: false, createdAt: { $gte: startLastMonth, $lte: endLastMonth } }),
            Product.countDocuments({ deleted: false }),
            Order.countDocuments({ deleted: false }),
            AccountUser.countDocuments({ deleted: false }),
            Booking.countDocuments({ deleted: false }),
            BoardingBooking.countDocuments({ deleted: false }),
            (async () => {
                try {
                    const Review = (await import("../../models/review.model")).default;
                    return await Review.countDocuments({ status: "pending", deleted: false });
                } catch (e) {
                    return 0;
                }
            })(),
            Order.find({ deleted: false }).sort({ createdAt: -1 }).limit(5).populate('userId', 'fullName avatar'),
            Product.find({ deleted: false }).sort({ createdAt: -1 }).limit(5),
            Order.aggregate([
                { $match: baseMatch },
                { $unwind: "$items" },
                { $group: { _id: "$items.productId", name: { $first: "$items.name" }, totalQuantity: { $sum: "$items.quantity" }, totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } } } },
                { $sort: { totalQuantity: -1 } },
                { $limit: 10 }
            ]),
            Order.aggregate([
                { $match: baseMatch },
                { $group: { _id: "$userId", fullName: { $first: "$userId" }, totalSpent: { $sum: "$total" }, totalOrders: { $sum: 1 } } },
                { $sort: { totalSpent: -1 } },
                { $limit: 5 }
            ]),
            Order.aggregate([
                {
                    $match: {
                        ...baseMatch,
                        createdAt: {
                            $gte: new Date(now.getFullYear(), 0, 1),
                            $lte: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
                        }
                    }
                },
                {
                    $group: {
                        _id: { month: { $month: "$createdAt" } },
                        total: { $sum: "$total" }
                    }
                },
                { $sort: { "_id.month": 1 } }
            ]),
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
                { $unwind: "$productInfo.category" },
                {
                    $lookup: {
                        from: "categories-product",
                        localField: "productInfo.category",
                        foreignField: "_id",
                        as: "catInfo"
                    }
                },
                { $unwind: "$catInfo" },
                {
                    $group: {
                        _id: "$catInfo.name",
                        total: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
                    }
                },
                { $sort: { total: -1 } },
                { $limit: 2 }
            ])
        ]);

        const chartData = Array(12).fill(0);
        revenueByMonthRes.forEach(item => {
            chartData[item._id.month - 1] = item.total;
        });

        const topCategories = topCategoriesRes.map(item => ({
            label: item._id,
            total: item.total
        }));

        const topCustomers = await Promise.all(topCustomersRes.map(async (c) => {
            const user = await AccountUser.findById(c._id).select('fullName avatar');
            return {
                ...c,
                fullName: user?.fullName || 'Khách vãng lai',
                avatar: user?.avatar
            };
        }));

        const todayRevenue = todayRevenueRes[0]?.total || 0;
        const yesterdayRevenue = yesterdayRevenueRes[0]?.total || 0;
        const thisMonthRevenue = thisMonthRevenueRes[0]?.total || 0;
        const lastMonthRevenue = lastMonthRevenueRes[0]?.total || 0;

        const revenueTodayPercent = yesterdayRevenue === 0 ? 100 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
        const revenueMonthPercent = lastMonthRevenue === 0 ? 100 : ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
        const orderTodayPercent = yesterdayOrders === 0 ? 100 : ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100;
        const orderMonthPercent = lastMonthOrders === 0 ? 100 : ((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100;

        res.json({
            success: true,
            data: {
                summary: {
                    totalProducts,
                    totalOrders,
                    totalUsers,
                    totalServiceBookings,
                    totalBoardingBookings,
                    totalPendingReviews,
                    monthlyRevenue: thisMonthRevenue,
                    revenueTodayPercent,
                    revenueMonthPercent,
                    orderTodayPercent,
                    orderMonthPercent,
                },
                recentOrders,
                recentProducts,
                topSellingProducts: topProducts,
                topCustomers,
                yearlyRevenueChart: chartData,
                topCategories
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAnalyticsStats = async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const startOfToday = dayjs().startOf('day').toDate();
        const sevenDaysAgo = dayjs().subtract(7, 'day').startOf('day').toDate();

        const [
            weeklyRevenueRes,
            totalUsers,
            totalOrders,
            ordersByStatus,
            monthlyVisitsRes
        ] = await Promise.all([
            Order.aggregate([
                { $match: { createdAt: { $gte: sevenDaysAgo }, deleted: false } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, total: { $sum: "$total" } } },
                { $sort: { "_id": 1 } }
            ]),
            AccountUser.countDocuments({ deleted: false }),
            Order.countDocuments({ deleted: false }),
            Order.aggregate([
                { $match: { deleted: false } },
                { $group: { _id: "$orderStatus", count: { $sum: 1 } } }
            ]),
            Order.aggregate([
                {
                    $match: {
                        deleted: false,
                        createdAt: { $gte: dayjs().startOf('year').toDate() }
                    }
                },
                { $group: { _id: { month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { "_id.month": 1 } }
            ])
        ]);

        const weeklyRevenueTable: Record<string, number> = {};
        weeklyRevenueRes.forEach(item => weeklyRevenueTable[item._id] = item.total);
        const weeklyRevenue = Array.from({ length: 7 }).map((_, i) => {
            const date = dayjs().subtract(6 - i, 'day').format('Y-M-D'); 
            const d = dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD');
            return weeklyRevenueTable[d] || 0;
        });

        const monthlyVisits = Array(12).fill(0);
        monthlyVisitsRes.forEach(item => {
            monthlyVisits[item._id.month - 1] = item.count;
        });

        res.json({
            success: true,
            data: {
                weeklySales: {
                    total: weeklyRevenue.reduce((a, b) => a + b, 0),
                    data: weeklyRevenue
                },
                newUsers: totalUsers,
                purchaseOrders: totalOrders,
                messages: 234, 
                orderDistribution: ordersByStatus.map(o => ({ label: o._id, value: o.count })),
                websiteVisits: monthlyVisits
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSystemStats = async (req: Request, res: Response) => {
    try {
        const [
            petStats,
            totalUsers,
            totalAdmins,
            totalPets,
            newProducts,
            topProducts,
            topCustomersRes,
            serviceUsageRes
        ] = await Promise.all([
            Pet.aggregate([
                { $match: { deleted: false } },
                { $group: { _id: "$type", count: { $sum: 1 } } }
            ]),
            AccountUser.countDocuments({ deleted: false }),
            AccountAdmin.countDocuments({ deleted: false }),
            Pet.countDocuments({ deleted: false }),
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
                {
                    $lookup: {
                        from: "services",
                        localField: "serviceId",
                        foreignField: "_id",
                        as: "serviceInfo"
                    }
                },
                { $unwind: "$serviceInfo" },
                { $group: { _id: "$serviceInfo.name", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 3 }
            ])
        ]);

        const topCustomers = await Promise.all(topCustomersRes.map(async (c) => {
            const user = await AccountUser.findById(c._id).select('fullName avatar');
            return { ...c, fullName: user?.fullName || 'Khách vãng lai', avatar: user?.avatar };
        }));

        res.json({
            success: true,
            data: {
                petDistribution: petStats.map(p => ({ label: p._id === 'dog' ? 'Chó' : p._id === 'cat' ? 'Mèo' : 'Khác', count: p.count })),
                systemStats: {
                    totalUsers,
                    totalAdmins,
                    totalPets
                },
                newProducts,
                topSellingProducts: topProducts,
                topCustomers,
                serviceUsage: serviceUsageRes.map(s => ({ name: s._id, count: s.count }))
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getStaffingStatus = async (req: Request, res: Response) => {
    try {
        const date = req.query.date ? new Date(req.query.date as string) : new Date();
        const startOfDay = dayjs(date).startOf('day').toDate();
        const endOfDay = dayjs(date).endOf('day').toDate();

        const [config, schedules] = await Promise.all([
            BookingConfig.findOne({}),
            WorkSchedule.find({
                date: { $gte: startOfDay, $lte: endOfDay },
                status: { $in: ["scheduled", "checked-in"] }
            }).populate({
                path: 'staffId',
                select: 'fullName roles',
                populate: { path: 'roles', select: 'name' }
            })
        ]);

        if (!config || !config.staffingRules || config.staffingRules.length === 0) {
            return res.json({
                code: 200,
                data: [],
                message: "Chưa cấu hình định mức nhân sự."
            });
        }

        const results = config.staffingRules.map((rule: any) => {
            const shiftSchedules = schedules.filter(s => s.shiftId.toString() === rule.shiftId.toString());
            
            const requirements = rule.roleRequirements.map((req: any) => {
                const actualStaffCount = shiftSchedules.filter(s => {
                    const staff = s.staffId as any;
                    return staff?.roles?.some((r: any) => r._id.toString() === req.roleId.toString());
                }).length;

                return {
                    roleId: req.roleId,
                    required: req.minStaff,
                    actual: actualStaffCount,
                    status: actualStaffCount >= req.minStaff ? "vừa đủ" : "thiếu",
                    diff: actualStaffCount - req.minStaff
                };
            });

            return {
                shiftId: rule.shiftId,
                requirements
            };
        });

        res.json({
            code: 200,
            data: results
        });
    } catch (error) {
        res.status(500).json({ code: 500, message: "Lỗi kiểm tra định mức nhân sự" });
    }
};
