import TaskRepository from "../repositories/task.repository.js";
import { NotFoundError } from "../errors/AppError.js";
import { toTaskResponse } from "../mappers/task.mapper.js";
import type {
  CreateTaskInput,
  TaskResponseDTO,
  UpdateTaskInput,
} from "../types/task.type.js";

export class TaskService {
  readonly #taskRepository: TaskRepository;

  constructor(taskRepository: TaskRepository) {
    this.#taskRepository = taskRepository;
  }

  async createTask(
    userId: string,
    inputData: CreateTaskInput,
  ): Promise<TaskResponseDTO> {
    const task = await this.#taskRepository.create({
      userId,
      title: inputData.title,
      description: inputData.description,
      dueDate: inputData.dueDate,
    });
    return toTaskResponse(task);
  }

  async getTasks(userId: string): Promise<TaskResponseDTO[]> {
    const tasks = await this.#taskRepository.findAllByUser(userId);
    return tasks.map(toTaskResponse);
  }

  async getTask(userId: string, taskId: string): Promise<TaskResponseDTO> {
    const task = await this.#taskRepository.findByIdForUser(taskId, userId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }
    return toTaskResponse(task);
  }

  async updateTask(
    userId: string,
    taskId: string,
    inputData: UpdateTaskInput,
  ): Promise<TaskResponseDTO> {
    const task = await this.#taskRepository.updateByIdForUser(taskId, userId, {
      title: inputData.title,
      description: inputData.description,
      dueDate: inputData.dueDate,
    });
    if (!task) {
      throw new NotFoundError("Task not found");
    }
    return toTaskResponse(task);
  }

  // Only the owner can delete. Someone else's task gives the same 404 as a
  // missing one, so other users' task ids are not revealed.
  async deleteTask(userId: string, taskId: string): Promise<void> {
    const deleted = await this.#taskRepository.deleteByIdForUser(
      taskId,
      userId,
    );
    if (!deleted) {
      throw new NotFoundError("Task not found");
    }
  }
}
const taskService = new TaskService(new TaskRepository());
export default taskService;
