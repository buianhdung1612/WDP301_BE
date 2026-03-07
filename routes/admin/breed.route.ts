import { Router } from "express";
import * as controller from "../../controllers/admin/breed.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get("/", checkPermission("breed_view"), controller.listBreeds);
router.post("/create", checkPermission("breed_create"), controller.createBreed);
router.patch("/:id", checkPermission("breed_edit"), controller.updateBreed);
router.delete("/:id", checkPermission("breed_delete"), controller.deleteBreed);

export default router;
