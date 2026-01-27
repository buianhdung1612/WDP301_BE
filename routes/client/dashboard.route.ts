import { Router } from "express";
import * as dashboardController from "../../controllers/client/dashboard.controller";
import * as authMiddleware from "../../middlewares/client/auth.middleware";
import * as dashboardValidate from "../../validates/client/dashboard.validate";

const router = Router();

router.use(authMiddleware.requireAuth);

// [PATCH] /api/v1/client/dashboard/profile/edit
router.patch("/profile/edit", dashboardValidate.profileEditPatch, dashboardController.profileEdit);

// [GET] /api/v1/client/dashboard/address
router.get("/address", dashboardController.address);

// [POST] /api/v1/client/dashboard/address/create
router.post("/address/create", dashboardValidate.addressCreatePost, dashboardController.addressCreatePost);

// [GET] /api/v1/client/dashboard/address/detail/:id
router.get("/address/detail/:id", dashboardController.addressDetail);

// [PATCH] /api/v1/client/dashboard/address/edit/:id
router.patch("/address/edit/:id", dashboardValidate.addressCreatePost, dashboardController.addressEditPatch);

// [DELETE] /api/v1/client/dashboard/address/delete/:id
router.delete("/address/delete/:id", dashboardController.addressDelete);

// [PATCH] /api/v1/client/dashboard/address/change-default/:id
router.patch("/address/change-default/:id", dashboardController.addressChangeDefault);

// [PATCH] /api/v1/client/dashboard/change-password
router.patch("/change-password", dashboardValidate.changePasswordPatch, dashboardController.changePassword);

export default router;
