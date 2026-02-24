import { Request, Response } from "express";
import mongoose from "mongoose";
import Pet from "../../models/pet.model";

const getCurrentUserId = (res: Response) => {
    const accountUser = res.locals.accountUser;
    const rawId = accountUser?._id || accountUser?.id;
    return rawId ? String(rawId) : "";
};

const normalizeHealthStatus = (value: string | undefined) => {
    if (!value) return "accepted";
    const v = value.toLowerCase();
    if (v === "healthy" || v === "accepted") return "accepted";
    if (v === "sick" || v === "rejected") return "rejected";
    return "accepted";
};

const getParamId = (value: string | string[] | undefined) => {
    if (!value) return "";
    return Array.isArray(value) ? value[0] : value;
};

// [GET] /api/v1/client/pet/my-pets
export const listMyPets = async (req: Request, res: Response) => {
    try {
        const userId = getCurrentUserId(res);
        if (!userId) {
            return res.status(401).json({
                code: 401,
                message: "Vui lòng đăng nhập"
            });
        }

        const pets = await Pet.find({
            userId,
            deleted: false
        }).sort({ createdAt: -1 });

        return res.json({
            code: 200,
            message: "Danh sách thú cưng của tôi",
            data: pets
        });
    } catch (error) {
        return res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách thú cưng"
        });
    }
};

// [GET] /api/v1/client/pet/my-pets/:id
export const getMyPet = async (req: Request, res: Response) => {
    try {
        const userId = getCurrentUserId(res);
        if (!userId) {
            return res.status(401).json({
                code: 401,
                message: "Vui lòng đăng nhập"
            });
        }

        const id = getParamId(req.params.id);
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                message: "ID thú cưng không hợp lệ"
            });
        }

        const pet = await Pet.findById(id);

        if (!pet || pet.deleted || String(pet.userId) !== userId) {
            return res.status(404).json({
                code: 404,
                message: "Thú cưng không tồn tại"
            });
        }

        return res.json({
            code: 200,
            message: "Chi tiết thú cưng",
            data: pet
        });
    } catch (error) {
        return res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy chi tiết thú cưng"
        });
    }
};

// [POST] /api/v1/client/pet/my-pets
export const createPet = async (req: Request, res: Response) => {
    try {
        const userId = getCurrentUserId(res);
        if (!userId) {
            return res.status(401).json({
                code: 401,
                message: "Vui lòng đăng nhập"
            });
        }

        const { name, type, breed, weight, age, color, gender, notes, healthStatus, avatar } = req.body;

        if (!name || !type) {
            return res.status(400).json({
                code: 400,
                message: "Thiếu thông tin bắt buộc"
            });
        }

        const newPet = await Pet.create({
            userId,
            name,
            type,
            breed,
            weight,
            age,
            color,
            gender,
            notes,
            status: "active",
            healthStatus: normalizeHealthStatus(healthStatus),
            avatar
        });

        return res.status(201).json({
            code: 201,
            message: "Thêm thú cưng thành công",
            data: newPet
        });
    } catch (error) {
        return res.status(500).json({
            code: 500,
            message: "Lỗi khi thêm thú cưng"
        });
    }
};

// [PATCH] /api/v1/client/pet/my-pets/:id
export const updateMyPet = async (req: Request, res: Response) => {
    try {
        const userId = getCurrentUserId(res);
        if (!userId) {
            return res.status(401).json({
                code: 401,
                message: "Vui lòng đăng nhập"
            });
        }

        const id = getParamId(req.params.id);
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                message: "ID thú cưng không hợp lệ"
            });
        }

        const pet = await Pet.findById(id);

        if (!pet || pet.deleted || String(pet.userId) !== userId) {
            return res.status(404).json({
                code: 404,
                message: "Thú cưng không tồn tại"
            });
        }

        if (req.body.healthStatus) {
            req.body.healthStatus = normalizeHealthStatus(req.body.healthStatus);
        }

        Object.assign(pet, req.body);
        await pet.save();

        return res.json({
            code: 200,
            message: "Cập nhật thú cưng thành công",
            data: pet
        });
    } catch (error) {
        return res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật thú cưng"
        });
    }
};

// [DELETE] /api/v1/client/pet/my-pets/:id
export const deleteMyPet = async (req: Request, res: Response) => {
    try {
        const userId = getCurrentUserId(res);
        if (!userId) {
            return res.status(401).json({
                code: 401,
                message: "Vui lòng đăng nhập"
            });
        }

        const id = getParamId(req.params.id);
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                message: "ID thú cưng không hợp lệ"
            });
        }

        const pet = await Pet.findById(id);

        if (!pet || pet.deleted || String(pet.userId) !== userId) {
            return res.status(404).json({
                code: 404,
                message: "Thú cưng không tồn tại"
            });
        }

        pet.deleted = true;
        pet.deletedAt = new Date();
        await pet.save();

        return res.json({
            code: 200,
            message: "Xóa thú cưng thành công"
        });
    } catch (error) {
        return res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa thú cưng"
        });
    }
};
