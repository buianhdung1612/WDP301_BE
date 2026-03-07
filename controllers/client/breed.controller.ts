import { Request, Response } from "express";
import Breed from "../../models/breed.model";

// [GET] /api/v1/client/breed
export const listBreeds = async (req: Request, res: Response) => {
    try {
        const type = req.query.type as string;
        const unique = req.query.unique === 'true';
        let filter: any = {};

        if (type) {
            filter.type = type;
        }

        if (unique) {
            const uniqueBreeds = await Breed.distinct("name", filter);
            return res.json({
                code: 200,
                message: "Danh sách giống thú cưng (unique)",
                data: uniqueBreeds.sort().map(name => ({ name }))
            });
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

// [POST] /api/v1/client/breed/create
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
