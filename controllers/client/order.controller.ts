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

        // Thêm các trường có sẵn
        // The provided code edit includes React hooks (useNotifications, useMarkAsRead, etc.)
        // which are not valid in an Express backend file.
        // To maintain syntactical correctness and avoid breaking the application,
        // these lines are not inserted.
        // The original fields are kept as they are essential for order creation.
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
                    // ── BIẾN THỂ: Atomic update ──
                    // Xây điều kiện $all match từng cặp attrId+value trong attributeValue
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
                                    // Tìm đúng biến thể có đủ các giá trị attrId+value VÀ còn đủ stock
                                    attributeValue: { $all: elemsMatch, $size: item.variant.length },
                                    stock: { $gte: item.quantity }
                                }
                            }
                        },
                        { $inc: { "variants.$.stock": -item.quantity } } // Trừ nguyên tử
                    );

                    if (variantUpdateResult.modifiedCount === 0) {
                        // Không match = biến thể không tồn tại HOẶC không đủ tồn kho
                        return res.json({
                            code: "error",
                            message: `Sản phẩm "${productDetail.name}" (biến thể) không đủ số lượng tồn kho!`
                        });
                    }

                    // Lấy price từ snapshot đã đọc trước đó (tránh query thêm)
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
                    // ── KHÔNG BIẾN THỂ: Atomic update ──
                    const stockUpdateResult = await Product.updateOne(
                        {
                            _id: item.productId,
                            deleted: false,
                            status: "active",
                            stock: { $gte: item.quantity } // Chỉ update nếu còn đủ hàng
                        },
                        { $inc: { stock: -item.quantity } } // Trừ nguyên tử
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

        // Trường subTotal
        dataFinal.subTotal = dataFinal.items.reduce((total: number, item: any) => total + (item.price * item.quantity), 0);

        // Trường discount
        dataFinal.discount = 0;
        const couponCodeRaw = req.body.coupon;
        if (couponCodeRaw && typeof couponCodeRaw === 'string' && couponCodeRaw.trim() !== "") {
            const couponCode = couponCodeRaw.trim().toUpperCase();
            const couponDetail: any = await Coupon.findOne({
                code: couponCode,
                deleted: false,
                status: "active"
            });
            if (!couponDetail) {
                return res.json({
                    code: "error",
                    message: "Mã giảm giá không tồn tại!",
                });
            }

            // Kiểm tra ngày hiệu lực
            const now = new Date();
            if (couponDetail.startDate && now < couponDetail.startDate) {
                return res.json({
                    code: "error",
                    message: "Mã giảm giá chưa bắt đầu!",
                });
            }

            if (couponDetail.endDate && now > couponDetail.endDate) {
                return res.json({
                    code: "error",
                    message: "Mã giảm giá đã hết hạn!",
                });
            }
            // Kiểm tra giới hạn sử dụng
            if (
                couponDetail.usageLimit &&
                couponDetail.usedCount >= couponDetail.usageLimit
            ) {
                return res.json({
                    code: "error",
                    message: "Mã giảm giá đã hết!",
                });
            }

            // Kiểm tra giá trị đơn hàng tối thiểu
            if (dataFinal.subTotal >= couponDetail.minOrderValue) {
                if (couponDetail.typeDiscount === "percentage") {
                    dataFinal.discount = (dataFinal.subTotal * couponDetail.value) / 100;

                    // Giới hạn mức giảm tối đa (nếu có)
                    if (couponDetail.maxDiscountValue > 0 && dataFinal.discount > couponDetail.maxDiscountValue) {
                        dataFinal.discount = couponDetail.maxDiscountValue;
                    }

                } else if (couponDetail.typeDiscount === "fixed") {
                    dataFinal.discount = couponDetail.value;
                }

                // Cập nhật lại số lượng đã dùng
                await Coupon.updateOne({
                    _id: couponDetail._id,
                    deleted: false,
                    status: "active"
                }, {
                    usedCount: couponDetail.usedCount + 1
                })
            } else {
                // Nếu chưa đủ điều kiện áp dụng mã
                return res.json({
                    code: "error",
                    message: `Đơn hàng chưa đạt giá trị tối thiểu: ${couponDetail.minOrderValue}đ để áp dụng mã giảm giá.`,
                });
            }
        }
        // Hết trường discount từ coupon

        // Xử lý dùng điểm (usedPoint)
        dataFinal.usedPoint = 0;
        dataFinal.pointDiscount = 0;

        const usedPointBody = parseInt(req.body.usedPoint);
        if (usedPointBody > 0 && res.locals.accountUser) {
            const user = res.locals.accountUser;
            const canUsePoint = (user.totalPoint || 0) - (user.usedPoint || 0);

            if (usedPointBody > canUsePoint) {
                return res.json({
                    code: "error",
                    message: "Số điểm sử dụng vượt quá số điểm hiện có!"
                });
            }

            const pointConfig = await getPointConfig();
            dataFinal.usedPoint = usedPointBody;
            dataFinal.pointDiscount = usedPointBody * (pointConfig.POINT_TO_MONEY || 0);

            // Cập nhật usedPoint trong AccountUser
            await AccountUser.updateOne({
                _id: user.id
            }, {
                $inc: { usedPoint: usedPointBody }
            });
        }
        // Hết Xử lý dùng điểm

        // Trường shippingMethod
        // Tọa độ người gửi
        const shopLocation = {
            lat: 10.8037448,
            lng: 106.6617749
        };

        const shopInfoAddress = await getInfoAddress(shopLocation.lat, shopLocation.lng);
        const userInfoAddress = await getInfoAddress(dataFinal.latitude, dataFinal.longitude);

        // Tính trọng lượng đơn hàng
        const totalWeight = dataFinal.items.reduce((total: number, item: any) => total + item.quantity * 500, 0); // mỗi 1 sản phẩm nặng 500gram

        const dataGoShip = {
            shipment: {
                rate: req.body.shippingMethod,
                payer: 0, // Người trả phí, 1: Người gửi, 0: Người nhận
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
                    width: "10",
                    height: "10",
                    length: "10",
                    metadata: "Hàng dễ vỡ, vui lòng nhẹ tay."
                }
            }
        };

        const shippingSettings = await getApiShipping();

        const goshipRes = await axios.post("https://sandbox.goship.io/api/v2/shipments", dataGoShip, {
            headers: {
                Authorization: `Bearer ${shippingSettings?.tokenGoShip || ""}`,
                "Content-Type": "application/json"
            }
        });

        dataFinal.shipping = {
            goshipOrderId: goshipRes.data.id,
            carrierName: goshipRes.data.carrier,
            carrierCode: goshipRes.data.carrier_short_name,
            fee: goshipRes.data.fee,
            cod: goshipRes.data.cod,
        };
        // Hết Trường shippingMethod

        // Trường total
        dataFinal.total = dataFinal.subTotal + dataFinal.shipping.fee - dataFinal.discount - dataFinal.pointDiscount;

        // Lưu dữ liệu vào CSDL
        const newRecord = new Order(dataFinal);
        await newRecord.save();

        // Tạo thông báo mới cho Admin
        try {
            const Notification = (await import("../../models/notification.model")).default;
            await Notification.create({
                senderId: dataFinal.userId || null,
                type: "order",
                title: "Đơn hàng sản phẩm mới",
                content: `Đơn hàng mới ${dataFinal.code} từ ${dataFinal.fullName} - Tổng: ${dataFinal.total.toLocaleString("vi-VN")}đ`,
                metadata: {
                    orderId: newRecord._id,
                    orderCode: dataFinal.code
                },
                status: "unread"
            });
        } catch (notifError) {
            console.error("Lỗi tạo thông báo đơn hàng:", notifError);
        }

        res.json({
            code: "success",
            message: "Đặt hàng thành công!",
            orderCode: dataFinal.code,
            phone: dataFinal.phone
        });
    } catch (error: any) {
        console.error("LỖI QUY TRÌNH ĐẶT HÀNG:", error.response?.data || error.message);

        // Lưu đơn hàng dưới dạng thất bại để track log và hoàn tài nguyên
        if (dataFinal.code) {
            dataFinal.orderStatus = "cancelled";
            dataFinal.note = (dataFinal.note || "") + ` [Lỗi tự động: ${error.message}]`;
            try {
                const failedOrder = new Order(dataFinal);
                await failedOrder.save();
                // Hoàn lại tài nguyên thông qua helper
                await refundOrderResources(dataFinal.code);
            } catch (saveError) {
                console.error("KHÔNG THỂ LƯU ĐƠN HÀNG LỖI:", saveError);
            }
        }

        res.json({
            code: "error",
            message: error.response?.data?.message || error.message || "Lỗi hệ thống khi đặt hàng!"
        });
    }
};

