import { Request, Response } from "express";
import FoodTemplate from "../../models/food-template.model";
import ExerciseTemplate from "../../models/exercise-template.model";

export const getFoodTemplates = async (req: Request, res: Response) => {
    try {
        const { petType } = req.query;
        const filter: any = { deleted: false, isActive: true };
        if (petType && petType !== "all") {
            filter.petType = { $in: [petType, "all"] };
        }

        const items = await FoodTemplate.find(filter)
            .sort({ group: 1, name: 1 })
            .lean();

        return res.json({ code: 200, data: items });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message });
    }
};

export const getExerciseTemplates = async (req: Request, res: Response) => {
    try {
        const { petType } = req.query;
        const filter: any = { deleted: false, isActive: true };
        if (petType && petType !== "all") {
            filter.petType = { $in: [petType, "all"] };
        }

        const items = await ExerciseTemplate.find(filter)
            .sort({ intensity: 1, name: 1 })
            .lean();

        return res.json({ code: 200, data: items });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message });
    }
};
