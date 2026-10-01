import mongoose from "mongoose";
import { ref } from "node:process";
import User from "./User.js";

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
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
});

const Task = mongoose.model("Task", taskSchema);
