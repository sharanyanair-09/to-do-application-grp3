import mongoose from 'mongoose';

export async function connectDB() {
  const { MONGODB_URI } = process.env;
  const dbName = process.env.MONGODB_DB_NAME || 'todo_app';

  if (!MONGODB_URI || MONGODB_URI === 'your_mongodb_atlas_connection_string') {
    throw new Error('Set MONGODB_URI in backend/.env before starting the server.');
  }

  await mongoose.connect(MONGODB_URI, { dbName });
  console.log(`Connected to MongoDB database ${dbName}.`);
}
