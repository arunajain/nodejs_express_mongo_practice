import mongoose from "mongoose";
import type { InferSchemaType, Types } from "mongoose";

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  due_date: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Task = mongoose.model("Task", taskSchema);

// Exact shape of a task document as stored in MongoDB.
// Only the repository layer should use this type.
export type TaskRecord = InferSchemaType<typeof taskSchema> & {
  _id: Types.ObjectId;
};
export default Task;
