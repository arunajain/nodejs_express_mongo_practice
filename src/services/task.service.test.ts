/**
 * Unit tests for TaskService.
 *
 * What we MOCK (and why):
 *  - TaskRepository -> talks to MongoDB. Injected through the constructor,
 *                      so we pass a fake object (no module mocking needed).
 *
 * What we keep REAL (and why):
 *  - task.mapper -> pure functions. Using them for real proves the service
 *                   returns the public DTO, not the domain model.
 *  - AppError    -> we want to assert the real NotFoundError is thrown.
 *
 * Ownership itself (filtering by userId) is enforced in the repository query,
 * so here we check the service always passes the caller's userId through.
 * The integration tests prove the query really filters.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { TaskService } from "../services/task.service.js";
import { NotFoundError } from "../errors/AppError.js";
import type TaskRepository from "../repositories/task.repository.js";
import type { Task } from "../types/task.type.js";

function createTaskRepositoryMock() {
  return {
    create: jest.fn<TaskRepository["create"]>(),
    findAllByUser: jest.fn<TaskRepository["findAllByUser"]>(),
    findByIdForUser: jest.fn<TaskRepository["findByIdForUser"]>(),
    updateByIdForUser: jest.fn<TaskRepository["updateByIdForUser"]>(),
    deleteByIdForUser: jest.fn<TaskRepository["deleteByIdForUser"]>(),
  } satisfies TaskRepository;
}

const USER_ID = "6721f0c2a1b2c3d4e5f60001";
const TASK_ID = "6721f0c2a1b2c3d4e5f60aaa";

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: TASK_ID,
    userId: USER_ID,
    title: "Buy milk",
    description: null,
    dueDate: null,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("TaskService", () => {
  let taskRepository: ReturnType<typeof createTaskRepositoryMock>;
  let taskService: TaskService;

  beforeEach(() => {
    taskRepository = createTaskRepositoryMock();
    taskService = new TaskService(taskRepository);
  });

  // -------------------------------------------------------------------------
  describe("createTask", () => {
    it("creates the task for the given user", async () => {
      const dueDate = new Date("2026-12-01T00:00:00.000Z");
      taskRepository.create.mockResolvedValue(buildTask());

      await taskService.createTask(USER_ID, {
        title: "Buy milk",
        description: "2 litres",
        dueDate,
      });

      expect(taskRepository.create).toHaveBeenCalledWith({
        userId: USER_ID,
        title: "Buy milk",
        description: "2 litres",
        dueDate,
      });
    });

    it("returns the public DTO without userId", async () => {
      taskRepository.create.mockResolvedValue(
        buildTask({ dueDate: new Date("2026-12-01T00:00:00.000Z") }),
      );

      const result = await taskService.createTask(USER_ID, {
        title: "Buy milk",
      });

      expect(result).toEqual({
        id: TASK_ID,
        title: "Buy milk",
        description: null,
        dueDate: "2026-12-01T00:00:00.000Z",
        createdAt: "2026-10-01T10:00:00.000Z",
        updatedAt: "2026-10-01T10:00:00.000Z",
      });
      expect(result).not.toHaveProperty("userId");
    });

    it("propagates repository errors", async () => {
      taskRepository.create.mockRejectedValue(new Error("Mongo unavailable"));

      await expect(
        taskService.createTask(USER_ID, { title: "Buy milk" }),
      ).rejects.toThrow("Mongo unavailable");
    });
  });

  // -------------------------------------------------------------------------
  describe("getTasks", () => {
    it("returns only the caller's tasks as DTOs", async () => {
      taskRepository.findAllByUser.mockResolvedValue([
        buildTask({ id: "a".repeat(24), title: "First" }),
        buildTask({ id: "b".repeat(24), title: "Second" }),
      ]);

      const result = await taskService.getTasks(USER_ID);

      expect(taskRepository.findAllByUser).toHaveBeenCalledWith(USER_ID);
      expect(result.map((task) => task.title)).toEqual(["First", "Second"]);
      expect(result[0]).not.toHaveProperty("userId");
    });

    it("returns an empty list when the user has no tasks", async () => {
      taskRepository.findAllByUser.mockResolvedValue([]);

      await expect(taskService.getTasks(USER_ID)).resolves.toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe("getTask", () => {
    it("looks up the task scoped to the caller", async () => {
      taskRepository.findByIdForUser.mockResolvedValue(buildTask());

      const result = await taskService.getTask(USER_ID, TASK_ID);

      expect(taskRepository.findByIdForUser).toHaveBeenCalledWith(
        TASK_ID,
        USER_ID,
      );
      expect(result.id).toBe(TASK_ID);
    });

    it("throws NotFoundError when the task is missing or not owned by the caller", async () => {
      taskRepository.findByIdForUser.mockResolvedValue(null);

      const promise = taskService.getTask(USER_ID, TASK_ID);

      await expect(promise).rejects.toBeInstanceOf(NotFoundError);
      await expect(promise).rejects.toThrow("Task not found");
    });
  });

  // -------------------------------------------------------------------------
  describe("updateTask", () => {
    it("passes the changes and the caller's userId to the repository", async () => {
      taskRepository.updateByIdForUser.mockResolvedValue(
        buildTask({ title: "New title" }),
      );

      const result = await taskService.updateTask(USER_ID, TASK_ID, {
        title: "New title",
        description: null,
      });

      expect(taskRepository.updateByIdForUser).toHaveBeenCalledWith(
        TASK_ID,
        USER_ID,
        { title: "New title", description: null, dueDate: undefined },
      );
      expect(result.title).toBe("New title");
    });

    it("throws NotFoundError when the task is missing or not owned by the caller", async () => {
      taskRepository.updateByIdForUser.mockResolvedValue(null);

      await expect(
        taskService.updateTask(USER_ID, TASK_ID, { title: "x" }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // -------------------------------------------------------------------------
  describe("deleteTask", () => {
    it("deletes the task scoped to the caller", async () => {
      taskRepository.deleteByIdForUser.mockResolvedValue(true);

      await expect(
        taskService.deleteTask(USER_ID, TASK_ID),
      ).resolves.toBeUndefined();
      expect(taskRepository.deleteByIdForUser).toHaveBeenCalledWith(
        TASK_ID,
        USER_ID,
      );
    });

    it("throws NotFoundError when nothing was deleted (missing or someone else's task)", async () => {
      taskRepository.deleteByIdForUser.mockResolvedValue(false);

      const promise = taskService.deleteTask(USER_ID, TASK_ID);

      await expect(promise).rejects.toBeInstanceOf(NotFoundError);
      await expect(promise).rejects.toThrow("Task not found");
    });
  });
});
