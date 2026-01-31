import { Request, Response } from "express";
import BoardingCage from "../../models/boarding-cage.model";

/**
 * CREATE cage (admin)
 */
export const createBoardingCage = async (req: Request, res: Response): Promise<void> => {
  try {
    const cage = await BoardingCage.create(req.body);
    res.status(201).json(cage);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(400).json({ message: "Create cage failed" });
    }
  }
};

/**
 * GET all cages (admin / client)
 */
export const getAllBoardingCages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, type, size } = req.query;

    const filter: { deleted: boolean; status?: string; type?: string; size?: string } = {
      deleted: false,
    };

    if (typeof status === 'string') filter.status = status;
    if (typeof type === 'string') filter.type = type;
    if (typeof size === 'string') filter.size = size;

    const cages = await BoardingCage.find(filter).sort({ createdAt: -1 });
    res.json(cages);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Get cages failed" });
    }
  }
};

/**
 * GET available cages (client)
 */
export const listAvailableCages = async (req: Request, res: Response): Promise<void> => {
  try {
    const cages = await BoardingCage.find({
      deleted: false,
      status: "available",
    });

    res.json(cages);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Get available cages failed" });
    }
  }
};

/**
 * UPDATE cage status
 */
export const updateCageStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const cage = await BoardingCage.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!cage) {
      res.status(404).json({ message: "Cage not found" });
      return;
    }

    res.json(cage);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(400).json({ message: "Update cage failed" });
    }
  }
};

/**
 * SOFT DELETE cage
 */
export const deleteBoardingCage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await BoardingCage.findByIdAndUpdate(id, {
      deleted: true,
      deletedAt: new Date(),
    });

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(400).json({ message: "Delete failed" });
    }
  }
};
