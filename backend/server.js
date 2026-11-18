import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'API is running' });
});
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret === 'your_secret_key') {
    throw new Error('Set JWT_SECRET in backend/.env to a random value at least 32 characters long.');
  }

  await connectDB();

  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}.`);
  });
}

startServer().catch((error) => {
  console.error(`Server failed to start: ${error.message}`);
  process.exitCode = 1;
});
