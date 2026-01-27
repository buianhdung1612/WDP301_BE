import { Request, Response } from "express";
import AccountUser from "../../models/account-user.model";
import ForgotPassword from "../../models/forgot-password.model";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import jwt from "jsonwebtoken";
import * as generateHelper from "../../helpers/generate.helper";

// [POST] /api/v1/client/auth/register
export const registerPost = async (req: Request, res: Response) => {
    try {
        const existEmail = await AccountUser.findOne({
            email: req.body.email,
            deleted: false
        })

        if (existEmail) {
            return res.json({
                success: false,
                message: "Email đã được sử dụng!"
            });
        }

        const existPhone = await AccountUser.findOne({
            phone: req.body.phone,
            deleted: false
        })

        if (existPhone) {
            return res.json({
                success: false,
                message: "Số điện thoại đã được sử dụng!"
            });
        }

        req.body.password = await bcrypt.hash(req.body.password, 10);
        req.body.status = "active";
        req.body.search = slugify(`${req.body.fullName} ${req.body.email} ${req.body.phone}`, {
            replacement: " ",
            lower: true
        });

        const newAccount = new AccountUser(req.body);
        await newAccount.save();

        const tokenUser = jwt.sign(
            {
                id: newAccount.id,
                email: newAccount.email
            },
            `${process.env.JWT_SECRET}`,
            {
                expiresIn: "7d"
            }
        )

        res.cookie("tokenUser", tokenUser, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
            sameSite: "strict",
            secure: process.env.NODE_ENV === 'production'
        });

        res.json({
            success: true,
            message: "Đăng ký tài khoản thành công!",
            token: tokenUser,
            user: {
                fullName: newAccount.fullName,
                email: newAccount.email,
                phone: newAccount.phone
            }
        });
    } catch (error) {
        res.json({
            success: false,
            message: "Dữ liệu không hợp lệ!"
        })
    }
}

// [POST] /api/v1/client/auth/login
export const loginPost = async (req: Request, res: Response) => {
    try {
        const { email, password, rememberPassword } = req.body;

        const existAccount = await AccountUser.findOne({
            email: email,
            deleted: false
        })

        if (!existAccount) {
            return res.json({
                success: false,
                message: "Tài khoản không tồn tại!"
            });
        }

        const checkPassword = await bcrypt.compare(password, `${existAccount.password}`);

        if (!checkPassword) {
            return res.json({
                success: false,
                message: "Mật khẩu không đúng!"
            });
        }

        if (existAccount.status != "active") {
            return res.json({
                success: false,
                message: "Tài khoản không hoạt động!"
            });
        }

        const tokenUser = jwt.sign(
            {
                id: existAccount.id,
                email: existAccount.email
            },
            `${process.env.JWT_SECRET}`,
            {
                expiresIn: rememberPassword ? "7d" : "1d"
            }
        );

        res.cookie("tokenUser", tokenUser, {
            httpOnly: true,
            maxAge: rememberPassword ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 7 ngày, 1 ngày
            sameSite: "strict",
            secure: process.env.NODE_ENV === 'production'
        });

        res.json({
            success: true,
            message: "Đăng nhập thành công!",
            token: tokenUser,
            user: {
                fullName: existAccount.fullName,
                email: existAccount.email,
                phone: existAccount.phone,
                avatar: existAccount.avatar
            }
        });
    } catch (error) {
        res.json({
            success: false,
            message: "Dữ liệu không hợp lệ!"
        });
    }
}

// [POST] /api/v1/client/auth/logout
export const logout = async (req: Request, res: Response) => {
    res.clearCookie("tokenUser");
    res.json({
        success: true,
        message: "Đăng xuất thành công!"
    });
}

// [POST] /api/v1/client/auth/forgot-password
export const forgotPasswordPost = async (req: Request, res: Response) => {
    try {
        const email = req.body.email;

        const user = await AccountUser.findOne({
            email: email,
            deleted: false
        });

        if (!user) {
            return res.json({
                success: false,
                message: "Email không tồn tại!"
            });
        }

        const otp = generateHelper.generateRandomNumber(6);

        const objectForgotPassword = {
            email: email,
            otp: otp,
            expireAt: Date.now()
        };

        const forgotPassword = new ForgotPassword(objectForgotPassword);
        await forgotPassword.save();

        // Gửi OTP qua email (Ở đây chỉ console.log vì chưa có helper gửi mail)
        console.log(`OTP reset password của email ${email} là: ${otp}`);

        res.json({
            success: true,
            message: "Đã gửi mã OTP qua email!"
        });
    } catch (error) {
        res.json({
            success: false,
            message: "Gửi mã OTP thất bại!"
        });
    }
}

// [POST] /api/v1/client/auth/otp-password
export const otpPasswordPost = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        const result = await ForgotPassword.findOne({
            email: email,
            otp: otp
        });

        if (!result) {
            return res.json({
                success: false,
                message: "Mã OTP không hợp lệ!"
            });
        }

        const user = await AccountUser.findOne({
            email: email
        });

        // Set cookie tạm thời để cho phép reset password
        res.cookie("tokenResetPassword", user?.id, {
            httpOnly: true,
            maxAge: 5 * 60 * 1000, // 5 phút
            sameSite: "strict",
            secure: process.env.NODE_ENV === 'production'
        });

        res.json({
            success: true,
            message: "Xác nhận OTP thành công!"
        });
    } catch (error) {
        res.json({
            success: false,
            message: "Xác nhận OTP thất bại!"
        });
    }
}

// [POST] /api/v1/client/auth/reset-password
export const resetPasswordPost = async (req: Request, res: Response) => {
    try {
        const password = req.body.password;
        const id = req.cookies.tokenResetPassword;

        if (!id) {
            return res.json({
                success: false,
                message: "Phiên làm việc đã hết hạn!"
            });
        }

        const newPassword = await bcrypt.hash(password, 10);

        await AccountUser.updateOne({
            _id: id
        }, {
            password: newPassword
        });

        res.clearCookie("tokenResetPassword");

        res.json({
            success: true,
            message: "Đổi mật khẩu thành công!"
        });
    } catch (error) {
        res.json({
            success: false,
            message: "Đổi mật khẩu thất bại!"
        });
    }
}
