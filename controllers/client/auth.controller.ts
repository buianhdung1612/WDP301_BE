import { Request, Response } from "express";
import AccountUser from "../../models/account-user.model";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import jwt from "jsonwebtoken";
// import { generateRandomNumber } from "../../helpers/generate.helper";
// import VerifyOTP from "../../models/verify-otp.model";
// import { sendMail } from "../../helpers/mail.helper";

// [POST] /api/v1/client/auth/register
export const registerPost = async (req: Request, res: Response) => {
    try {
        const existEmail = await AccountUser.findOne({
            email: req.body.email,
            deleted: false
        })

        if (existEmail) {
            return res.json({
                code: "error",
                message: "Email đã được sử dụng!"
            });
        }

        const existPhone = await AccountUser.findOne({
            phone: req.body.phone,
            deleted: false
        })

        if (existPhone) {
            return res.json({
                code: "error",
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
            code: "success",
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
            code: "error",
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
                code: "error",
                message: "Tài khoản không tồn tại!"
            });
        }

        const checkPassword = await bcrypt.compare(password, `${existAccount.password}`);

        if (!checkPassword) {
            return res.json({
                code: "error",
                message: "Mật khẩu không đúng!"
            });
        }

        if (existAccount.status != "active") {
            return res.json({
                code: "error",
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
            code: "success",
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
            code: "error",
            message: "Dữ liệu không hợp lệ!"
        });
    }
}

// [POST] /api/v1/client/auth/logout
export const logout = async (req: Request, res: Response) => {
    res.clearCookie("tokenUser");
    res.json({
        code: "success",
        message: "Đăng xuất thành công!"
    });
}

/* 
// Logic tạm thời ẩn đi
export const callbackGoogle = async (req: Request, res: Response) => {
    // ... logic
}

export const callbackFacebook = async (req: Request, res: Response) => {
    // ... logic
}

export const forgotPasswordPost = async (req: Request, res: Response) => {
    // ... logic
}

export const otpPasswordPost = async (req: Request, res: Response) => {
    // ... logic
}

export const resetPasswordPost = async (req: Request, res: Response) => {
    // ... logic
}
*/
