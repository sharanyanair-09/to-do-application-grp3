import mongoose from 'mongoose';
import Task from '../models/Task.js';

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

  if (!title || typeof description !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'A title and a string description are required'
    });
  }

  const task = await Task.create({
    userId: new mongoose.Types.ObjectId(req.user.id),
    title,
    description
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

  if (Object.prototype.hasOwnProperty.call(body, 'completed')) {
    if (typeof body.completed !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Completed must be a boolean'
      });
    }
    updates.completed = body.completed;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({
      success: false,
      message: 'Provide a title, description, or completed status to update'
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
    { $set: { completed: req.body.completed, updatedAt: new Date() } },
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
