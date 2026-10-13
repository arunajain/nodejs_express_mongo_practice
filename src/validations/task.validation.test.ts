/**
 * Unit tests for the task zod schemas.
 * `safeParse` returns { success, data | error } instead of throwing,
 * which keeps the assertions short.
 */
import { describe, it, expect } from "@jest/globals";
import type { ZodError } from "zod";
import {
  createTaskSchema,
  updateTaskSchema,
  taskIdParamSchema,
} from "./task.validation.js";

// Collects all error messages from a failed parse
const messagesOf = (error: ZodError | undefined) =>
  error?.issues.map((issue) => issue.message) ?? [];

describe("createTaskSchema", () => {
  it("accepts a title only", () => {
    const result = createTaskSchema.safeParse({ title: "Buy milk" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: "Buy milk" });
  });

  it("trims the title and description", () => {
    const result = createTaskSchema.safeParse({
      title: "  Buy milk  ",
      description: "  2 litres ",
    });

    expect(result.data).toEqual({ title: "Buy milk", description: "2 litres" });
  });

  it("converts a dueDate string into a Date", () => {
    const result = createTaskSchema.safeParse({
      title: "Buy milk",
      dueDate: "2026-12-01",
    });

    expect(result.data?.dueDate).toEqual(new Date("2026-12-01"));
  });

  it.each([
    [{}, "Title is required"],
    [{ title: "" }, "Title is required"],
    [{ title: "   " }, "Title is required"],
    [{ title: "a".repeat(201) }, "Title must not exceed 200 characters"],
    [
      { title: "x", description: "a".repeat(2001) },
      "Description must not exceed 2000 characters",
    ],
    [{ title: "x", dueDate: "not-a-date" }, "Due date must be a valid date"],
  ])("rejects %j with %p", (input, message) => {
    const result = createTaskSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(messagesOf(result.error)).toContain(message);
  });

  it("does not accept null for description on create", () => {
    const result = createTaskSchema.safeParse({
      title: "x",
      description: null,
    });

    expect(result.success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  it("accepts a single field", () => {
    const result = updateTaskSchema.safeParse({ title: "New title" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: "New title" });
  });

  it("accepts null to clear description and dueDate", () => {
    const result = updateTaskSchema.safeParse({
      description: null,
      dueDate: null,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ description: null, dueDate: null });
  });

  it("rejects an empty body", () => {
    const result = updateTaskSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(messagesOf(result.error)).toContain(
      "At least one field must be provided",
    );
  });

  it("rejects an empty title", () => {
    const result = updateTaskSchema.safeParse({ title: "" });

    expect(result.success).toBe(false);
  });

  it("does not accept null for the title", () => {
    const result = updateTaskSchema.safeParse({ title: null });

    expect(result.success).toBe(false);
  });
});

describe("taskIdParamSchema", () => {
  it("accepts a 24-character hex ObjectId", () => {
    const result = taskIdParamSchema.safeParse({
      id: "6721f0c2a1b2c3d4e5f60718",
    });

    expect(result.success).toBe(true);
  });

  it.each(["abc", "6721f0c2a1b2c3d4e5f6071", "zzzzzzzzzzzzzzzzzzzzzzzz"])(
    "rejects %p",
    (id) => {
      const result = taskIdParamSchema.safeParse({ id });

      expect(result.success).toBe(false);
      expect(messagesOf(result.error)).toContain("Invalid task id");
    },
  );
});
