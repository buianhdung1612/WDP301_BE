import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AccountAdmin from "../../models/account-admin.model";
import { permissionList } from "../../configs/variable.config";

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.tokenAdmin || req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                code: 401,
                message: "Vui long dang nhap!",
            });
        }

        const decoded: any = jwt.verify(token, `${process.env.JWT_SECRET}`);

        if (decoded.id === process.env.SUPER_ADMIN_ID && decoded.email === process.env.SUPER_ADMIN_EMAIL) {
            const superAdmin = {
                _id: process.env.SUPER_ADMIN_ID,
                fullName: "Super Admin",
                email: process.env.SUPER_ADMIN_EMAIL,
                avatar: "/admin/assets/images/users/avatar-1.jpg",
                isSuperAdmin: true,
                roles: [],
            };

            const permissions = permissionList.map((item) => item.id);

            res.locals.accountAdmin = superAdmin;
            res.locals.permissions = permissions;

            (req as any).user = {
                id: superAdmin._id,
                email: superAdmin.email,
                fullName: superAdmin.fullName,
                permissions,
                isSuperAdmin: true,
            };

            return next();
        }

        const admin: any = await AccountAdmin.findOne({
            _id: decoded.id,
            deleted: false,
            status: "active",
        })
            .select("-password")
            .populate("roles");

        if (!admin) {
            return res.status(401).json({
                code: 401,
                message: "Tai khoan khong ton tai hoac da bi khoa!",
            });
        }

        let permissions: string[] = [];
        if (admin.roles && admin.roles.length > 0) {
            admin.roles.forEach((role: any) => {
                if (role.permissions && role.permissions.length > 0) {
                    permissions = [...permissions, ...role.permissions];
                }
            });
        }

        permissions = [...new Set(permissions)];

        res.locals.accountAdmin = admin;
        res.locals.permissions = permissions;

        (req as any).user = {
            id: admin._id,
            email: admin.email,
            fullName: admin.fullName,
            roles: admin.roles,
            permissions,
        };

        next();
    } catch (error) {
        return res.status(401).json({
            code: 401,
            message: "Phien dang nhap het han!",
        });
    }
};

export const checkPermission = (...requiredPermissions: string[]) => {
    return async (_req: Request, res: Response, next: NextFunction) => {
        const permissions = Array.isArray(res.locals.permissions) ? res.locals.permissions : [];
        const validRequiredPermissions = requiredPermissions.filter(Boolean);

        if (
            validRequiredPermissions.length > 0 &&
            validRequiredPermissions.some((permission) => permissions.includes(permission))
        ) {
            return next();
        }

        return res.status(403).json({
            code: 403,
            message: "Ban khong co quyen thuc hien hanh dong nay!",
        });
    };
};
