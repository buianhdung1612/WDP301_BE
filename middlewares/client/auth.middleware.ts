import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AccountUser from "../../models/account-user.model";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.tokenUser || req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.json({
                code: "error",
                message: "Vui lòng đăng nhập!"
            });
        }

        const decoded: any = jwt.verify(token, `${process.env.JWT_SECRET}`);
        const user = await AccountUser.findOne({
            _id: decoded.id,
            deleted: false,
            status: "active"
        }).select("-password");

        if (!user) {
            return res.json({
                code: "error",
                message: "Tài khoản không tồn tại hoặc đã bị khóa!"
            });
        }

        res.locals.accountUser = user;
        next();
    } catch (error) {
        return res.json({
            code: "error",
            message: "Phiên đăng nhập hết hạn!"
        });
    }
}

export const infoAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.tokenUser || req.headers.authorization?.split(" ")[1];

        if (token) {
            const decoded: any = jwt.verify(token, `${process.env.JWT_SECRET}`);
            const user = await AccountUser.findOne({
                _id: decoded.id,
                deleted: false,
                status: "active"
            }).select("-password");

            if (user) {
                res.locals.accountUser = user;
            }
        }
        next();
    } catch (error) {
        next();
    }
}

