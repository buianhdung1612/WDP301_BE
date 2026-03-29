import { Request, Response } from 'express';
import axios from 'axios';
import Order from '../../models/order.model';
import Booking from '../../models/booking.model';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import Coupon from '../../models/coupon.model';
import AccountUser from '../../models/account-user.model';
import { generateRandomNumber, generateRandomString } from '../../helpers/generate.helper';
import { getInfoAddress } from '../../helpers/location.helper';
import hmacSHA256 from 'crypto-js/hmac-sha256';
import moment from 'moment';
import puppeteer from 'puppeteer';
import { getApiPayment, getApiShipping, getPointConfig } from '../../configs/setting.config';
import { addPointAfterPayment } from '../../helpers/point.helper';
import { refundOrderResources } from '../../helpers/order.helper';

// [POST] /api/v1/client/order/create
export const createPost = async (req: Request, res: Response) => {
    const dataFinal: any = {};
    try {
        // Thêm userId (nếu đã đăng nhập)
        if (res.locals.accountUser) {
            dataFinal.userId = res.locals.accountUser.id;
        }

        // Thêm code
        let code = "";
        let existCode = true;
        while (existCode) {
            code = generateRandomString(2).toUpperCase() + generateRandomNumber(6);
            const existOrderCode = await Order.findOne({
                code: code
            });
            if (!existOrderCode) {
                existCode = false;
            };
        }
        dataFinal.code = code;

        dataFinal.fullName = req.body.fullName;
        dataFinal.phone = req.body.phone;
        dataFinal.address = req.body.address;
        dataFinal.longitude = req.body.longitude;
        dataFinal.latitude = req.body.latitude;
        dataFinal.note = req.body.note;
        dataFinal.coupon = req.body.coupon;

        // Map paymentMethod
        let paymentMethod = req.body.paymentMethod || "money";
        if (paymentMethod === "COD") paymentMethod = "money";
        if (paymentMethod === "ZALOPAY") paymentMethod = "zalopay";
        if (paymentMethod === "VNPAY") paymentMethod = "vnpay";

        dataFinal.paymentMethod = paymentMethod;
        dataFinal.paymentStatus = "unpaid";
        dataFinal.orderStatus = "pending";

        // Mảng items
        dataFinal.items = [];
        for (const item of req.body.items) {
            const productDetail: any = await Product.findOne({
                _id: item.productId,
                deleted: false,
                status: "active"
            });

            if (productDetail) {
                let price = 0;
                const variantArr = [];

                if (item.variant && item.variant.length > 0) {
                    const elemsMatch = item.variant.map((v: any) => ({
                        $elemMatch: { attrId: v.attrId, value: v.value }
                    }));

                    const variantUpdateResult = await Product.updateOne(
                        {
                            _id: item.productId,
                            deleted: false,
                            status: "active",
                            variants: {
                                $elemMatch: {
                                    attributeValue: { $all: elemsMatch, $size: item.variant.length },
                                    stock: { $gte: item.quantity }
                                }
                            }
                        },
                        { $inc: { "variants.$.stock": -item.quantity } }
                    );

                    if (variantUpdateResult.modifiedCount === 0) {
                        return res.json({
                            code: "error",
                            message: `Sản phẩm "${productDetail.name}" (biến thể) không đủ số lượng tồn kho!`
                        });
                    }

                    const variantMatchedIndex = (productDetail.variants || []).findIndex((variantItem: any) => {
                        return (
                            variantItem.attributeValue.length === item.variant.length &&
                            variantItem.attributeValue.every((attr: any) => {
                                const selected = item.variant.find((v: any) => v.attrId === attr.attrId);
                                return selected && selected.value === attr.value;
                            })
                        );
                    });
                    if (variantMatchedIndex !== -1) {
                        price = productDetail.variants[variantMatchedIndex].priceNew || 0;
                    }

                    for (const v of item.variant) {
                        const attribute: any = await AttributeProduct
                            .findOne({ _id: v.attrId })
                            .select("name")
                            .lean();
                        if (attribute) {
                            variantArr.push(`${attribute.name}: ${v.label}`);
                        }
                    }
                } else {
                    const stockUpdateResult = await Product.updateOne(
                        {
                            _id: item.productId,
                            deleted: false,
                            status: "active",
                            stock: { $gte: item.quantity }
                        },
                        { $inc: { stock: -item.quantity } }
                    );

                    if (stockUpdateResult.modifiedCount === 0) {
                        return res.json({
                            code: "error",
                            message: `Sản phẩm "${productDetail.name}" không đủ số lượng tồn kho!`
                        });
                    }
                    price = productDetail.priceNew || 0;
                }

                const itemFinal = {
                    productId: item.productId,
                    quantity: item.quantity,
                    price: price,
                    variant: variantArr.length > 0 ? variantArr : undefined,
                    image: productDetail.images?.[0] || "",
                    name: productDetail.name
                };
                dataFinal.items.push(itemFinal);
            }
        }

        dataFinal.subTotal = dataFinal.items.reduce((total: number, item: any) => total + (item.price * item.quantity), 0);

        dataFinal.discount = 0;
        const couponCodeRaw = req.body.coupon;
        if (couponCodeRaw && typeof couponCodeRaw === 'string' && couponCodeRaw.trim() !== "") {
            const couponCode = couponCodeRaw.trim().toUpperCase();
            const couponDetail: any = await Coupon.findOne({
                code: couponCode,
                deleted: false,
                status: "active"
            });
            if (couponDetail) {
                const now = new Date();
                if (couponDetail.startDate && now >= couponDetail.startDate && (!couponDetail.endDate || now <= couponDetail.endDate)) {
                    if (!couponDetail.usageLimit || couponDetail.usedCount < couponDetail.usageLimit) {
                        if (dataFinal.subTotal >= couponDetail.minOrderValue) {
                            if (couponDetail.typeDiscount === "percentage") {
                                dataFinal.discount = (dataFinal.subTotal * couponDetail.value) / 100;
                                if (couponDetail.maxDiscountValue > 0 && dataFinal.discount > couponDetail.maxDiscountValue) {
                                    dataFinal.discount = couponDetail.maxDiscountValue;
                                }
                            } else {
                                dataFinal.discount = couponDetail.value;
                            }
                            await Coupon.updateOne({ _id: couponDetail._id }, { usedCount: couponDetail.usedCount + 1 });
                        }
                    }
                }
            }
        }

        dataFinal.usedPoint = 0;
        dataFinal.pointDiscount = 0;

        const usedPointBody = parseInt(req.body.usedPoint);
        if (usedPointBody > 0 && res.locals.accountUser) {
            const user = res.locals.accountUser;
            const canUsePoint = (user.totalPoint || 0) - (user.usedPoint || 0);

            if (usedPointBody <= canUsePoint) {
                const pointConfig = await getPointConfig();
                dataFinal.usedPoint = usedPointBody;
                dataFinal.pointDiscount = usedPointBody * (pointConfig.POINT_TO_MONEY || 0);

                await AccountUser.updateOne({ _id: user.id }, { $inc: { usedPoint: usedPointBody } });
            }
        }

        const shopLocation = { lat: 10.8037448, lng: 106.6617749 };
        const shopInfoAddress = await getInfoAddress(shopLocation.lat, shopLocation.lng);
        const userInfoAddress = await getInfoAddress(dataFinal.latitude, dataFinal.longitude);
        const totalWeight = dataFinal.items.reduce((total: number, item: any) => total + item.quantity * 500, 0);

        const dataGoShip = {
            shipment: {
                rate: req.body.shippingMethod,
                payer: 0,
                address_from: {
                    name: "Fruit Shop",
                    phone: "0912345678",
                    street: "11 Sư Vạn Hạnh, Phường 12, Quận 10, Thành phố Hồ Chí Minh",
                    city: shopInfoAddress.city,
                    district: shopInfoAddress.district,
                    ward: shopInfoAddress.ward
                },
                address_to: {
                    name: dataFinal.fullName,
                    phone: dataFinal.phone,
                    street: dataFinal.address,
                    city: userInfoAddress.city,
                    district: userInfoAddress.district,
                    ward: userInfoAddress.ward
                },
                parcel: {
                    cod: `${dataFinal.subTotal - dataFinal.discount}`,
                    amount: `${dataFinal.subTotal - dataFinal.discount}`,
                    weight: `${totalWeight}`,
                    width: "10", height: "10", length: "10"
                }
            }
        };

        const shippingSettings = await getApiShipping();
        const goshipRes = await axios.post("https://sandbox.goship.io/api/v2/shipments", dataGoShip, {
            headers: { Authorization: `Bearer ${shippingSettings?.tokenGoShip || ""}`, "Content-Type": "application/json" }
        });

        dataFinal.shipping = {
            goshipOrderId: goshipRes.data.id,
            carrierName: goshipRes.data.carrier,
            carrierCode: goshipRes.data.carrier_short_name,
            fee: goshipRes.data.fee,
            cod: goshipRes.data.cod,
        };

        dataFinal.total = dataFinal.subTotal + dataFinal.shipping.fee - dataFinal.discount - dataFinal.pointDiscount;

        const newRecord = new Order(dataFinal);
        await newRecord.save();

        try {
            const Notification = (await import("../../models/notification.model")).default;
            await Notification.create({
                senderId: dataFinal.userId || null,
                type: "order",
                title: "Đơn hàng sản phẩm mới",
                content: `Đơn hàng mới ${dataFinal.code} từ ${dataFinal.fullName}`,
                metadata: { orderId: newRecord._id, orderCode: dataFinal.code },
                status: "unread"
            });
        } catch (e) {}

        res.json({ code: "success", message: "Đặt hàng thành công!", orderCode: dataFinal.code, phone: dataFinal.phone });
    } catch (error: any) {
        res.json({ code: "error", message: error.message });
    }
};

