import type { Request, Response, NextFunction } from "express";
import {
  createTaskSchema,
  updateTaskSchema,
  taskIdParamSchema,
} from "../validations/task.validation.js";
import { getAuthUser } from "../middleware/auth.middleware.js";
import taskService from "../services/task.service.js";
class TaskController {
  static async create(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { userId } = getAuthUser(req);
      const inputData = createTaskSchema.parse(req.body);
      const task = await taskService.createTask(userId, inputData);
      res.status(201).json({ task });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { userId } = getAuthUser(req);
      const tasks = await taskService.getTasks(userId);
      res.status(200).json({ tasks });
    } catch (error) {
      next(error);
    }
  }

  static async getOne(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { userId } = getAuthUser(req);
      const { id } = taskIdParamSchema.parse(req.params);
      const task = await taskService.getTask(userId, id);
      res.status(200).json({ task });
    } catch (error) {
      next(error);
    }
  }

  static async update(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { userId } = getAuthUser(req);
      const { id } = taskIdParamSchema.parse(req.params);
      const inputData = updateTaskSchema.parse(req.body);
      const task = await taskService.updateTask(userId, id, inputData);
      res.status(200).json({ task });
    } catch (error) {
      next(error);
    }
  }

  static async delete(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { userId } = getAuthUser(req);
      const { id } = taskIdParamSchema.parse(req.params);
      await taskService.deleteTask(userId, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
export default TaskController;
