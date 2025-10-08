import { Router } from "express";
import authRoute from "./_auth.js";
import cartRoute from "./_cart.js";
import userRoute from "./_user.js";
import productRoute from "./_product.js";
import orderRoute from "./_order.js";
import paymentRoute from "./_payment.js";

const router = Router();

router.use("/auth", authRoute);
router.use("/carts", cartRoute);
router.use("/users", userRoute);
router.use("/products", productRoute);
router.use("/orders", orderRoute);
router.use("/payments", paymentRoute);

export default router;