// [GET] /api/v1/client/order/success
export const success = async (req: Request, res: Response) => {
    try {
        const { orderCode, phone } = req.query;

        if (!orderCode || !phone) {
            return res.status(400).json({
                code: "error",
                message: "Thông tin không hợp lệ!"
            });
        }

        const orderDetail = await Order.findOne({
            code: orderCode,
            phone: phone,
            deleted: false
        }).lean();

        if (!orderDetail) {
            return res.status(404).json({
                code: "error",
                message: "Không tìm thấy đơn hàng!"
            });
        }

        res.json({
            code: "success",
            message: "Thành công!",
            order: orderDetail
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            code: "error",
            message: "Lỗi hệ thống!"
        });
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

    if (!target) {
        res.json({
            success: false,
            message: "Không tìm thấy đơn hàng hoặc lịch đặt!"
        });
        return;
    }

    // Thiết lập thời gian hết hạn (16 phút)
    const paymentExpireAt = new Date(Date.now() + 16 * 60 * 1000);
    if (orderCode) {
        await Order.updateOne({ _id: target._id }, { paymentExpireAt });
    } else if (bookingCode) {
        await Booking.updateOne({ _id: target._id }, { paymentExpireAt });
    }

    const paymentSettings = await getApiPayment();

    const config = {
        app_id: `${paymentSettings.zaloAppId}`,
        key1: `${paymentSettings.zaloKey1}`,
        key2: `${paymentSettings.zaloKey2}`,
        endpoint: `${paymentSettings.zaloDomain}/v2/create`
    };

    const successPath = orderCode ? `/order/success?orderCode=${orderCode}&phone=${phone}` : `/booking/success`; // Admin might want to go back to list
    const embed_data = {
        redirecturl: `${process.env.DOMAIN_WEBSITE}${successPath}`
    };

    const items = [{}];
    const transID = Math.floor(Math.random() * 1000000);

    let amount = target.total;
    if (bookingCode && target.depositAmount > 0 && target.paymentStatus === "unpaid") {
        amount = target.depositAmount;
    }

    const order = {
        app_id: config.app_id,
        app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
        app_user: `${phone}-${code}`,
        app_time: Date.now(), // miliseconds
        item: JSON.stringify(items),
        embed_data: JSON.stringify(embed_data),
        amount: amount,
        description: `Thanh toán ${orderCode ? 'đơn hàng' : 'lịch đặt'} ${code}`,
        bank_code: "",
        mac: "",
        callback_url: `${process.env.BACKEND_URL}/api/v1/client/order/payment-zalopay-result`
    };

    // appid|app_trans_id|appuser|amount|apptime|embeddata|item
    const data = config.app_id + "|" + order.app_trans_id + "|" + order.app_user + "|" + order.amount + "|" + order.app_time + "|" + order.embed_data + "|" + order.item;
    order.mac = hmacSHA256(data, config.key1).toString();

    const response = await axios.post(config.endpoint, null, { params: order });
    res.redirect(response.data.order_url);
}

export const paymentZalopayResult = async (req: Request, res: Response) => {
    const paymentSettings = await getApiPayment();

    const config = {
        key2: `${paymentSettings.zaloKey2}`
    };

    let result: any = {};

    try {
        let dataStr = req.body.data;
        let reqMac = req.body.mac;

        let mac = hmacSHA256(dataStr, config.key2).toString();


        // kiểm tra callback hợp lệ (đến từ ZaloPay server)
        if (reqMac !== mac) {
            // callback không hợp lệ
            result.return_code = -1;
            result.return_message = "mac not equal";
        }
        else {
            // thanh toán thành công (ZaloPay chỉ gọi callback khi thanh toán thành công và MAC khớp)
            // merchant cập nhật trạng thái cho đơn hàng
            let dataJson = JSON.parse(dataStr);
            const [phone, code] = dataJson.app_user.split("-");

            // Thanh toán thành công
            if (code.startsWith("BK")) {
                const booking = await Booking.findOne({ code, customerPhone: phone, deleted: false });
                if (booking) {
                    let updateData: any = {};
                    if (booking.depositAmount > 0 && booking.paymentStatus === "unpaid") {
                        updateData.paymentStatus = "partially_paid";
                        updateData.depositMethod = "zalopay";
                        updateData.bookingStatus = "confirmed";
                    } else {
                        updateData.paymentStatus = "paid";
                    }
                    await Booking.updateOne({ _id: booking._id }, updateData);
                }
            } else {
                await Order.updateOne({
                    phone: phone,
                    code: code,
                    deleted: false
                }, {
                    paymentStatus: "paid"
                });
                await addPointAfterPayment(code);
            }

            result.return_code = 1;
            result.return_message = "success";
        }
    } catch (ex: any) {
        result.return_code = 0; // ZaloPay server sẽ callback lại (tối đa 3 lần)
        result.return_message = ex.message;
    }

    // thông báo kết quả cho ZaloPay server
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

    if (!target) {
        res.json({
            success: false,
            message: "Không tìm thấy đơn hàng hoặc lịch đặt!"
        });
        return;
    }

    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');

    let ipAddr = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress;

    const paymentSettings = await getApiPayment();

    let tmnCode = `${paymentSettings.vnpTmnCode}`;
    let secretKey = `${paymentSettings.vnpHashSecret}`;
    let vnpUrl = `${paymentSettings.vnpUrl}`;
    let returnUrl = `http://localhost:3000/api/v1/client/order/payment-vnpay-result`;
    let orderId = `${phone}-${code}-${Date.now()}`;
    let amount = target.total || 0;
    if (bookingCode && target.depositAmount > 0 && target.paymentStatus === "unpaid") {
        amount = target.depositAmount;
    }
    let bankCode = "";

    let locale = 'vn';
    let currCode = 'VND';
    let vnp_Params: any = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan cho ma GD:' + orderId;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    if (bankCode !== null && bankCode !== '') {
        vnp_Params['vnp_BankCode'] = bankCode;
    }

    vnp_Params = sortObject(vnp_Params);

    let querystring = require('qs');
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(new Buffer(signData, 'utf-8')).digest("hex");
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

    res.redirect(vnpUrl);
}

