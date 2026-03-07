import { Request, Response } from "express";
import Breed from "../../models/breed.model";

// [GET] /api/v1/admin/breeds
export const listBreeds = async (req: Request, res: Response) => {
    try {
        const type = req.query.type as string;
        let filter: any = {};

        if (type) {
            filter.type = type;
        }

        const breeds = await Breed.find(filter).sort({ name: 1 });

        res.json({
            code: 200,
            message: "Danh sách giống thú cưng",
            data: breeds
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách giống"
        });
    }
};

// [POST] /api/v1/admin/breeds/create
export const createBreed = async (req: Request, res: Response) => {
    try {
        const { name, type, description } = req.body;

        const existingBreed = await Breed.findOne({ name, type });
        if (existingBreed) {
            return res.status(400).json({
                code: 400,
                message: "Giống này đã tồn tại"
            });
        }

        const newBreed = new Breed({
            name,
            type,
            description
        });

        await newBreed.save();

        res.json({
            code: 201,
            message: "Tạo giống thành công",
            data: newBreed
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi tạo giống"
        });
    }
};

// [PATCH] /api/v1/admin/breeds/:id
export const updateBreed = async (req: Request, res: Response) => {
    try {
        const { name, type, description } = req.body;
        const breed = await Breed.findById(req.params.id);

        if (!breed) {
            return res.status(404).json({
                code: 404,
                message: "Giống thú cưng không tồn tại"
            });
        }

        if (name) breed.name = name;
        if (type) breed.type = type;
        if (description) breed.description = description;

        await breed.save();

        res.json({
            code: 200,
            message: "Cập nhật giống thú cưng thành công",
            data: breed
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật giống"
        });
    }
};

// [DELETE] /api/v1/admin/breeds/:id
export const deleteBreed = async (req: Request, res: Response) => {
    try {
        const breed = await Breed.findByIdAndDelete(req.params.id);

        if (!breed) {
            return res.status(404).json({
                code: 404,
                message: "Giống thú cưng không tồn tại"
            });
        }

        res.json({
            code: 200,
            message: "Xóa giống thú cưng thành công"
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa giống"
        });
    }
};