// [GET] /api/v1/client/order/success
export const success = async (req: Request, res: Response) => {
    try {
        const { orderCode, phone } = req.query;
        const orderDetail = await Order.findOne({ code: orderCode, phone, deleted: false }).lean();
        if (!orderDetail) return res.status(404).json({ code: "error", message: "Không tìm thấy đơn hàng!" });
        res.json({ code: "success", message: "Thành công!", order: orderDetail });
    } catch (error) {
        res.status(500).json({ code: "error", message: "Lỗi hệ thống!" });
    }
};

export const paymentZaloPay = async (req: Request, res: Response) => {
    const { orderCode, bookingCode, phone } = req.query;
    let target: any = null;
    let code: any = "";

    if (orderCode) {
        target = await Order.findOne({ code: orderCode, phone, deleted: false });
        code = orderCode;
    } else if (bookingCode) {
        target = await Booking.findOne({ code: bookingCode, customerPhone: phone, deleted: false });
        code = bookingCode;
    }

    if (!target) return res.json({ success: false, message: "Không tìm thấy đơn hàng!" });

    const paymentExpireAt = new Date(Date.now() + 16 * 60 * 1000);
    if (orderCode) await Order.updateOne({ _id: target._id }, { paymentExpireAt });
    else await Booking.updateOne({ _id: target._id }, { paymentExpireAt });

    const paymentSettings = await getApiPayment();
    const config = {
        app_id: `${paymentSettings.zaloAppId}`,
        key1: `${paymentSettings.zaloKey1}`,
        endpoint: `${paymentSettings.zaloDomain}/v2/create`
    };

    const successPath = orderCode ? `/order/success?orderCode=${orderCode}&phone=${phone}` : `/booking/success`;
    const embed_data = { redirecturl: `${process.env.DOMAIN_WEBSITE}${successPath}` };
    const items = [{}];
    const transID = Math.floor(Math.random() * 1000000);
    let amount = target.total;
    if (bookingCode && target.depositAmount > 0 && target.paymentStatus === "unpaid") amount = target.depositAmount;

    const order = {
        app_id: config.app_id,
        app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
        app_user: `${phone}-${code}`,
        app_time: Date.now(),
        item: JSON.stringify(items),
        embed_data: JSON.stringify(embed_data),
        amount: amount,
        description: `Thanh toán ${orderCode ? 'đơn hàng' : 'lịch đặt'} ${code}`,
        bank_code: "",
        mac: "",
        callback_url: `${process.env.BACKEND_URL}/api/v1/client/order/payment-zalopay-result`
    };

    const data = config.app_id + "|" + order.app_trans_id + "|" + order.app_user + "|" + order.amount + "|" + order.app_time + "|" + order.embed_data + "|" + order.item;
    order.mac = hmacSHA256(data, config.key1).toString();

    const response = await axios.post(config.endpoint, null, { params: order });
    res.redirect(response.data.order_url);
}