export const paymentVNPayResult = async (req: Request, res: Response) => {
    let vnp_Params = req.query;

    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);

    const paymentSettings = await getApiPayment();

    let secretKey = `${paymentSettings.vnpHashSecret}`;

    let querystring = require('qs');
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(new Buffer(signData, 'utf-8')).digest("hex");

    if (secureHash === signed) {
        const [phone, code] = (vnp_Params['vnp_TxnRef'] as string).split('-');

        if (vnp_Params['vnp_ResponseCode'] === '00') {
            if (code.startsWith("BK")) {
                const booking = await Booking.findOne({ code, customerPhone: phone, deleted: false });
                if (booking) {
                    let updateData: any = {};
                    if (booking.depositAmount > 0 && booking.paymentStatus === "unpaid") {
                        updateData.paymentStatus = (booking.depositAmount || 0) >= (booking.total || 0) ? "paid" : "partially_paid";
                        updateData.depositMethod = "vnpay";
                        updateData.bookingStatus = "confirmed";
                    } else {
                        updateData.paymentStatus = "paid";
                    }
                    await Booking.updateOne({ _id: booking._id }, updateData);
                }
            } else {
                await Order.findOneAndUpdate({
                    phone: phone,
                    code: code,
                    deleted: false
                }, {
                    paymentStatus: 'paid'
                });
                await addPointAfterPayment(code);
            }

            const successPath = code.startsWith("BK") ? `/dashboard/bookings` : `/order/success?orderCode=${code}&phone=${phone}`;
            res.redirect(`${process.env.DOMAIN_WEBSITE}${successPath}`);
        } else {
            // Nếu thanh toán thất bại hoặc người dùng hủy
            if (code.startsWith("BK")) {
                await Booking.findOneAndUpdate({
                    customerPhone: phone,
                    code: code,
                    deleted: false
                }, {
                    paymentStatus: 'unpaid',
                    bookingStatus: 'cancelled'
                });
            } else {
                await Order.findOneAndUpdate({
                    phone: phone,
                    code: code,
                    deleted: false
                }, {
                    paymentStatus: 'unpaid',
                    orderStatus: 'cancelled'
                });
                await refundOrderResources(code);
            }
            // Redirect back to shopping or order history if failed
            const failPath = code.startsWith("BK") ? `/dashboard/bookings` : `/cart`;
            res.redirect(`${process.env.DOMAIN_WEBSITE}${failPath}`);
        }
    } else {
        res.render('success', { code: '97' })
    }
}

