import express from "express";
import TaskController from "../controllers/task.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
const router = express.Router();

// Every task route needs a logged-in user
router.use(authenticate);

router.post("/", TaskController.create);
router.get("/", TaskController.getAll);
router.get("/:id", TaskController.getOne);
router.patch("/:id", TaskController.update);
router.delete("/:id", TaskController.delete);

export default router;
