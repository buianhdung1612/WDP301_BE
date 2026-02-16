import express, { Request, Response } from "express";
import Pet from "../../models/pet.model";

// [GET] /api/v1/client/my-pets
export const listMyPets = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser._id;

        const pets = await Pet.find({
            userId,
            deleted: false
        }).sort({ createdAt: -1 });

        res.json({
            code: 200,
            message: "Danh sách thú cưng của tôi",
            data: pets
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách thú cưng"
        });
    }
};


// [GET] /api/v1/client/my-pets/:id
export const getMyPet = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser._id;
        const pet = await Pet.findById(req.params.id);

        if (
            !pet ||
            pet.deleted ||
            !pet.userId.equals(userId)
        ) {
            return res.status(404).json({
                code: 404,
                message: "Thú cưng không tồn tại"
            });
        }

        res.json({
            code: 200,
            message: "Chi tiết thú cưng",
            data: pet
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy chi tiết thú cưng"
        });
    }
};


// [POST] /api/v1/client/my-pets
export const createPet = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser._id;
        const { name, type, breed, weight, age, color, gender, notes, healthStatus, avatar } = req.body;

        const normalizeHealthStatus = (value: string | undefined) => {
            if (!value) return "accepted";
            const v = value.toLowerCase();
            if (v === "healthy" || v === "accepted") return "accepted";
            if (v === "sick" || v === "rejected") return "rejected";
            return "accepted";
        };

        const newPet = new Pet({
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

        await newPet.save();
console.log("accountUser =", res.locals.accountUser);
console.log("userId =", res.locals.accountUser?._id);
        res.status(201).json({

            code: 201,
            message: "Thêm thú cưng thành công",
            data: newPet
        });
    } catch (error) {
        res.status(500).json({
            
            code: 500,
            message: "Lỗi khi thêm thú cưng"
        });
    }
};


// [PATCH] /api/v1/client/my-pets/:id
export const updateMyPet = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser._id;
        const pet = await Pet.findById(req.params.id);

        if (
            !pet ||
            pet.deleted ||
            !pet.userId.equals(userId)
        ) {
            return res.status(404).json({
                code: 404,
                message: "Thú cưng không tồn tại"
            });
        }

        Object.assign(pet, req.body);
        await pet.save();

        res.json({
            code: 200,
            message: "Cập nhật thú cưng thành công",
            data: pet
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật thú cưng"
        });
    }
};


// [DELETE] /api/v1/client/my-pets/:id
export const deleteMyPet = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.accountUser._id;
        const pet = await Pet.findById(req.params.id);

        if (
            !pet ||
            pet.deleted ||
            !pet.userId.equals(userId)
        ) {
            return res.status(404).json({
                code: 404,
                message: "Thú cưng không tồn tại"
            });
        }

        pet.deleted = true;
        pet.deletedAt = new Date();
        await pet.save();

        res.json({
            code: 200,
            message: "Xóa thú cưng thành công"
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa thú cưng"
        });
    }
};
