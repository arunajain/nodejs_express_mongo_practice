import type { Task, TaskRecord, TaskResponseDTO } from "../types/task.type.js";

// DB record -> domain model (used by the repository)
export function toTask(record: TaskRecord): Task {
  return {
    id: record._id.toString(),
    userId: record.userId.toString(),
    title: record.title,
    description: record.description ?? null,
    dueDate: record.due_date ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// Domain model -> API response (used by the service)
export function toTaskResponse(task: Task): TaskResponseDTO {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