export const exportPdf = async (req: Request, res: Response) => {
    const { orderCode, phone } = req.query;

    const orderDetail = await Order.findOne({
        code: orderCode,
        phone: phone,
        deleted: false,
    });

    if (!orderDetail) {
        return res.status(404).json({ message: "Order not found" });
    }

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Hóa đơn ${orderDetail.code}</title>

  <style>
    * { box-sizing: border-box; }

    body {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: 13px;
      color: #2c2c2c;
      padding: 20px;
      background: #f6f7fb;
    }

    .invoice {
      max-width: 820px;
      margin: auto;
      background: #fff;
      padding: 28px 30px;
      border-radius: 6px;
      box-shadow: 0 0 0 1px #e5e7eb;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header h2 {
      margin: 0;
      font-size: 22px;
    }

    .header p {
      margin: 2px 0;
      font-size: 12.5px;
      color: #555;
    }

    hr {
      margin: 18px 0;
      border: none;
      border-top: 1px dashed #ddd;
    }

    .section {
      margin-top: 22px;
    }

    .section h3 {
      margin-bottom: 10px;
      font-size: 14px;
      text-transform: uppercase;
      color: #3a7bd5;
      border-bottom: 2px solid #3a7bd5;
      padding-bottom: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }

    th {
      background: #f3f6fb;
      padding: 9px 6px;
      border: 1px solid #e1e5ea;
      font-size: 12.5px;
    }

    td {
      border: 1px solid #e1e5ea;
      padding: 9px 6px;
      font-size: 12.5px;
      text-align: center;
    }

    td.name { text-align: left; font-weight: 500; }
    td.variant { text-align: left; font-size: 12px; color: #555; }

    .two-col {
      display: flex;
      justify-content: space-between;
      gap: 20px;
    }

    .two-col .col { width: 50%; }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11.5px;
      margin-left: 6px;
    }

    .paid { background: #e6f7ee; color: #1e8f5c; }
    .unpaid { background: #ffeaea; color: #c0392b; }
    .pending { background: #fff5e6; color: #e67e22; }
    .confirmed { background: #e6f7ee; color: #29ae27; }
    .shipping { background: #e8f2ff; color: #3a7bd5; }
    .completed { background: #e6f7ee; color: #27ae60; }
    .cancelled, .returned { background: #fbeaea; color: #c0392b; }

    .summary {
      margin-top: 26px;
      display: flex;
      justify-content: flex-end;
    }

    .summary table { width: 380px; }
    .summary td { border: none; padding: 6px 4px; }
    .summary .total td {
      font-size: 16px;
      font-weight: bold;
      border-top: 2px solid #333;
    }

    .footer {
      margin-top: 45px;
      text-align: center;
      font-size: 12px;
      color: #888;
    }

    @media print {
      body { background: #fff; padding: 0; }
      .invoice { box-shadow: none; }
    }
  </style>
</head>

<body>
  <div class="invoice">

    <div class="header">
      <div>
        <h2>TEDDYPET</h2>
        <p>Hóa đơn bán hàng</p>
      </div>
      <div>
        <p><strong>Mã đơn:</strong> ${orderDetail.code}</p>
        <p><strong>Ngày tạo:</strong> ${new Date(orderDetail.createdAt).toLocaleString("vi-VN")}</p>
      </div>
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
        <thead>
          <tr>
            <th>STT</th>
            <th>Sản phẩm</th>
            <th>Phân loại</th>
            <th>SL</th>
            <th>Giá</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${orderDetail.items.map((item: any, i: number) => `
            <tr>
              <td>${i + 1}</td>
              <td class="name">${item.name}</td>
              <td class="variant">${item.variant?.join(", ") || "—"}</td>
              <td>${item.quantity}</td>
              <td>${item.price.toLocaleString("vi-VN")} đ</td>
              <td>${(item.price * item.quantity).toLocaleString("vi-VN")} đ</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="summary">
      <table>
        <tr>
          <td>Tạm tính</td>
          <td>${(orderDetail.subTotal || 0).toLocaleString("vi-VN")} đ</td>
        </tr>
        <tr>
          <td>Phí vận chuyển</td>
          <td>${(orderDetail.shipping?.fee || 0).toLocaleString("vi-VN")} đ</td>
        </tr>
        <tr class="total">
          <td>Tổng thanh toán</td>
          <td>${(orderDetail.total || 0).toLocaleString("vi-VN")} đ</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <p>Cảm ơn quý khách đã mua hàng ❤️</p>
    </div>

  </div>
</body>
</html>
`;

    // Tạo PDF từ HTML sử dụng Puppeteer
    const browser = await puppeteer.launch(); // Mở trình duyệt ẩn
    const page = await browser.newPage(); // Mở tab mới
    await page.setContent(html, { waitUntil: 'networkidle0' }); // Đặt nội dung HTML
    const pdfBuffer = await page.pdf({ format: 'A4' }); // Tạo PDF dưới dạng buffer
    await browser.close(); // Đóng trình duyệt

    // Gửi file PDF về client
    res.setHeader('Content-Type', 'application/pdf'); // Thiết lập header để trình duyệt nhận biết đây là file PDF
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${orderCode}.pdf`); // Thiết lập tên file khi tải về
    res.send(pdfBuffer); // Gửi buffer PDF về client
};


// [PATCH] /api/v1/client/order/:id/cancel
export const cancelMyOrder = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const userId = res.locals.accountUser.id;
        const { reason } = req.body;

        const order = await Order.findOne({
            _id: id,
            userId: userId,
            deleted: false
        });

        if (!order) {
            return res.json({
                code: "error",
                message: "Đơn hàng không tồn tại!"
            });
        }

        if (order.orderStatus !== "pending" && order.orderStatus !== "confirmed") {
            return res.json({
                code: "error",
                message: "Chỉ có thể hủy đơn hàng đang chờ xác nhận hoặc đã xác nhận!"
            });
        }

        if (order.paymentStatus === "paid") {
            await Order.updateOne({ _id: id }, {
                orderStatus: "request_cancel",
                cancelledReason: reason || "Yêu cầu hủy đơn đã thanh toán",
                cancelledAt: new Date(),
                cancelledBy: "customer"
            });

            return res.json({
                code: "success",
                message: "Yêu cầu hủy đã được gửi! Admin sẽ kiểm tra và hoàn tiền sớm nhất."
            });
        }

        // Hoàn lại tài nguyên (stock, point) - chỉ thực hiện khi hủy luôn đơn chưa thanh toán
        await refundOrderResources(order.code as string);

        // Cập nhật trạng thái đơn hàng (Hủy ngay đơn chưa thanh toán)
        await Order.updateOne({ _id: id }, {
            orderStatus: "cancelled",
            cancelledReason: reason || "Khách hàng hủy",
            cancelledAt: new Date(),
            cancelledBy: "customer"
        });

        res.json({
            code: "success",
            message: "Hủy đơn hàng thành công!"
        });

    } catch (error) {
        console.error("Cancel Order Error:", error);
        res.json({
            code: "error",
            message: "Lỗi hệ thống!"
        });
    }
};



// [PATCH] /api/v1/client/order/:id/confirm-receipt
export const confirmReceipt = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const userId = res.locals.accountUser.id;

        const order = await Order.findOne({
            _id: id,
            userId: userId,
            deleted: false
        });

        if (!order) {
            return res.json({
                code: "error",
                message: "Đơn hàng không tồn tại!"
            });
        }

        if (order.orderStatus !== "shipped") {
            return res.json({
                code: "error",
                message: "Chỉ có thể xác nhận khi đơn hàng đang ở trạng thái đã giao!"
            });
        }

        // Cập nhật trạng thái thành completed
        await Order.updateOne({ _id: id }, {
            orderStatus: "completed"
        });

        // Tích điểm cho người dùng (nếu chưa tích)
        if (order.code) {
            await addPointAfterPayment(order.code);
        }

        res.json({
            code: "success",
            message: "Xác nhận nhận hàng thành công. Đơn hàng đã hoàn thành!"
        });

    } catch (error) {
        console.error("Confirm Receipt Error:", error);
        res.json({
            code: "error",
            message: "Lỗi hệ thống!"
        });
    }
};


function sortObject(obj: any) {
    let sorted: any = {};
    let str: string[] = [];
    for (let key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (let i = 0; i < str.length; i++) {
        const decodedKey = decodeURIComponent(str[i]);
        sorted[str[i]] = encodeURIComponent(obj[decodedKey]).replace(/%20/g, "+");
    }
    return sorted;
}