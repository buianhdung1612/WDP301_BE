import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AccountAdmin from "../../models/account-admin.model";
import Role from "../../models/role.model";
import { permissionList } from "../../configs/variable.config";

// [POST] /api/v1/admin/auth/login
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Check for Super Admin from .env
        if (
            email === process.env.SUPER_ADMIN_EMAIL &&
            password === process.env.SUPER_ADMIN_PASSWORD
        ) {
            const token = jwt.sign(
                { id: process.env.SUPER_ADMIN_ID, email: process.env.SUPER_ADMIN_EMAIL },
                `${process.env.JWT_SECRET}`,
                { expiresIn: "10h" }
            );

            res.cookie("tokenAdmin", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 10 * 60 * 60 * 1000 // 10 hours
            });

            return res.json({
                code: 200,
                message: "Đăng nhập thành công (Super Admin)!",
                data: {
                    id: process.env.SUPER_ADMIN_ID,
                    fullName: "Super Admin",
                    email: process.env.SUPER_ADMIN_EMAIL,
                    avatar: "/admin/assets/images/users/avatar-1.jpg",
                    token: token,
                    permissions: permissionList.map(item => item.id) // Or a wildcard
                }
            });
        }

        const admin = await AccountAdmin.findOne({
            email,
            deleted: false
        }).populate("roles");

        if (!admin) {
            return res.status(400).json({
                code: 400,
                message: "Email không tồn tại!"
            });
        }

        if (admin.status === "inactive") {
            return res.status(400).json({
                code: 400,
                message: "Tài khoản đang bị khóa!"
            });
        }

        const isPasswordValid = await bcrypt.compare(password, admin.password || "");
        if (!isPasswordValid) {
            return res.status(400).json({
                code: 400,
                message: "Mật khẩu không chính xác!"
            });
        }

        const token = jwt.sign(
            { id: admin._id },
            `${process.env.JWT_SECRET}`,
            { expiresIn: "10h" }
        );

        res.cookie("tokenAdmin", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 10 * 60 * 60 * 1000 // 10 hours
        });

        // Calculate permissions for response
        let permissions: string[] = [];
        if (admin.roles) {
            admin.roles.forEach((role: any) => {
                if (role.permissions) {
                    permissions = [...permissions, ...role.permissions];
                }
            });
        }
        permissions = [...new Set(permissions)];

        res.json({
            code: 200,
            message: "Đăng nhập thành công!",
            data: {
                id: admin._id,
                fullName: admin.fullName,
                email: admin.email,
                avatar: admin.avatar,
                token: token,
                permissions: permissions,
                roles: admin.roles
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi hệ thống khi đăng nhập"
        });
    }
};

// [POST] /api/v1/admin/auth/logout
export const logout = async (req: Request, res: Response) => {
    res.clearCookie("tokenAdmin");
    res.json({
        code: 200,
        message: "Đăng xuất thành công!"
    });
};

// [GET] /api/v1/admin/auth/me
export const getMe = async (req: Request, res: Response) => {
    const admin = res.locals.accountAdmin;
    const permissions = res.locals.permissions;

    res.json({
        code: 200,
        data: {
            id: admin._id,
            fullName: admin.fullName,
            email: admin.email,
            avatar: admin.avatar,
            roles: admin.roles,
            permissions: permissions
        }
    });
};
