import express from "express";
import authRoutes from "../auth/auth.routes.js";
import taskRoutes from "../tasks/task.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/tasks", taskRoutes);
export default router;
