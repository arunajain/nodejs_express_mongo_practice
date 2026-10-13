import TaskModel from "../models/Task.js";
import { toTask } from "../mappers/task.mapper.js";
import type {
  NewTaskData,
  Task,
  TaskChanges,
  TaskRecord,
} from "../types/task.type.js";

/**
 * Every query that reads or writes a single task is scoped by BOTH the task id
 * and the owner's userId, so a user can never touch another user's task.
 * A task owned by someone else looks exactly like a missing one (null).
 */
class TaskRepository {
  async create(data: NewTaskData): Promise<Task> {
    const doc = await TaskModel.create({
      userId: data.userId,
      title: data.title,
      description: data.description ?? null,
      due_date: data.dueDate ?? null,
    });
    return toTask(doc.toObject() as TaskRecord);
  }

  async findAllByUser(userId: string): Promise<Task[]> {
    const records = await TaskModel.find({ userId })
      .sort({ createdAt: -1 })
      .lean<TaskRecord[]>();
    return records.map(toTask);
  }

  async findByIdForUser(id: string, userId: string): Promise<Task | null> {
    const record = await TaskModel.findOne({
      _id: id,
      userId,
    }).lean<TaskRecord>();
    return record ? toTask(record) : null;
  }

  async updateByIdForUser(
    id: string,
    userId: string,
    changes: TaskChanges,
  ): Promise<Task | null> {
    const set: Partial<Omit<TaskRecord, "_id" | "userId">> = {
      updatedAt: new Date(),
    };
    const unset: Record<string, ""> = {};

    if (changes.title !== undefined) set.title = changes.title;
    if (changes.description === null) unset.description = "";
    else if (changes.description !== undefined)
      set.description = changes.description;
    if (changes.dueDate === null) unset.due_date = "";
    else if (changes.dueDate !== undefined) set.due_date = changes.dueDate;

    const record = await TaskModel.findOneAndUpdate(
      { _id: id, userId },
      Object.keys(unset).length > 0
        ? { $set: set, $unset: unset }
        : { $set: set },
      { returnDocument: "after", runValidators: true },
    ).lean<TaskRecord>();
    return record ? toTask(record) : null;
  }

  async deleteByIdForUser(id: string, userId: string): Promise<boolean> {
    const result = await TaskModel.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  }
}
export default TaskRepository;
