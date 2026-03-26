import { Request, Response } from "express";
import AccountUser from "../../models/account-user.model";
import ForgotPassword from "../../models/forgot-password.model";
import axios from "axios";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import jwt from "jsonwebtoken";
import * as generateHelper from "../../helpers/generate.helper";
import * as authMiddleware from "../../middlewares/client/auth.middleware";
import { getApiLoginSocial } from "../../configs/setting.config";

const respondWithToken = (res: Response, user: any, message = "Đăng nhập thành công!") => {
    const tokenUser = jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        `${process.env.JWT_SECRET}`,
        {
            expiresIn: "7d"
        }
    );

    return res.json({
        success: true,
        message,
        token: tokenUser,
        user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            totalPoint: user.totalPoint || 0,
            usedPoint: user.usedPoint || 0
        }
    });
};

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
                id: newAccount.id,
                fullName: newAccount.fullName,
                email: newAccount.email,
                phone: newAccount.phone,
                totalPoint: newAccount.totalPoint || 0,
                usedPoint: newAccount.usedPoint || 0
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
                id: existAccount.id,
                fullName: existAccount.fullName,
                email: existAccount.email,
                phone: existAccount.phone,
                avatar: existAccount.avatar,
                totalPoint: existAccount.totalPoint || 0,
                usedPoint: existAccount.usedPoint || 0
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

        // Send OTP via email (currently saved to DB)

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


export const callbackGoogle = async (req: Request, res: Response) => {
    const user = req.user as any;

    const tokenUser = jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        `${process.env.JWT_SECRET}`,
        {
            expiresIn: "7d"
        }
    );

    res.cookie("tokenUser", tokenUser, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
        secure: process.env.NODE_ENV === 'production'
    });

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}`);
}

export const callbackFacebook = async (req: Request, res: Response) => {
    const user = req.user as any;

    const tokenUser = jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        `${process.env.JWT_SECRET}`,
        {
            expiresIn: "7d"
        }
    );

    res.cookie("tokenUser", tokenUser, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
        secure: process.env.NODE_ENV === 'production'
    });

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}`);
}

// [POST] /api/v1/client/auth/google/token
export const googleTokenLoginPost = async (req: Request, res: Response) => {
    try {
        const { accessToken, idToken, authCode, redirectUri } = req.body;

        if (!accessToken && !idToken && !authCode) {
            return res.json({
                success: false,
                message: "Thiếu token Google!"
            });
        }

        const apiLoginSocial = await getApiLoginSocial();
        if (!apiLoginSocial?.googleClientId) {
            return res.json({
                success: false,
                message: "Chưa cấu hình Google Client ID!"
            });
        }

        let tokenAccess = accessToken;
        let tokenId = idToken;

        if (authCode) {
            if (!apiLoginSocial?.googleClientSecret) {
                return res.json({
                    success: false,
                    message: "Chưa cấu hình Google Client Secret!"
                });
            }

            const tokenRes = await axios.post(
                "https://oauth2.googleapis.com/token",
                new URLSearchParams({
                    code: authCode,
                    client_id: apiLoginSocial.googleClientId,
                    client_secret: apiLoginSocial.googleClientSecret,
                    redirect_uri: redirectUri || "https://auth.expo.io/@huytran62044/wdtsweetheart-mobile",
                    grant_type: "authorization_code"
                }).toString(),
                {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" }
                }
            );

            tokenAccess = tokenRes.data?.access_token || tokenAccess;
            tokenId = tokenRes.data?.id_token || tokenId;
        }

        let googleProfile: any = null;

        if (tokenId) {
            const tokenInfo = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
                params: { id_token: tokenId }
            });

            if (tokenInfo.data?.aud !== apiLoginSocial.googleClientId) {
                return res.json({
                    success: false,
                    message: "Google token không hợp lệ!"
                });
            }

            googleProfile = tokenInfo.data;
        } else if (tokenAccess) {
            const tokenInfo = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
                params: { access_token: tokenAccess }
            });

            if (tokenInfo.data?.aud !== apiLoginSocial.googleClientId) {
                return res.json({
                    success: false,
                    message: "Google token không hợp lệ!"
                });
            }

            const userInfo = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: {
                    Authorization: `Bearer ${tokenAccess}`
                }
            });

            googleProfile = userInfo.data;
        } else {
            return res.json({
                success: false,
                message: "Không lấy được token Google!"
            });
        }

        const email = googleProfile?.email;
        if (!email) {
            return res.json({
                success: false,
                message: "Không lấy được email từ Google!"
            });
        }

        const fullName = googleProfile?.name || "Google User";
        const googleId = googleProfile?.sub;
        const avatar = googleProfile?.picture;

        let user = await AccountUser.findOne({
            email: email,
            deleted: false
        });

        if (user) {
            let shouldSave = false;
            if (!user.googleId && googleId) {
                user.googleId = googleId;
                shouldSave = true;
            }
            if (!user.avatar && avatar) {
                user.avatar = avatar;
                shouldSave = true;
            }
            if (!user.search) {
                user.search = slugify(`${user.fullName} ${user.email} ${user.phone || ""}`, {
                    replacement: " ",
                    lower: true
                });
                shouldSave = true;
            }

            if (shouldSave) {
                await user.save();
            }

            return respondWithToken(res, user);
        }

        const search = slugify(`${fullName} ${email}`, {
            replacement: " ",
            lower: true
        });

        user = new AccountUser({
            googleId: googleId,
            fullName: fullName,
            email: email,
            avatar: avatar,
            search: search,
            status: "active"
        });

        await user.save();
        return respondWithToken(res, user);
    } catch (error) {
        return res.json({
            success: false,
            message: "Đăng nhập Google thất bại!"
        });
    }
}

