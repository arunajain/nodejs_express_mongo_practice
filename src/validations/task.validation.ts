import { z } from "zod";

const title = z
  .string("Title is required")
  .trim()
  .min(1, "Title is required")
  .max(200, "Title must not exceed 200 characters");

const description = z
  .string("Description must be a string")
  .trim()
  .max(2000, "Description must not exceed 2000 characters");

const dueDate = z.coerce.date("Due date must be a valid date");

export const createTaskSchema = z.object({
  title,
  description: description.optional(),
  dueDate: dueDate.optional(),
});

// Every field is optional; `null` clears description / dueDate.
export const updateTaskSchema = z
  .object({
    title: title.optional(),
    description: description.nullable().optional(),
    dueDate: dueDate.nullable().optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one field must be provided",
  );

export const taskIdParamSchema = z.object({
  id: z
    .string("Task id is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid task id"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
