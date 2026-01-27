import { Request, Response } from 'express';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import axios from 'axios';
import { getInfoAddress } from '../../helpers/location.helper';

// [POST] /api/v1/client/cart/list
export const list = async (req: Request, res: Response) => {
    try {
        const { cart, userAddress } = req.body;

        if (!Array.isArray(cart)) {
            return res.status(400).json({
                success: false,
                message: "Dữ liệu giỏ hàng không hợp lệ!"
            });
        }

        // 1. Lấy chi tiết sản phẩm và tính trọng lượng
        const cartDetail: any[] = [];
        let totalWeight = 0;

        for (const item of cart) {
            const productDetail = await Product.findOne({
                _id: item.productId,
                status: "active",
                deleted: false
            }).lean();

            if (productDetail) {
                const attributeList = await AttributeProduct.find({
                    _id: { $in: productDetail.attributes || [] }
                })
                    .select("_id name")
                    .lean();

                let finalPriceNew = productDetail.priceNew;
                let finalPriceOld = productDetail.priceOld;
                let finalStock = productDetail.stock;

                if (item.variant && item.variant.length > 0) {
                    const foundVariant = (productDetail.variants || []).find((v: any) => {
                        return (
                            v.attributeValue &&
                            v.attributeValue.length === item.variant.length &&
                            v.attributeValue.every((a: any) =>
                                item.variant.some((ov: any) => ov.attrId === a.attrId && ov.value === a.value)
                            )
                        );
                    });

                    if (foundVariant) {
                        finalPriceNew = parseInt(foundVariant.priceNew);
                        finalPriceOld = parseInt(foundVariant.priceOld);
                        finalStock = parseInt(foundVariant.stock);
                    }
                }

                // Giả định mỗi món hàng nặng 500g (theo yêu cầu code mẫu)
                totalWeight += (item.quantity * 500);

                const itemDetail = {
                    ...item,
                    detail: {
                        images: productDetail.images,
                        slug: productDetail.slug,
                        name: productDetail.name,
                        priceNew: finalPriceNew,
                        priceOld: finalPriceOld,
                        stock: finalStock,
                        attributeList: attributeList,
                        variants: productDetail.variants
                    }
                };

                cartDetail.push(itemDetail);
            }
        }

        // 2. Tính phí ship nếu có thông tin địa chỉ
        let shippingOptions = null;
        if (userAddress && userAddress.latitude && userAddress.longitude) {
            try {
                // Tọa độ cửa hàng (Fixed từ controller mẫu)
                const shopLocation = {
                    lat: 10.8037448,
                    lng: 106.6617749
                };

                const shopInfoAddress = await getInfoAddress(shopLocation.lat, shopLocation.lng);
                const userInfoAddress = await getInfoAddress(userAddress.latitude, userAddress.longitude);

                const dataGoShip = {
                    shipment: {
                        address_from: {
                            city: shopInfoAddress.city,
                            district: shopInfoAddress.district,
                            ward: shopInfoAddress.ward
                        },
                        address_to: {
                            city: userInfoAddress.city,
                            district: userInfoAddress.district,
                            ward: userInfoAddress.ward
                        },
                        parcel: {
                            cod: "0",
                            amount: "0",
                            weight: totalWeight,
                            width: "10",
                            height: "10",
                            length: "10"
                        }
                    }
                };

                const goshipRes = await axios.post("https://sandbox.goship.io/api/v2/rates", dataGoShip, {
                    headers: {
                        Authorization: `Bearer ${process.env.GOSHIP_TOKEN}`,
                        "Content-Type": "application/json"
                    }
                });

                shippingOptions = goshipRes.data.data;
            } catch (shipError) {
                console.error("Shipping Calculation Error:", shipError);
                // Vẫn trả về cart kể cả khi lỗi tính ship
            }
        }

        res.json({
            success: true,
            code: "success",
            message: "Thành công!",
            cart: cartDetail,
            shippingOptions: shippingOptions
        });
    } catch (error) {
        console.error("Cart List Error:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi tải giỏ hàng!"
        });
    }
}
