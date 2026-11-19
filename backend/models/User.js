import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'users',
    versionKey: false,
    toJSON: {
      transform(_document, returned) {
        delete returned.passwordHash;
        return returned;
      }
    }
  }
);

export default mongoose.model('User', userSchema);
