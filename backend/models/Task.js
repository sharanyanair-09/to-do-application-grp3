import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending'
    },
    completed: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'tasks',
    versionKey: false
  }
);

taskSchema.pre('init', function migrateLegacyCompletion(data) {
  if (data.status === undefined) {
    data.status = data.completed ? 'Completed' : 'Pending';
  }
});

taskSchema.pre('validate', function syncLegacyCompletion(next) {
  this.completed = this.status === 'Completed';
  next();
});

export default mongoose.model('Task', taskSchema);
