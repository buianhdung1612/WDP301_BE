import express, { Request, Response } from "express";
import Pet from "../../models/pet.model";

// [GET] /api/v1/admin/pets
export const listPets = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const userId = req.query.userId as string;

        let filter: any = { deleted: false };
        if (userId) {
            filter.userId = userId;
        }

        const pets = await Pet.find(filter)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Pet.countDocuments(filter);

        res.json({
            code: 200,
            message: "Danh sách thú cưng",
            data: pets,
            pagination: {
                currentPage: page,
                limit,
                total,
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách thú cưng"
        });
    }
};

// [POST] /api/v1/admin/pets/create
export const createPet = async (req: Request, res: Response) => {
    try {
        const { userId, name, type, breed, weight, age, color, avatar, gender, notes } = req.body;

        if (!userId) {
            return res.status(400).json({
                code: 400,
                message: "UserId là bắt buộc"
            });
        }

        const newPet = new Pet({
            userId,
            name,
            type,
            breed,
            weight,
            age,
            color,
            avatar,
            gender,
            notes,
            healthStatus: "accepted",
            status: "active"
        });

        await newPet.save();

        res.json({
            code: 201,
            message: "Tạo thú cưng thành công",
            data: newPet
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi tạo thú cưng"
        });
    }
};

// [GET] /api/v1/admin/pets/:id
export const getPet = async (req: Request, res: Response) => {
    try {
        const pet = await Pet.findById(req.params.id);

        if (!pet || pet.deleted) {
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

// [PATCH] /api/v1/admin/pets/:id
export const updatePet = async (req: Request, res: Response) => {
    try {
        const { name, type, breed, weight, age, color, avatar, gender, healthStatus, notes } = req.body;
        const pet = await Pet.findById(req.params.id);

        if (!pet || pet.deleted) {
            return res.status(404).json({
                code: 404,
                message: "Thú cưng không tồn tại"
            });
        }

        if (name !== undefined) pet.name = name;
        if (type !== undefined) pet.type = type;
        if (breed !== undefined) pet.breed = breed;
        if (weight !== undefined) pet.weight = weight;
        if (age !== undefined) pet.age = age;
        if (color !== undefined) pet.color = color;
        if (avatar !== undefined) pet.avatar = avatar;
        if (gender !== undefined) pet.gender = gender;
        if (healthStatus !== undefined) pet.healthStatus = healthStatus;
        if (notes !== undefined) pet.notes = notes;

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

// [DELETE] /api/v1/admin/pets/:id
export const deletePet = async (req: Request, res: Response) => {
    try {
        const pet = await Pet.findById(req.params.id);

        if (!pet || pet.deleted) {
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
