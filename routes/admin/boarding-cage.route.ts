import { Router } from "express";
import * as controller from "../../controllers/admin/boarding-cage.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get("/", checkPermission("boarding_cage_view"), controller.listBoardingCages);
router.post("/create", checkPermission("boarding_cage_create"), controller.createBoardingCage);
router.patch("/:id", checkPermission("boarding_cage_edit"), controller.updateBoardingCage);
router.delete("/:id", checkPermission("boarding_cage_delete"), controller.deleteBoardingCage);

export default router;
