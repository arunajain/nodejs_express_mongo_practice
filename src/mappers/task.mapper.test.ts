/**
 * Unit tests for the task mappers.
 * Pure functions, so nothing is mocked.
 */
import { describe, it, expect } from "@jest/globals";
import { Types } from "mongoose";
import { toTask, toTaskResponse } from "../mappers/task.mapper.js";
import type { Task, TaskRecord } from "../types/task.type.js";

const taskId = new Types.ObjectId();
const userId = new Types.ObjectId();
const createdAt = new Date("2026-10-01T10:00:00.000Z");
const updatedAt = new Date("2026-10-02T10:00:00.000Z");
const dueDate = new Date("2026-12-01T00:00:00.000Z");

function buildRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    _id: taskId,
    userId,
    title: "Buy milk",
    description: "2 litres",
    due_date: dueDate,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

describe("toTask (DB record -> domain)", () => {
  it("converts ObjectIds to strings and renames DB fields", () => {
    expect(toTask(buildRecord())).toEqual({
      id: taskId.toString(),
      userId: userId.toString(),
      title: "Buy milk",
      description: "2 litres",
      dueDate,
      createdAt,
      updatedAt,
    });
  });

  it("turns missing optional fields into null", () => {
    const { description, due_date, ...withoutOptional } = buildRecord();

    const task = toTask(withoutOptional as TaskRecord);

    expect(task.description).toBeNull();
    expect(task.dueDate).toBeNull();
  });

  it("keeps null optional fields as null", () => {
    const task = toTask(buildRecord({ description: null, due_date: null }));

    expect(task.description).toBeNull();
    expect(task.dueDate).toBeNull();
  });
});

describe("toTaskResponse (domain -> API DTO)", () => {
  const task: Task = {
    id: taskId.toString(),
    userId: userId.toString(),
    title: "Buy milk",
    description: "2 litres",
    dueDate,
    createdAt,
    updatedAt,
  };

  it("returns only public fields with ISO date strings", () => {
    expect(toTaskResponse(task)).toEqual({
      id: taskId.toString(),
      title: "Buy milk",
      description: "2 litres",
      dueDate: "2026-12-01T00:00:00.000Z",
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-02T10:00:00.000Z",
    });
  });

  it("never exposes the owner's userId", () => {
    expect(toTaskResponse(task)).not.toHaveProperty("userId");
  });

  it("keeps a null dueDate as null", () => {
    expect(toTaskResponse({ ...task, dueDate: null }).dueDate).toBeNull();
  });
});
