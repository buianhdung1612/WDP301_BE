import { Request, Response } from "express";
import AccountUser from "../../models/account-user.model";
import UserAddress from "../../models/user-address.model";
import slugify from "slugify";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Order from "../../models/order.model";

// [PATCH] /api/v1/client/dashboard/profile/edit
export const profileEdit = async (req: Request, res: Response) => {
    try {
        const id = res.locals.accountUser.id;
        const { email, phone, fullName } = req.body;

        const query: any = {
            _id: { $ne: id },
            deleted: false
        };

        const orConditions = [];
        if (email) orConditions.push({ email });
        if (phone) orConditions.push({ phone });

        if (orConditions.length > 0) {
            query.$or = orConditions;
        }

        const conflictUser = await AccountUser.findOne(query);

        if (conflictUser) {
            if (conflictUser.email === email) {
                return res.json({
                    success: false,
                    message: "Email đã tồn tại!",
                });
            }

            if (phone && conflictUser.phone === phone) {
                return res.json({
                    success: false,
                    message: "Số điện thoại đã tồn tại!",
                });
            }
        }

        req.body.search = slugify(
            `${fullName} ${email} ${phone}`,
            {
                replacement: " ",
                lower: true,
            }
        );

        await AccountUser.updateOne({ _id: id }, req.body);

        const tokenUser = jwt.sign(
            {
                id,
                email,
            },
            String(process.env.JWT_SECRET),
            {
                expiresIn: "1d",
            }
        );

        res.cookie("tokenUser", tokenUser, {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: "strict",
        });

        return res.json({
            success: true,
            message: "Cập nhật thành công!",
        });
    } catch (error) {
        return res.json({
            success: false,
            message: "Dữ liệu không hợp lệ!",
        });
    }
};

// [GET] /api/v1/client/dashboard/address
export const address = async (req: Request, res: Response) => {
    try {
        const id = res.locals.accountUser.id;

        const addressList = await UserAddress
            .find({
                userId: id
            })
            .sort({
                createdAt: "desc"
            });

        return res.json({
            success: true,
            data: addressList
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách địa chỉ!"
        });
    }
}

// [POST] /api/v1/client/dashboard/address/create
export const addressCreatePost = async (req: Request, res: Response) => {
    try {
        const id = res.locals.accountUser.id;

        req.body.userId = id;

        if (req.body.isDefault) {
            await UserAddress.updateMany({
                userId: id,
                isDefault: true
            }, {
                isDefault: false
            });
        }

        const newRecord = new UserAddress(req.body);
        await newRecord.save();

        return res.json({
            success: true,
            message: "Thêm địa chỉ thành công!"
        });
    } catch (error) {
        return res.json({
            success: false,
            message: "Dữ liệu không hợp lệ!"
        });
    }
}

// [GET] /api/v1/client/dashboard/address/detail/:id
export const addressDetail = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser.id;
        const addressId = req.params.id;

        const address = await UserAddress.findOne({
            _id: addressId,
            userId: userId
        });

        if (!address) {
            return res.json({
                success: false,
                message: "Không tìm thấy địa chỉ!"
            });
        }

        return res.json({
            success: true,
            data: address
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống!"
        });
    }
}

// [PATCH] /api/v1/client/dashboard/address/edit/:id
export const addressEditPatch = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser.id;
        const addressId = req.params.id;

        if (req.body.isDefault) {
            await UserAddress.updateMany({
                userId: userId,
                isDefault: true
            }, {
                isDefault: false
            });
        }

        await UserAddress.updateOne({
            _id: addressId,
            userId: userId
        }, req.body);

        return res.json({
            success: true,
            message: "Cập nhật địa chỉ thành công!"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Cập nhật thất bại!"
        });
    }
}

// [DELETE] /api/v1/client/dashboard/address/delete/:id
export const addressDelete = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser.id;
        const addressId = req.params.id;

        await UserAddress.deleteOne({
            _id: addressId,
            userId: userId
        });

        return res.json({
            success: true,
            message: "Xóa địa chỉ thành công!"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Xóa địa chỉ thất bại!"
        });
    }
}

// [PATCH] /api/v1/client/dashboard/address/change-default/:id
export const addressChangeDefault = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser.id;
        const addressId = req.params.id;

        // Bỏ mặc định của tất cả địa chỉ cũ
        await UserAddress.updateMany({
            userId: userId,
            isDefault: true
        }, {
            isDefault: false
        });

        // Set mặc định cho địa chỉ mới
        const result = await UserAddress.updateOne({
            _id: addressId,
            userId: userId
        }, {
            isDefault: true
        });

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy địa chỉ!"
            });
        }

        return res.json({
            success: true,
            message: "Đã đặt địa chỉ làm mặc định!"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống!"
        });
    }
}

// [PATCH] /api/v1/client/dashboard/change-password
export const changePassword = async (req: Request, res: Response) => {
    try {
        const id = res.locals.accountUser.id;
        const { newPassword } = req.body;

        const user = await AccountUser.findOne({
            _id: id,
            deleted: false
        });

        if (!user) {
            return res.json({
                success: false,
                message: "Người dùng không tồn tại!"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await AccountUser.updateOne({
            _id: id
        }, {
            password: hashedPassword
        });

        return res.json({
            success: true,
            message: "Đổi mật khẩu thành công!"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Đã có lỗi xảy ra!"
        });
    }
}

export const profileChangeAvatar = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser.id;
        const { avatar } = req.body;

        if (!avatar) {
            return res.json({
                success: false,
                message: "Vui lòng gửi kèm đường dẫn ảnh!"
            });
        }

        await AccountUser.updateOne({
            _id: userId
        }, {
            avatar: avatar
        });

        return res.json({
            success: true,
            message: "Đã cập nhật ảnh đại diện!",
            avatar: avatar
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống!"
        });
    }
}

export const orderList = async (req: Request, res: Response) => {
    try {
        const id = res.locals.accountUser.id;

        const orders = await Order
            .find({
                userId: id,
                deleted: false
            })
            .sort({
                createdAt: "desc"
            });

        return res.json({
            success: true,
            orders: orders
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống!"
        });
    }
}

export const orderDetail = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser.id;
        const orderId = req.params.id;

        const orderDetail = await Order.findOne({
            _id: orderId,
            userId: userId,
            deleted: false
        });

        if (!orderDetail) {
            return res.json({
                success: false,
                message: "Không tìm thấy đơn hàng!"
            });
        }

        return res.json({
            success: true,
            order: orderDetail
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống!"
        });
    }
}