export const paymentZalopayResult = async (req: Request, res: Response) => {
    const paymentSettings = await getApiPayment();
    const config = { key2: `${paymentSettings.zaloKey2}` };
    let result: any = {};
    try {
        let dataStr = req.body.data;
        let reqMac = req.body.mac;
        let mac = hmacSHA256(dataStr, config.key2).toString();
        if (reqMac !== mac) {
            result.return_code = -1;
            result.return_message = "mac not equal";
        } else {
            let dataJson = JSON.parse(dataStr);
            const [phone, code] = dataJson.app_user.split("-");
            if (code.startsWith("BK")) {
                const booking = await Booking.findOne({ code, customerPhone: phone, deleted: false });
                if (booking) {
                    let updateData: any = { paymentStatus: booking.depositAmount > 0 && booking.paymentStatus === "unpaid" ? "partially_paid" : "paid", depositMethod: "zalopay", bookingStatus: "confirmed" };
                    await Booking.updateOne({ _id: booking._id }, updateData);
                }
            } else {
                await Order.updateOne({ phone, code, deleted: false }, { paymentStatus: "paid" });
                await addPointAfterPayment(code);
            }
            result.return_code = 1;
            result.return_message = "success";
        }
    } catch (ex: any) {
        result.return_code = 0;
        result.return_message = ex.message;
    }
    res.json(result);
}

