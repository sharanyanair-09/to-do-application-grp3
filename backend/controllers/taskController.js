import mongoose from 'mongoose';
import Task from '../models/Task.js';

const TASK_STATUSES = ['Pending', 'In Progress', 'Completed'];
const TASK_PRIORITIES = ['low', 'medium', 'high'];

function validDueDate(value) {
  if (value === '' || value === undefined) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTaskId(id) {
  return /^[a-f\d]{24}$/i.test(id);
}

function invalidIdResponse(res) {
  return res.status(400).json({
    success: false,
    message: 'Invalid task ID'
  });
}

function notFoundResponse(res) {
  return res.status(404).json({
    success: false,
    message: 'Task not found'
  });
}

export async function createTask(req, res) {
  const body = req.body || {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = body.description === undefined ? '' : body.description;
  const dueDate = body.dueDate === undefined ? '' : body.dueDate;
  const priority = body.priority === undefined ? 'medium' : body.priority;
  const category = body.category === undefined ? 'Personal' : body.category;
  const important = body.important === undefined ? false : body.important;
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');
  const hasCompleted = Object.prototype.hasOwnProperty.call(body, 'completed');
  let status = hasStatus ? body.status : 'Pending';

  if (
    !title ||
    typeof description !== 'string' ||
    !validDueDate(dueDate) ||
    !TASK_PRIORITIES.includes(priority) ||
    typeof category !== 'string' ||
    !category.trim() ||
    typeof important !== 'boolean' ||
    !TASK_STATUSES.includes(status) ||
    (hasCompleted && typeof body.completed !== 'boolean')
  ) {
    return res.status(400).json({
      success: false,
      message: 'Provide a title, description, valid date, priority, category, and status'
    });
  }

  if (hasCompleted) {
    if (hasStatus && body.completed !== (status === 'Completed')) {
      return res.status(400).json({
        success: false,
        message: 'Status and completed values must agree'
      });
    }
    if (!hasStatus) {
      status = body.completed ? 'Completed' : 'Pending';
    }
  }

  const task = await Task.create({
    userId: new mongoose.Types.ObjectId(req.user.id),
    title,
    description,
    dueDate,
    priority,
    category: category.trim(),
    important,
    status,
    completed: status === 'Completed'
  });

  return res.status(201).json({
    success: true,
    message: 'Task created successfully',
    data: task
  });
}

export async function getTasks(req, res) {
  const tasks = await Task.find({ userId: req.user.id }).sort({ createdAt: -1 });
  return res.status(200).json({
    success: true,
    message: 'Tasks retrieved successfully',
    data: tasks
  });
}

export async function getTask(req, res) {
  if (!validTaskId(req.params.id)) {
    return invalidIdResponse(res);
  }

  const task = await Task.findOne({ _id: req.params.id, userId: req.user.id });
  if (!task) {
    return notFoundResponse(res);
  }

  return res.status(200).json({
    success: true,
    message: 'Task retrieved successfully',
    data: task
  });
}

export async function updateTask(req, res) {
  if (!validTaskId(req.params.id)) {
    return invalidIdResponse(res);
  }

  const body = req.body || {};
  const updates = {};
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title must be a non-empty string'
      });
    }
    updates.title = body.title.trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    if (typeof body.description !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Description must be a string'
      });
    }
    updates.description = body.description;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'dueDate')) {
    if (!validDueDate(body.dueDate)) {
      return res.status(400).json({ success: false, message: 'Due date must use YYYY-MM-DD format' });
    }
    updates.dueDate = body.dueDate;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'priority')) {
    if (!TASK_PRIORITIES.includes(body.priority)) {
      return res.status(400).json({ success: false, message: 'Priority must be low, medium, or high' });
    }
    updates.priority = body.priority;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'category')) {
    if (typeof body.category !== 'string' || !body.category.trim()) {
      return res.status(400).json({ success: false, message: 'Category must be a non-empty string' });
    }
    updates.category = body.category.trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'important')) {
    if (typeof body.important !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Important must be a boolean' });
    }
    updates.important = body.important;
  }

  if (hasStatus) {
    if (typeof body.status !== 'string' || !TASK_STATUSES.includes(body.status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be Pending, In Progress, or Completed'
      });
    }
    updates.status = body.status;
    updates.completed = body.status === 'Completed';
  }

  if (Object.prototype.hasOwnProperty.call(body, 'completed')) {
    if (typeof body.completed !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Completed must be a boolean'
      });
    }
    if (hasStatus && body.completed !== (body.status === 'Completed')) {
      return res.status(400).json({
        success: false,
        message: 'Status and completed values must agree'
      });
    }
    if (!hasStatus) {
      updates.status = body.completed ? 'Completed' : 'Pending';
    }
    updates.completed = body.completed;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({
      success: false,
      message: 'Provide at least one supported task field to update'
    });
  }

  updates.updatedAt = new Date();
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!task) {
    return notFoundResponse(res);
  }

  return res.status(200).json({
    success: true,
    message: 'Task updated successfully',
    data: task
  });
}

export async function deleteTask(req, res) {
  if (!validTaskId(req.params.id)) {
    return invalidIdResponse(res);
  }

  const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!task) {
    return notFoundResponse(res);
  }

  return res.status(200).json({
    success: true,
    message: 'Task deleted successfully'
  });
}

export async function setTaskCompleted(req, res) {
  if (!validTaskId(req.params.id)) {
    return invalidIdResponse(res);
  }

  if (!req.body || typeof req.body.completed !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'Completed must be a boolean'
    });
  }

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    {
      $set: {
        status: req.body.completed ? 'Completed' : 'Pending',
        completed: req.body.completed,
        updatedAt: new Date()
      }
    },
    { new: true, runValidators: true }
  );

  if (!task) {
    return notFoundResponse(res);
  }

  return res.status(200).json({
    success: true,
    message: 'Task completion status updated successfully',
    data: task
  });
}
