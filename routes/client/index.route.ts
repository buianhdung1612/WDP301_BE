import { Router } from "express";
import bookingRoutes from "./booking.route";

const router = Router();

router.use('/', bookingRoutes);

export default router;