import axios from "axios";
import hmacSHA256 from "crypto-js/hmac-sha256";
import moment from "moment";
import { getApiPayment } from "../../configs/setting.config";
import { Request, Response } from "express";
import mongoose from "mongoose";
import BoardingBooking from "../../models/boarding-booking.model";
import BoardingCage from "../../models/boarding-cage.model";
import Pet from "../../models/pet.model";

const DEFAULT_HOLD_MINUTES = Number(process.env.BOARDING_HOLD_MINUTES || 15);

const releaseExpiredHolds = async () => {
    const now = new Date();
    await BoardingBooking.updateMany(
        {
            deleted: false,
            boardingStatus: "held",
            holdExpiresAt: { $lte: now }
        },
        {
            $set: {
                boardingStatus: "cancelled",
                cancelledAt: now,
                cancelledReason: "Het thoi gian giu phong",
                cancelledBy: "system"
            }
        }
    );
};

const sortObject = (obj: Record<string, any>) => {
    const sorted: Record<string, any> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
        sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
    }
    return sorted;
};

const pickFirstQueryValue = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
        const first = value[0];
        return typeof first === "string" ? first : undefined;
    }
    return undefined;
};

export const createBoardingBooking = async (req: Request, res: Response) => {
    try {
        const user = res.locals.accountUser;
        const userId = user?._id?.toString();
        if (!userId) {
            return res.status(401).json({ message: "Vui long dang nhap" });
        }

        const {
            cageId,
            checkInDate,
            checkOutDate,
            petIds = [],
            fullName,
            phone,
            email,
            notes,
            specialCare,
            discountAmount = 0,
            appliedCoupon,
            paymentMethod = "pay_at_site",
            paymentGateway
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(cageId)) {
            return res.status(400).json({ message: "Invalid cageId" });
        }
        if (!checkInDate || !checkOutDate) {
            return res.status(400).json({ message: "Missing check-in or check-out date" });
        }
        if (!petIds || petIds.length === 0) {
            return res.status(400).json({ message: "Vui long chon thu cung" });
        }
        if (petIds.length !== 1) {
            return res.status(400).json({ message: "Moi lich khach san chi ho tro 1 thu cung" });
        }

        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({ message: "Invalid date format" });
        }

        const cage = await BoardingCage.findOne({ _id: cageId, deleted: false });
        if (!cage) {
            return res.status(404).json({ message: "Cage not found" });
        }
        if (cage.status === "maintenance") {
            return res.status(400).json({ message: "Cage is under maintenance" });
        }

        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (totalDays <= 0) {
            return res.status(400).json({ message: "Invalid date range" });
        }

        const pets = await Pet.find({ _id: { $in: petIds }, userId, deleted: false });
        if (pets.length !== petIds.length) {
            return res.status(400).json({ message: "Một hoặc nhiều thú cưng không hợp lệ" });
        }
        if (cage.maxWeightCapacity) {
            const hasOverWeight = pets.some((pet) => (pet.weight || 0) > cage.maxWeightCapacity!);
            if (hasOverWeight) {
                return res.status(400).json({ message: "Thú cưng vượt quá trọng lượng cho phép" });
            }
        }

        await releaseExpiredHolds();
        const now = new Date();

        const petOverlap = await BoardingBooking.findOne({
            deleted: false,
            petIds: { $in: petIds },
            $or: [
                { boardingStatus: { $in: ["confirmed", "checked-in"] } },
                { boardingStatus: "held", holdExpiresAt: { $gt: now } }
            ],
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        }).lean();
        if (petOverlap) {
            const conflictPet = pets.find((pet: any) =>
                (petOverlap.petIds || []).some((id: any) => String(id) === String(pet._id))
            );
            const petName = conflictPet?.name || "Thú cưng đã chọn";
            return res.status(400).json({
                message: `${petName} đã đặt chuồng trong khoảng ngày này. Vui lòng chọn ngày khác hoặc xóa lịch đặt hiện tại.`
            });
        }

        const overlap = await BoardingBooking.findOne({
            cageId,
            deleted: false,
            $or: [
                { boardingStatus: { $in: ["pending", "confirmed", "checked-in"] } },
                { boardingStatus: "held", holdExpiresAt: { $gt: now } }
            ],
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        });
        if (overlap) {
            return res.status(400).json({ message: "Cage is not available for selected dates" });
        }

        const pricePerDay = cage.dailyPrice || 0;
        const basePrice = pricePerDay * totalDays;
        const totalPrice = Math.max(basePrice - discountAmount, 0);
        const bookingCode = `BRD${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;

        const isPrepaid = paymentMethod === "prepaid";
        const holdExpiresAt = isPrepaid ? new Date(Date.now() + DEFAULT_HOLD_MINUTES * 60 * 1000) : undefined;

        const booking = await BoardingBooking.create({
            code: bookingCode,
            userId,
            petIds,
            cageId,
            fullName,
            phone,
            email,
            checkInDate: start,
            checkOutDate: end,
            numberOfDays: totalDays,
            pricePerDay,
            subTotal: basePrice,
            discount: discountAmount,
            coupon: appliedCoupon,
            total: totalPrice,
            paymentMethod,
            paymentGateway,
            holdExpiresAt,
            notes,
            specialCare,
            boardingStatus: isPrepaid ? "held" : "confirmed"
        });

        return res.status(201).json({
            message: isPrepaid
                ? `Dat lich tam giu thanh cong trong ${DEFAULT_HOLD_MINUTES} phut`
                : "Boarding booking created successfully",
            data: booking
        });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
};

export const initiateBoardingPayment = async (req: Request, res: Response) => {
    try {
        await releaseExpiredHolds();
        const userId = res.locals.accountUser?._id?.toString();
        const { id } = req.params;
        const { gateway } = req.body as { gateway: "zalopay" | "vnpay" };

        if (!userId) return res.status(401).json({ message: "Vui long dang nhap" });
        if (!gateway || !["zalopay", "vnpay"].includes(gateway)) {
            return res.status(400).json({ message: "Gateway khong hop le" });
        }

        const booking = await BoardingBooking.findById(id);
        if (!booking || booking.deleted || String(booking.userId) !== userId) {
            return res.status(404).json({ message: "Booking not found" });
        }
        if (booking.paymentStatus === "paid") {
            return res.status(400).json({ message: "Booking da thanh toan" });
        }
        if (booking.boardingStatus !== "held") {
            return res.status(400).json({ message: "Booking khong o trang thai giu phong" });
        }
        if (booking.holdExpiresAt && booking.holdExpiresAt <= new Date()) {
            booking.boardingStatus = "cancelled";
            booking.cancelledAt = new Date();
            booking.cancelledBy = "system";
            booking.cancelledReason = "Het thoi gian giu phong";
            await booking.save();
            return res.status(400).json({ message: "Het thoi gian giu phong" });
        }

        booking.paymentGateway = gateway;
        await booking.save();

        const paymentSettings = await getApiPayment();

        if (gateway === "zalopay") {
            const config = {
                app_id: `${paymentSettings.zaloAppId}`,
                key1: `${paymentSettings.zaloKey1}`,
                endpoint: `${paymentSettings.zaloDomain}/v2/create`
            };

            const domainWebsite = String(process.env.DOMAIN_WEBSITE || "").replace(/\/+$/, "");
            const frontendSuccessUrl = domainWebsite
                ? `${domainWebsite}/hotels/success?bookingId=${booking._id}`
                : `${process.env.BACKEND_URL}/api/v1/client/boarding/payment-zalopay-return?bookingId=${booking._id}`;

            const embed_data = {
                redirecturl: frontendSuccessUrl
            };
            const items = [{}];
            const transID = Math.floor(Math.random() * 1000000);
            const order = {
                app_id: config.app_id,
                app_trans_id: `${moment().format("YYMMDD")}_${transID}`,
                app_user: `${booking._id}`,
                app_time: Date.now(),
                item: JSON.stringify(items),
                embed_data: JSON.stringify(embed_data),
                amount: booking.total || 0,
                description: `Thanh toan boarding ${booking.code}`,
                bank_code: "",
                mac: "",
                callback_url: `${process.env.BACKEND_URL}/api/v1/client/boarding/payment-zalopay-result`
            };

            const data =
                config.app_id +
                "|" +
                order.app_trans_id +
                "|" +
                order.app_user +
                "|" +
                order.amount +
                "|" +
                order.app_time +
                "|" +
                order.embed_data +
                "|" +
                order.item;
            order.mac = hmacSHA256(data, config.key1).toString();

            const response = await axios.post(config.endpoint, null, { params: order });
            return res.json({ code: "success", paymentUrl: response.data.order_url });
        }

        const date = new Date();
        const createDate = moment(date).format("YYYYMMDDHHmmss");
        const ipAddr =
            (req.headers["x-forwarded-for"] as string) ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            "127.0.0.1";
        const tmnCode = `${paymentSettings.vnpTmnCode}`;
        const secretKey = `${paymentSettings.vnpHashSecret}`;
        let vnpUrl = `${paymentSettings.vnpUrl}`;
        const returnUrl = `${process.env.BACKEND_URL}/api/v1/client/boarding/payment-vnpay-result`;
        const orderId = `${booking._id}_${Date.now()}`;
        const amount = booking.total || 0;

        let vnpParams: any = {
            vnp_Version: "2.1.0",
            vnp_Command: "pay",
            vnp_TmnCode: tmnCode,
            vnp_Locale: "vn",
            vnp_CurrCode: "VND",
            vnp_TxnRef: orderId,
            vnp_OrderInfo: `Thanh toan boarding ${booking.code}`,
            vnp_OrderType: "other",
            vnp_Amount: amount * 100,
            vnp_ReturnUrl: returnUrl,
            vnp_IpAddr: ipAddr,
            vnp_CreateDate: createDate
        };

        vnpParams = sortObject(vnpParams);
        const querystring = require("qs");
        const signData = querystring.stringify(vnpParams, { encode: false });
        const crypto = require("crypto");
        const hmac = crypto.createHmac("sha512", secretKey);
        const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
        vnpParams.vnp_SecureHash = signed;
        vnpUrl += "?" + querystring.stringify(vnpParams, { encode: false });

        return res.json({ code: "success", paymentUrl: vnpUrl });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
};

export const paymentBoardingZalopayResult = async (req: Request, res: Response) => {
    const paymentSettings = await getApiPayment();
    const config = { key2: `${paymentSettings.zaloKey2}` };
    const result: any = {};
    try {
        const dataStr = req.body?.data;
        const reqMac = req.body?.mac;
        if (!dataStr || !reqMac) {
            result.return_code = 0;
            result.return_message = "missing callback payload";
            return res.json(result);
        }
        const mac = hmacSHA256(dataStr, config.key2).toString();

        if (reqMac !== mac) {
            result.return_code = -1;
            result.return_message = "mac not equal";
        } else {
            const dataJson = JSON.parse(dataStr);
            const bookingId = dataJson.app_user;
            const isPaymentSuccess =
                Number(dataJson?.zp_trans_id || 0) > 0 ||
                String(dataJson?.status || dataJson?.return_code || "").toLowerCase() === "1" ||
                String(dataJson?.status || dataJson?.return_code || "").toLowerCase() === "success";

            if (isPaymentSuccess) {
                await BoardingBooking.findOneAndUpdate(
                    { _id: bookingId, deleted: false, paymentStatus: { $ne: "paid" } },
                    {
                        paymentStatus: "paid",
                        boardingStatus: "confirmed",
                        holdExpiresAt: null
                    }
                );
            }
            result.return_code = 1;
            result.return_message = "success";
        }
    } catch (ex: any) {
        result.return_code = 0;
        result.return_message = ex.message;
    }
    return res.json(result);
};

export const paymentBoardingZalopayReturn = async (req: Request, res: Response) => {
    try {
        const bookingId = pickFirstQueryValue(req.query.bookingId);
        const status = pickFirstQueryValue(req.query.status);
        const returnCode = pickFirstQueryValue(req.query.returncode);
        const resultCode = pickFirstQueryValue(req.query.resultcode);
        const isPaymentSuccess =
            status === "1" ||
            returnCode === "1" ||
            resultCode === "1" ||
            String(status || "").toLowerCase() === "success" ||
            String(returnCode || "").toLowerCase() === "success" ||
            String(resultCode || "").toLowerCase() === "success";

        if (bookingId && mongoose.Types.ObjectId.isValid(bookingId) && isPaymentSuccess) {
            await BoardingBooking.findOneAndUpdate(
                { _id: bookingId, deleted: false, paymentStatus: { $ne: "paid" } },
                {
                    paymentStatus: "paid",
                    boardingStatus: "confirmed",
                    holdExpiresAt: null
                }
            );
            return res.redirect(`${process.env.DOMAIN_WEBSITE}/hotels/success?bookingId=${bookingId}&payment=success`);
        }

        const safeBookingId = bookingId && mongoose.Types.ObjectId.isValid(bookingId) ? bookingId : "";
        return res.redirect(`${process.env.DOMAIN_WEBSITE}/hotels/success?bookingId=${safeBookingId}&payment=failed`);
    } catch (error: any) {
        return res.redirect(`${process.env.DOMAIN_WEBSITE}/hotels/success?payment=failed`);
    }
};

export const paymentBoardingVNPayResult = async (req: Request, res: Response) => {
    let vnpParams = req.query as Record<string, any>;
    const secureHash = pickFirstQueryValue(vnpParams.vnp_SecureHash);
    delete vnpParams.vnp_SecureHash;
    delete vnpParams.vnp_SecureHashType;
    vnpParams = sortObject(vnpParams);

    const querystring = require("qs");
    const signData = querystring.stringify(vnpParams, { encode: false });
    const crypto = require("crypto");
    const paymentSettings = await getApiPayment();
    const hmac = crypto.createHmac("sha512", `${paymentSettings.vnpHashSecret}`);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    if (secureHash === signed) {
        const txnRef = String(pickFirstQueryValue(vnpParams.vnp_TxnRef) || "");
        const responseCode = String(pickFirstQueryValue(vnpParams.vnp_ResponseCode) || "");
        const transactionStatus = String(pickFirstQueryValue(vnpParams.vnp_TransactionStatus) || "");
        const bookingId = txnRef.split("_")[0];
        const isPaymentSuccess = responseCode === "00" && (!transactionStatus || transactionStatus === "00");

        if (isPaymentSuccess) {
            await BoardingBooking.findOneAndUpdate(
                { _id: bookingId, deleted: false, paymentStatus: { $ne: "paid" } },
                {
                    paymentStatus: "paid",
                    boardingStatus: "confirmed",
                    holdExpiresAt: null
                }
            );
            return res.redirect(`${process.env.DOMAIN_WEBSITE}/hotels/success?bookingId=${bookingId}&payment=success`);
        }

        return res.redirect(`${process.env.DOMAIN_WEBSITE}/hotels/success?bookingId=${bookingId}&payment=failed`);
    }
    return res.status(400).json({ message: "Invalid signature" });
};

export const checkInBoarding = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const booking = await BoardingBooking.findById(id).session(session);
        if (!booking) return res.status(404).json({ message: "Booking not found" });
        if (booking.boardingStatus !== "confirmed") {
            return res.status(400).json({ message: "Booking is not ready for check-in" });
        }

        booking.boardingStatus = "checked-in";
        booking.actualCheckInDate = new Date();
        await booking.save({ session });
        await BoardingCage.findByIdAndUpdate(booking.cageId, { status: "occupied" }, { session });
        await session.commitTransaction();
        session.endSession();
        return res.json({ message: "Check-in successful", data: booking });
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ message: error.message });
    }
};

export const checkOutBoarding = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const booking = await BoardingBooking.findById(id).session(session);
        if (!booking) return res.status(404).json({ message: "Booking not found" });
        if (booking.boardingStatus !== "checked-in") {
            return res.status(400).json({ message: "Booking is not checked-in" });
        }

        booking.boardingStatus = "checked-out";
        booking.actualCheckOutDate = new Date();
        await booking.save({ session });
        await BoardingCage.findByIdAndUpdate(booking.cageId, { status: "available" }, { session });
        await session.commitTransaction();
        session.endSession();
        return res.json({ message: "Check-out successful", data: booking });
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ message: error.message });
    }
};

export const cancelBoardingBooking = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
        const userId = res.locals.accountUser?._id?.toString();
        if (!userId) return res.status(401).json({ message: "Vui long dang nhap" });

        const booking = await BoardingBooking.findById(id);
        if (!booking) return res.status(404).json({ message: "Booking not found" });
        if (!booking.userId || booking.userId.toString() !== userId) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (booking.boardingStatus === "checked-in" || booking.boardingStatus === "checked-out") {
            return res.status(400).json({ message: "Cannot cancel after check-in" });
        }

        booking.boardingStatus = "cancelled";
        booking.cancelledAt = new Date();
        booking.cancelledReason = reason || "Khach hang huy";
        booking.cancelledBy = "customer";
        await booking.save();
        return res.json({ message: "Booking cancelled successfully" });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
};

export const listMyBoardingBookings = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser?._id?.toString();
        if (!userId) return res.status(401).json({ message: "Vui long dang nhap" });
        await releaseExpiredHolds();
        const bookings = await BoardingBooking.find({ userId, deleted: false }).sort({ createdAt: -1 });
        return res.json(bookings);
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
};

export const getMyBoardingBookingDetail = async (req: Request, res: Response) => {
    try {
        await releaseExpiredHolds();
        const userId = res.locals.accountUser?._id?.toString();
        const rawId = req.params.id;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;
        if (!userId) return res.status(401).json({ message: "Vui long dang nhap" });
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        const booking: any = await BoardingBooking.findOne({
            _id: id,
            userId,
            deleted: false
        })
            .populate("feedingSchedule.staffId", "fullName employeeCode")
            .populate("exerciseSchedule.staffId", "fullName employeeCode")
            .lean();

        if (!booking) return res.status(404).json({ message: "Booking not found" });

        const pets = await Pet.find({
            _id: { $in: booking.petIds || [] },
            deleted: false
        }).lean();

        const cage = booking.cageId
            ? await BoardingCage.findOne({ _id: booking.cageId, deleted: false }).lean()
            : null;

        const timeline = [
            { key: "created", label: "Tao lich", at: booking.createdAt || null },
            { key: "hold", label: "Giu phong den", at: booking.holdExpiresAt || null },
            { key: "cancelled", label: "Huy lich", at: booking.cancelledAt || null },
            { key: "checkin", label: "Nhan phong", at: booking.actualCheckInDate || null },
            { key: "checkout", label: "Tra phong", at: booking.actualCheckOutDate || null }
        ];

        return res.json({
            booking,
            pets,
            cage,
            timeline
        });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
};
