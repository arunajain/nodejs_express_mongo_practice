import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskIdParam,
} from "../validations/task.validation.js";
import type { TaskRecord } from "../models/Task.js";

/**
 * Three shapes of a task, one per layer:
 *
 *  TaskRecord      -> what MongoDB stores (_id, ObjectId userId, due_date).
 *                     Repository only.
 *  Task            -> domain model used by the service layer. Plain strings
 *                     for ids, camelCase, null instead of undefined.
 *  TaskResponseDTO -> what the API returns to the frontend. No owner id,
 *                     dates as ISO strings.
 */

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskResponseDTO {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// Data the repository needs to create a task.
export interface NewTaskData {
  userId: string;
  title: string;
  description?: string | null | undefined;
  dueDate?: Date | null | undefined;
}

// Fields the repository may change; undefined = leave as is, null = clear.
export interface TaskChanges {
  title?: string | undefined;
  description?: string | null | undefined;
  dueDate?: Date | null | undefined;
}

export type { TaskRecord, CreateTaskInput, UpdateTaskInput, TaskIdParam };