// [POST] /api/v1/client/auth/facebook/token
export const facebookTokenLoginPost = async (req: Request, res: Response) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.json({
                success: false,
                message: "Thiếu token Facebook!"
            });
        }

        const apiLoginSocial = await getApiLoginSocial();
        if (!apiLoginSocial?.facebookAppId || !apiLoginSocial?.facebookAppSecret) {
            return res.json({
                success: false,
                message: "Chưa cấu hình Facebook App ID/Secret!"
            });
        }

        const appAccessToken = `${apiLoginSocial.facebookAppId}|${apiLoginSocial.facebookAppSecret}`;

        const debugToken = await axios.get("https://graph.facebook.com/debug_token", {
            params: {
                input_token: accessToken,
                access_token: appAccessToken
            }
        });

        const debugData = debugToken.data?.data;
        if (!debugData?.is_valid || debugData?.app_id !== apiLoginSocial.facebookAppId) {
            return res.json({
                success: false,
                message: "Facebook token không hợp lệ!"
            });
        }

        const profileRes = await axios.get("https://graph.facebook.com/me", {
            params: {
                fields: "id,name,email,picture.type(large)",
                access_token: accessToken
            }
        });

        const facebookProfile = profileRes.data;
        const email = facebookProfile?.email;

        if (!email) {
            return res.json({
                success: false,
                message: "Không lấy được email từ Facebook!"
            });
        }

        const fullName = facebookProfile?.name || "Facebook User";
        const facebookId = facebookProfile?.id;
        const avatar = facebookProfile?.picture?.data?.url;

        let user = await AccountUser.findOne({
            email: email,
            deleted: false
        });

        if (user) {
            let shouldSave = false;
            if (!user.facebookId && facebookId) {
                user.facebookId = facebookId;
                shouldSave = true;
            }
            if (!user.avatar && avatar) {
                user.avatar = avatar;
                shouldSave = true;
            }
            if (!user.search) {
                user.search = slugify(`${user.fullName} ${user.email} ${user.phone || ""}`, {
                    replacement: " ",
                    lower: true
                });
                shouldSave = true;
            }

            if (shouldSave) {
                await user.save();
            }

            return respondWithToken(res, user);
        }

        const search = slugify(`${fullName} ${email}`, {
            replacement: " ",
            lower: true
        });

        user = new AccountUser({
            facebookId: facebookId,
            fullName: fullName,
            email: email,
            avatar: avatar,
            search: search,
            status: "active"
        });

        await user.save();
        return respondWithToken(res, user);
    } catch (error) {
        return res.json({
            success: false,
            message: "Đăng nhập Facebook thất bại!"
        });
    }
}

// [GET] /api/v1/client/auth/me
export const getMe = async (req: Request, res: Response) => {
    try {
        const user = res.locals.accountUser;
        if (!user) {
            return res.json({
                success: false,
                message: "Không tìm thấy người dùng!"
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                totalPoint: user.totalPoint || 0,
                usedPoint: user.usedPoint || 0
            }
        });
    } catch (error) {
        res.json({
            success: false,
            message: "Lỗi hệ thống!"
        });
    }
}