export const paymentVNPay = async (req: Request, res: Response) => {
    const { orderCode, bookingCode, phone } = req.query;
    let target: any = null;
    let code: any = "";
    if (orderCode) {
        target = await Order.findOne({ code: orderCode, phone, deleted: false });
        code = orderCode;
    } else if (bookingCode) {
        target = await Booking.findOne({ code: bookingCode, customerPhone: phone, deleted: false });
        code = bookingCode;
    }
    if (!target) return res.json({ success: false, message: "Không tìm thấy đơn hàng!" });

    const date = new Date();
    const createDate = moment(date).format('YYYYMMDDHHmmss');
    const ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
    const paymentSettings = await getApiPayment();

    const backendUrl = process.env.BACKEND_URL?.replace(/\/+$/, "") || "http://localhost:3000";
    const returnUrl = `${backendUrl}/api/v1/client/order/payment-vnpay-result`;
    const orderId = `${code}_${Math.floor(Date.now() / 1000)}`;
    const amount = (bookingCode && target.depositAmount > 0 && target.paymentStatus === "unpaid") ? target.depositAmount : target.total;

    let vnp_Params: any = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: `${paymentSettings.vnpTmnCode}`,
        vnp_Locale: 'vn',
        vnp_CurrCode: 'VND',
        vnp_TxnRef: orderId,
        vnp_OrderInfo: 'Thanh toan cho ma GD:' + orderId,
        vnp_OrderType: 'other',
        vnp_Amount: amount * 100,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDate
    };

    vnp_Params = sortObject(vnp_Params);
    const querystring = require('qs');
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha512", `${paymentSettings.vnpHashSecret}`);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    vnp_Params['vnp_SecureHash'] = signed;
    const vnpUrl = `${paymentSettings.vnpUrl}?${querystring.stringify(vnp_Params, { encode: false })}`;
    res.redirect(vnpUrl);
}

