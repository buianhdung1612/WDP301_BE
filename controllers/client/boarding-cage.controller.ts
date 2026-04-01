import { Request, Response } from "express";
import mongoose from "mongoose";
import dayjs from "dayjs";
import BoardingCage from "../../models/boarding-cage.model";
import BoardingBooking from "../../models/boarding-booking.model";
import BoardingCageReview from "../../models/boarding-cage-review.model";

const MAX_ROOMS_PER_CAGE = Math.max(1, Number(process.env.BOARDING_CAGE_CAPACITY || 4));

const releaseExpiredHolds = async () => {
  const now = new Date();
  await BoardingBooking.updateMany(
    {
      deleted: false,
      boardingStatus: "held",
      holdExpiresAt: { $lte: now }
    },
    {
      $set: {
        boardingStatus: "cancelled",
        cancelledAt: now,
        cancelledReason: "Het thoi gian giu phong",
        cancelledBy: "system"
      }
    }
  );
};

const legacySizeMap: Record<string, string> = {
  C: "S",
  B: "M",
  A: "L",
  XL: "XL_XXL",
  XXL: "XL_XXL",
};

const sizeQueryMap: Record<string, string[]> = {
  S: ["S", "C"],
  M: ["M", "B"],
  L: ["L", "A"],
  XL_XXL: ["XL_XXL", "XL", "XXL"],
};

const normalizeCageSize = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const raw = value.trim().toUpperCase();
  if (!raw) return undefined;
  return legacySizeMap[raw] || raw;
};

const buildSizeFilter = (value: unknown) => {
  const normalized = normalizeCageSize(value);
  if (!normalized) return undefined;
  const matched = sizeQueryMap[normalized] || [normalized];
  return { $in: matched };
};

const getBookingQuantity = (booking: any): number => {
  const quantity = Number(booking?.quantity || 0);
  if (Number.isFinite(quantity) && quantity > 0) return Math.round(quantity);
  if (Array.isArray(booking?.petIds) && booking.petIds.length > 0) return booking.petIds.length;
  return 1;
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

    const filter: any = {
      deleted: false,
    };

    if (typeof status === "string") filter.status = status;
    if (typeof type === "string") filter.type = type;
    if (typeof size === "string") {
      const sizeFilter = buildSizeFilter(size);
      if (sizeFilter) filter.size = sizeFilter;
    }

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

    const start = dayjs(checkInDate as string).hour(9).minute(0).second(0).millisecond(0).toDate();
    const end = dayjs(checkOutDate as string).hour(9).minute(0).second(0).millisecond(0).toDate();

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
      boardingStatus: { $in: ["confirmed", "checked-in"] },
      checkOutDate: { $lt: now }
    });

    for (const booking of expiredBookings) {
      if (booking.boardingStatus === "checked-in") {
        booking.boardingStatus = "checked-out";
        booking.actualCheckOutDate = now;
      } else {
        booking.boardingStatus = "cancelled";
        booking.cancelledAt = now;
        booking.cancelledReason = "Het han dat";
        booking.cancelledBy = "system";
      }
      await booking.save();
      await BoardingCage.findByIdAndUpdate(booking.cageId, {
        status: "available"
      });
    }

    const overlappingBookings = await BoardingBooking.find({
      deleted: false,
      checkInDate: { $lt: end },
      checkOutDate: { $gt: start },
      $or: [
        { boardingStatus: { $in: ["pending", "confirmed", "checked-in"] } },
        { boardingStatus: "held", holdExpiresAt: { $gt: now } }
      ]
    }).select("cageId quantity petIds items petId").lean();

    const filter: any = {
      deleted: false,
      status: { $ne: "maintenance" }
    };

    if (typeof type === "string") filter.type = type;
    if (typeof size === "string") {
      const sizeFilter = buildSizeFilter(size);
      if (sizeFilter) filter.size = sizeFilter;
    }

    const cages = await BoardingCage.find(filter).lean();

    const bookedByCage = new Map<string, number>();
    for (const booking of overlappingBookings) {
      if (Array.isArray((booking as any).items) && (booking as any).items.length > 0) {
          (booking as any).items.forEach((item: any) => {
              const cageId = String(item.cageId?._id || item.cageId || "");
              if (cageId && mongoose.Types.ObjectId.isValid(cageId)) {
                  const itemQty = Array.isArray(item.petIds) ? item.petIds.length : (item.petId ? 1 : 1);
                  bookedByCage.set(cageId, (bookedByCage.get(cageId) || 0) + itemQty);
              }
          });
      } else {
          const cageId = String((booking as any).cageId?._id || (booking as any).cageId || "");
          if (cageId && mongoose.Types.ObjectId.isValid(cageId)) {
              const qty = getBookingQuantity(booking);
              bookedByCage.set(cageId, (bookedByCage.get(cageId) || 0) + qty);
          }
      }
    }

    const payload = cages.map((cage: any) => {
      const cageId = String(cage?._id || "");
      const bookedRooms = Math.max(0, Number(bookedByCage.get(cageId) || 0));
      const totalRooms = Number(cage.totalRooms || 4);
      const remainingRooms = Math.max(0, totalRooms - bookedRooms);
      return {
        ...cage,
        totalRooms,
        bookedRooms,
        remainingRooms,
        soldOut: remainingRooms <= 0
      };
    });

    res.json(payload);
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

export const listBoardingCageReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid cage id" });
      return;
    }

    const cage = await BoardingCage.findOne({ _id: id, deleted: false }).select("_id");
    if (!cage) {
      res.status(404).json({ message: "Cage not found" });
      return;
    }

    const reviews = await BoardingCageReview.find({
      cageId: id,
      deleted: false,
      status: "approved"
    })
      .sort({ createdAt: -1 })
      .select("fullName rating comment createdAt");

    const total = reviews.length;
    const averageRating =
      total > 0
        ? reviews.reduce((sum, item: any) => sum + Number(item.rating || 0), 0) / total
        : 0;

    res.json({
      reviews,
      total,
      averageRating
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Get boarding reviews failed" });
    }
  }
};

export const createBoardingCageReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = res.locals.accountUser;
    const userId = user?._id?.toString();
    const userFullName = String(user?.fullName || "").trim();
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { rating, comment, fullName } = req.body || {};

    if (!userId) {
      res.status(401).json({ message: "Vui long dang nhap" });
      return;
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid cage id" });
      return;
    }

    const cage = await BoardingCage.findOne({ _id: id, deleted: false }).select("_id");
    if (!cage) {
      res.status(404).json({ message: "Cage not found" });
      return;
    }

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      res.status(400).json({ message: "Rating must be from 1 to 5" });
      return;
    }

    const cleanComment = String(comment || "").trim();
    if (!cleanComment || cleanComment.length < 10) {
      res.status(400).json({ message: "Noi dung danh gia toi thieu 10 ky tu" });
      return;
    }

    const hasUsedThisCage = await BoardingBooking.exists({
      deleted: false,
      userId,
      cageId: id,
      boardingStatus: { $in: ["confirmed", "checked-in", "checked-out"] }
    });
    if (!hasUsedThisCage) {
      res.status(400).json({ message: "Ban chi co the danh gia chuong da tung dat" });
      return;
    }

    const review = await BoardingCageReview.create({
      cageId: id,
      userId,
      fullName: String(fullName || userFullName || "Khach hang").trim(),
      rating: Math.round(numericRating),
      comment: cleanComment,
      status: "approved"
    });

    res.status(201).json({
      message: "Danh gia thanh cong",
      data: review
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Create boarding review failed" });
    }
  }
};
