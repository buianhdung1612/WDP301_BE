import { Router } from "express";
import * as dashboardController from "../../controllers/client/dashboard.controller";
import * as authMiddleware from "../../middlewares/client/auth.middleware";
import * as dashboardValidate from "../../validates/client/dashboard.validate";

const router = Router();

router.use(authMiddleware.requireAuth);

router.patch("/profile/edit", dashboardValidate.profileEditPatch, dashboardController.profileEdit);

router.get("/address", dashboardController.address);

router.post("/address/create", dashboardValidate.addressCreatePost, dashboardController.addressCreatePost);

router.get("/address/detail/:id", dashboardController.addressDetail);

router.patch("/address/edit/:id", dashboardValidate.addressCreatePost, dashboardController.addressEditPatch);

router.delete("/address/delete/:id", dashboardController.addressDelete);

router.patch("/address/change-default/:id", dashboardController.addressChangeDefault);

router.patch("/change-password", dashboardValidate.changePasswordPatch, dashboardController.changePassword);

router.patch(
    '/profile/change-avatar',
    dashboardController.profileChangeAvatar
);

router.get('/order/list', dashboardController.orderList);

router.get('/order/detail/:id', dashboardController.orderDetail);

export default router;
