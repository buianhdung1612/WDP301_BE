import { Request, Response } from "express";
import mongoose from "mongoose";
import BoardingCage from "../../models/boarding-cage.model";
import BoardingBooking from "../../models/boarding-booking.model";

const releaseExpiredHolds = async () => {
  const now = new Date();
  await BoardingBooking.updateMany(
    {
      deleted: false,
      status: "held",
      holdExpiresAt: { $lte: now }
    },
    {
      $set: {
        status: "cancelled",
        cancelledAt: now,
        cancelledReason: "Het thoi gian giu phong",
        cancelledBy: "system"
      }
    }
  );
};

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

export const getAllBoardingCages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, type, size } = req.query;

    const filter: { deleted: boolean; status?: string; type?: string; size?: string } = {
      deleted: false,
    };

    if (typeof status === "string") filter.status = status;
    if (typeof type === "string") filter.type = type;
    if (typeof size === "string") filter.size = size;

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

export const getBoardingCageDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const cage = await BoardingCage.findOne({ _id: id, deleted: false });

    if (!cage) {
      res.status(404).json({ message: "Cage not found" });
      return;
    }

    res.json(cage);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Get cage detail failed" });
    }
  }
};

export const listAvailableCages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { checkInDate, checkOutDate, type, size } = req.query;

    if (!checkInDate || !checkOutDate) {
      res.status(400).json({ message: "Missing check-in or check-out date" });
      return;
    }

    const start = new Date(checkInDate as string);
    const end = new Date(checkOutDate as string);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      res.status(400).json({ message: "Invalid date format" });
      return;
    }

    if (end.getTime() <= start.getTime()) {
      res.status(400).json({ message: "Invalid date range" });
      return;
    }

    const now = new Date();
    await releaseExpiredHolds();

    const expiredBookings = await BoardingBooking.find({
      deleted: false,
      status: { $in: ["confirmed", "checked-in"] },
      checkOutDate: { $lt: now }
    });

    for (const booking of expiredBookings) {
      if (booking.status === "checked-in") {
        booking.status = "checked-out";
        booking.actualCheckOutDate = now;
      } else {
        booking.status = "cancelled";
        booking.cancelledAt = now;
        booking.cancelledReason = "Het han dat";
        booking.cancelledBy = "system";
      }
      await booking.save();
      await BoardingCage.findByIdAndUpdate(booking.cageId, {
        status: "available"
      });
    }

    const busyCageIds = await BoardingBooking.find({
      deleted: false,
      checkInDate: { $lt: end },
      checkOutDate: { $gt: start },
      $or: [
        { status: { $in: ["confirmed", "checked-in"] } },
        { status: "held", holdExpiresAt: { $gt: now } }
      ]
    }).distinct("cageId");

    const excludeIds = busyCageIds
      .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
      .map((id: string) => new mongoose.Types.ObjectId(id));

    const filter: any = {
      deleted: false,
      status: { $ne: "maintenance" },
      _id: { $nin: excludeIds }
    };

    if (typeof type === "string") filter.type = type;
    if (typeof size === "string") filter.size = size;

    const cages = await BoardingCage.find(filter);

    res.json(cages);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Get available cages failed" });
    }
  }
};

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
