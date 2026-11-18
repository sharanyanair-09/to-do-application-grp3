import mongoose from 'mongoose';

export async function connectDB() {
  const { MONGODB_URI } = process.env;

  if (!MONGODB_URI || MONGODB_URI === 'your_mongodb_atlas_connection_string') {
    throw new Error('Set MONGODB_URI in backend/.env before starting the server.');
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'todo_app' });
  console.log('Connected to MongoDB database todo_app.');
}
