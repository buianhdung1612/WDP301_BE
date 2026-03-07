import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AccountAdmin from "../../models/account-admin.model";
import Role from "../../models/role.model";
import { permissionList } from "../../configs/variable.config";

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.tokenAdmin || req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                code: 401,
                message: "Vui lòng đăng nhập!"
            });
        }

        const decoded: any = jwt.verify(token, `${process.env.JWT_SECRET}`);

        // Handle Super Admin from .env
        if (decoded.id === process.env.SUPER_ADMIN_ID && decoded.email === process.env.SUPER_ADMIN_EMAIL) {
            const superAdmin = {
                _id: process.env.SUPER_ADMIN_ID,
                fullName: "Super Admin",
                email: process.env.SUPER_ADMIN_EMAIL,
                avatar: "/admin/assets/images/users/avatar-1.jpg",
                isSuperAdmin: true,
                roles: []
            };

            const permissions = permissionList.map(item => item.id);

            res.locals.accountAdmin = superAdmin;
            res.locals.permissions = permissions;

            (req as any).user = {
                id: superAdmin._id,
                email: superAdmin.email,
                fullName: superAdmin.fullName,
                permissions: permissions,
                isSuperAdmin: true
            };

            return next();
        }

        const admin: any = await AccountAdmin.findOne({
            _id: decoded.id,
            deleted: false,
            status: "active"
        }).select("-password").populate("roles");

        if (!admin) {
            return res.status(401).json({
                code: 401,
                message: "Tài khoản không tồn tại hoặc đã bị khóa!"
            });
        }

        // Extract and flatten permissions from all roles
        let permissions: string[] = [];
        if (admin.roles && admin.roles.length > 0) {
            admin.roles.forEach((role: any) => {
                if (role.permissions && role.permissions.length > 0) {
                    permissions = [...permissions, ...role.permissions];
                }
            });
        }

        // Remove duplicates
        permissions = [...new Set(permissions)];

        // Store in res.locals and also in req for easy access
        res.locals.accountAdmin = admin;
        res.locals.permissions = permissions;

        (req as any).user = {
            id: admin._id,
            email: admin.email,
            fullName: admin.fullName,
            roles: admin.roles,
            permissions: permissions
        };

        next();
    } catch (error) {
        return res.status(401).json({
            code: 401,
            message: "Phiên đăng nhập hết hạn!"
        });
    }
}

export const checkPermission = (permission: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const permissions = res.locals.permissions || [];

        if (permissions.includes(permission)) {
            next();
        } else {
            res.status(403).json({
                code: 403,
                message: "Bạn không có quyền thực hiện hành động này!"
            });
        }
    }
}