export const paymentVNPayResult = async (req: Request, res: Response) => {
    try {
        const vnp_Params: any = { ...req.query };
        const secureHash = vnp_Params['vnp_SecureHash'];
        delete vnp_Params['vnp_SecureHash'];
        delete vnp_Params['vnp_SecureHashType'];

        const sortedParams = sortObject(vnp_Params);
        const paymentSettings = await getApiPayment();
        const secretKey = `${paymentSettings?.vnpHashSecret || ""}`;

        const querystring = require('qs');
        const signData = querystring.stringify(sortedParams, { encode: false });
        const crypto = require("crypto");
        const hmac = crypto.createHmac("sha512", secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

        if (secureHash === signed) {
            const txnRef = String(vnp_Params['vnp_TxnRef'] || "");
            const code = txnRef.split('_')[0];
            const order = await Order.findOne({ code, deleted: false });
            const phone = order?.phone || "";

            const responseCode = vnp_Params['vnp_ResponseCode'];
            const transactionStatus = vnp_Params['vnp_TransactionStatus'];
            const isSuccess = responseCode === '00' && (transactionStatus === '00' || transactionStatus === '01');

            if (isSuccess) {
                if (code.startsWith("BK")) {
                    const booking = await Booking.findOne({ code, customerPhone: phone, deleted: false });
                    if (booking) {
                        let updateData: any = { paymentStatus: (booking.depositAmount || 0) >= (booking.total || 0) ? "paid" : "partially_paid", depositMethod: "vnpay", bookingStatus: "confirmed" };
                        await Booking.updateOne({ _id: booking._id }, updateData);
                    }
                } else {
                    await Order.findOneAndUpdate({ code, deleted: false }, { paymentStatus: 'paid' });
                    await addPointAfterPayment(code);
                }
            } else {
                if (responseCode === '24') {
                    await Order.findOneAndUpdate({ code, deleted: false }, { orderStatus: 'cancelled', cancelledBy: 'customer', cancelledReason: 'Khách hàng hủy thanh toán VNPay' });
                    await refundOrderResources(code);
                }
            }

            const successPath = code.startsWith("BK") ? `/dashboard/bookings` : `/order/success?orderCode=${code}&phone=${phone}`;
            const failPath = code.startsWith("BK") ? `/dashboard/bookings` : `/order/success?orderCode=${code}&phone=${phone}&payment=failed&vnpCode=${responseCode}`;
            
            const domainWebsite = process.env.DOMAIN_WEBSITE || "http://localhost:5173";
            const redirectUrl = isSuccess ? `${domainWebsite}${successPath}` : `${domainWebsite}${failPath}`;

            let message = isSuccess ? "Thanh toán thành công!" : "Thanh toán không thành công!";
            let subMessage = isSuccess 
                ? `Cảm ơn bạn đã đặt hàng. Mã đơn hàng của bạn là <b>${code}</b>.` 
                : `Đã có lỗi xảy ra trong quá trình thanh toán (Mã lỗi: ${responseCode}). Vui lòng thử lại sau.`;
            let icon = isSuccess ? "✅" : "❌";
            let color = isSuccess ? "#27ae60" : "#e74c3c";

            res.send(`
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Kết quả thanh toán</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
                        .card { background: white; padding: 40px; border-radius: 24px; box-shadow: 0 15px 35px rgba(0,0,0,0.1); text-align: center; max-width: 450px; width: 100%; }
                        .icon { font-size: 80px; margin-bottom: 24px; }
                        h1 { color: #1a1a1a; font-size: 28px; margin: 0 0 16px 0; font-weight: 800; }
                        p { color: #555; line-height: 1.6; margin-bottom: 32px; font-size: 16px; }
                        .btn { display: inline-block; background-color: ${color}; color: white; padding: 14px 40px; border-radius: 50px; text-decoration: none; font-weight: 700; transition: all 0.3s; box-shadow: 0 4px 15px ${color}44; }
                        .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px ${color}66; }
                        .btn:active { transform: translateY(0); }
                        .footer { margin-top: 32px; font-size: 14px; color: #888; border-top: 1px solid #eee; padding-top: 24px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="icon">${icon}</div>
                        <h1>${message}</h1>
                        <p>${subMessage}</p>
                        <a href="${redirectUrl}" class="btn">Quay lại ứng dụng</a>
                        <div class="footer">Trang sẽ tự động chuyển hướng sau 5 giây...</div>
                    </div>
                    <script>
                        setTimeout(() => { window.location.href = "${redirectUrl}"; }, 5000);
                    </script>
                </body>
                </html>
            `);
        } else {
            res.status(400).send("Chữ ký không hợp lệ!");
        }
    } catch (error: any) {
        res.status(500).send(`<h1>Lỗi hệ thống</h1><p>${error.message}</p>`);
    }
}

export const exportPdf = async (req: Request, res: Response) => {
    try {
        const { orderCode, phone } = req.query;
        const orderDetail: any = await Order.findOne({ code: orderCode, phone, deleted: false });
        if (!orderDetail) return res.status(404).json({ message: "Order not found" });

        const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Hóa đơn ${orderDetail.code}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; font-size: 13px; color: #2c2c2c; padding: 20px; background: #f6f7fb; }
    .invoice { max-width: 820px; margin: auto; background: #fff; padding: 28px 30px; border-radius: 6px; box-shadow: 0 0 0 1px #e5e7eb; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; }
    .header h2 { margin: 0; font-size: 22px; }
    .header p { margin: 2px 0; font-size: 12.5px; color: #555; }
    hr { margin: 18px 0; border: none; border-top: 1px dashed #ddd; }
    .section { margin-top: 22px; }
    .section h3 { margin-bottom: 10px; font-size: 14px; text-transform: uppercase; color: #3a7bd5; border-bottom: 2px solid #3a7bd5; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #f3f6fb; padding: 9px 6px; border: 1px solid #e1e5ea; font-size: 12.5px; }
    td { border: 1px solid #e1e5ea; padding: 9px 6px; font-size: 12.5px; text-align: center; }
    td.name { text-align: left; font-weight: 500; }
    td.variant { text-align: left; font-size: 12px; color: #555; }
    .summary { margin-top: 26px; display: flex; justify-content: flex-end; }
    .summary table { width: 380px; }
    .summary td { border: none; padding: 6px 4px; }
    .summary .total td { font-size: 16px; font-weight: bold; border-top: 2px solid #333; }
    .footer { margin-top: 45px; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div><h2>TEDDYPET</h2><p>Hóa đơn bán hàng</p></div>
      <div><p><strong>Mã đơn:</strong> ${orderDetail.code}</p><p><strong>Ngày tạo:</strong> ${new Date(orderDetail.createdAt).toLocaleString("vi-VN")}</p></div>
    </div>
    <hr />
    <div class="section">
      <h3>Thông tin khách hàng</h3>
      <p><strong>Họ tên:</strong> ${orderDetail.fullName}</p>
      <p><strong>SĐT:</strong> ${orderDetail.phone}</p>
      <p><strong>Địa chỉ:</strong> ${orderDetail.address}</p>
    </div>
    <div class="section">
      <h3>Chi tiết sản phẩm</h3>
      <table>
        <thead><tr><th>STT</th><th>Sản phẩm</th><th>Phân loại</th><th>SL</th><th>Giá</th><th>Thành tiền</th></tr></thead>
        <tbody>
          ${orderDetail.items.map((item: any, i: number) => `
            <tr><td>${i + 1}</td><td class="name">${item.name}</td><td class="variant">${item.variant?.join(", ") || "—"}</td><td>${item.quantity}</td><td>${item.price.toLocaleString("vi-VN")} đ</td><td>${(item.price * item.quantity).toLocaleString("vi-VN")} đ</td></tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="summary">
      <table>
        <tr><td>Tạm tính</td><td>${(orderDetail.subTotal || 0).toLocaleString("vi-VN")} đ</td></tr>
        <tr><td>Phí vận chuyển</td><td>${(orderDetail.shipping?.fee || 0).toLocaleString("vi-VN")} đ</td></tr>
        <tr class="total"><td>Tổng thanh toán</td><td>${(orderDetail.total || 0).toLocaleString("vi-VN")} đ</td></tr>
      </table>
    </div>
    <div class="footer"><p>Cảm ơn quý khách đã mua hàng ❤️</p></div>
  </div>
</body>
</html>`;

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4' });
        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${orderCode}.pdf`);
        res.send(pdfBuffer);
    } catch (e) {
        res.status(500).send("Lỗi tạo PDF");
    }
};

export const cancelMyOrder = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const userId = res.locals.accountUser.id;
        const { reason } = req.body;
        const order = await Order.findOne({ _id: id, userId: userId, deleted: false });
        if (!order) return res.json({ code: "error", message: "Đơn hàng không tồn tại!" });
        if (order.orderStatus !== "pending" && order.orderStatus !== "confirmed") return res.json({ code: "error", message: "Chỉ có thể hủy đơn hàng đang chờ xác nhận hoặc đã xác nhận!" });
        if (order.paymentStatus === "paid") {
            await Order.updateOne({ _id: id }, { orderStatus: "request_cancel", cancelledReason: reason || "Yêu cầu hủy đơn đã thanh toán", cancelledAt: new Date(), cancelledBy: "customer" });
            return res.json({ code: "success", message: "Yêu cầu hủy đã được gửi! Admin sẽ kiểm tra và hoàn tiền sớm nhất." });
        }
        await refundOrderResources(order.code as string);
        await Order.updateOne({ _id: id }, { orderStatus: "cancelled", cancelledReason: reason || "Khách hàng hủy", cancelledAt: new Date(), cancelledBy: "customer" });
        res.json({ code: "success", message: "Hủy đơn hàng thành công!" });
    } catch (error) {
        res.json({ code: "error", message: "Lỗi hệ thống!" });
    }
};

export const confirmReceipt = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const userId = res.locals.accountUser.id;
        const order = await Order.findOne({ _id: id, userId: userId, deleted: false });
        if (!order) return res.json({ code: "error", message: "Đơn hàng không tồn tại!" });
        if (order.orderStatus !== "shipped") return res.json({ code: "error", message: "Chỉ có thể xác nhận khi đơn hàng đang ở trạng thái đã giao!" });
        await Order.updateOne({ _id: id }, { orderStatus: "completed" });
        if (order.code) await addPointAfterPayment(order.code);
        res.json({ code: "success", message: "Xác nhận nhận hàng thành công. Đơn hàng đã hoàn thành!" });
    } catch (error) {
        res.json({ code: "error", message: "Lỗi hệ thống!" });
    }
};

function sortObject(obj: any) {
    let sorted: any = {};
    let str = Object.keys(obj).sort();
    for (let i = 0; i < str.length; i++) {
        const key = str[i];
        const val = obj[key];
        if (val !== undefined && val !== null && val !== "") {
            sorted[key] = encodeURIComponent(val).replace(/%20/g, "+");
        }
    }
    return sorted;
}