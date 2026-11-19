import User from '../models/User.js';
import Task from '../models/Task.js';

function validObjectId(id) {
  return /^[a-f\d]{24}$/i.test(id);
}

function invalidIdResponse(res, resource) {
  return res.status(400).json({
    success: false,
    message: `Invalid ${resource} ID`
  });
}

function notFoundResponse(res, resource) {
  return res.status(404).json({
    success: false,
    message: `${resource} not found`
  });
}

export async function getAllUsers(_req, res) {
  const users = await User.find()
    .select('name email role createdAt')
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    message: 'Users retrieved successfully',
    data: users
  });
}

export async function getUser(req, res) {
  if (!validObjectId(req.params.id)) {
    return invalidIdResponse(res, 'user');
  }

  const user = await User.findById(req.params.id).select('name email role createdAt');
  if (!user) {
    return notFoundResponse(res, 'User');
  }

  return res.status(200).json({
    success: true,
    message: 'User retrieved successfully',
    data: user
  });
}

export async function getUserTasks(req, res) {
  if (!validObjectId(req.params.id)) {
    return invalidIdResponse(res, 'user');
  }

  const user = await User.findById(req.params.id).select('_id');
  if (!user) {
    return notFoundResponse(res, 'User');
  }

  const tasks = await Task.find({ userId: user._id }).sort({ createdAt: -1 });
  return res.status(200).json({
    success: true,
    message: 'User tasks retrieved successfully',
    data: tasks
  });
}

export async function getAllTasks(_req, res) {
  const tasks = await Task.find()
    .populate('userId', 'name email createdAt')
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    message: 'Tasks retrieved successfully',
    data: tasks
  });
}

export async function getDashboard(_req, res) {
  const effectiveStatus = {
    $ifNull: [
      '$status',
      { $cond: [{ $eq: ['$completed', true] }, 'Completed', 'Pending'] }
    ]
  };

  const [users, taskTotals] = await Promise.all([
    User.aggregate([
      {
        $match: {
          $or: [{ role: 'user' }, { role: { $exists: false } }, { role: null }]
        }
      },
      {
        $lookup: {
          from: Task.collection.name,
          let: { ownerId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$ownerId'] } } },
            { $addFields: { effectiveStatus } },
            {
              $group: {
                _id: null,
                totalTasks: { $sum: 1 },
                pendingTasks: {
                  $sum: { $cond: [{ $eq: ['$effectiveStatus', 'Pending'] }, 1, 0] }
                },
                inProgressTasks: {
                  $sum: { $cond: [{ $eq: ['$effectiveStatus', 'In Progress'] }, 1, 0] }
                },
                completedTasks: {
                  $sum: { $cond: [{ $eq: ['$effectiveStatus', 'Completed'] }, 1, 0] }
                }
              }
            },
            {
              $project: {
                _id: 0,
                totalTasks: 1,
                pendingTasks: 1,
                inProgressTasks: 1,
                completedTasks: 1
              }
            }
          ],
          as: 'taskStats'
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          createdAt: 1,
          taskStats: { $arrayElemAt: ['$taskStats', 0] }
        }
      },
      { $sort: { createdAt: -1 } }
    ]),
    Task.aggregate([
      { $addFields: { effectiveStatus } },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          pendingTasks: {
            $sum: { $cond: [{ $eq: ['$effectiveStatus', 'Pending'] }, 1, 0] }
          },
          inProgressTasks: {
            $sum: { $cond: [{ $eq: ['$effectiveStatus', 'In Progress'] }, 1, 0] }
          },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$effectiveStatus', 'Completed'] }, 1, 0] }
          }
        }
      },
      { $project: { _id: 0 } }
    ])
  ]);

  const userProgress = users.map((user) => {
    const stats = user.taskStats || {
      totalTasks: 0,
      pendingTasks: 0,
      inProgressTasks: 0,
      completedTasks: 0
    };
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      ...stats,
      completionPercentage: stats.totalTasks
        ? Number(((stats.completedTasks / stats.totalTasks) * 100).toFixed(2))
        : 0
    };
  });

  const totals = taskTotals[0] || {
    totalTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0
  };

  return res.status(200).json({
    success: true,
    message: 'Dashboard statistics retrieved successfully',
    data: {
      totalUsers: users.length,
      ...totals,
      completionPercentage: totals.totalTasks
        ? Number(((totals.completedTasks / totals.totalTasks) * 100).toFixed(2))
        : 0,
      users: userProgress
    }
  });
}
