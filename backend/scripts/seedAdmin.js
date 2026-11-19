import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import { isValidEmail } from '../utils/validation.js';

async function seedAdmin() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (
    !name ||
    !email ||
    !password ||
    name === 'Admin Name' ||
    email === 'admin@example.com' ||
    password === 'replace_with_a_secure_password' ||
    password.length < 8
  ) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and an ADMIN_PASSWORD of at least 8 characters.');
  }

  if (!isValidEmail(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }

  await connectDB();

  const existingUser = await User.findOne({ email }).select('_id role');
  if (existingUser) {
    if (existingUser.role === 'admin') {
      console.log('An admin account with ADMIN_EMAIL already exists; no changes made.');
      return;
    }
    throw new Error('ADMIN_EMAIL is already registered to a non-admin account.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ name, email, passwordHash, role: 'admin' });
  console.log('Admin account created.');
}

seedAdmin()
  .catch((error) => {
    if (error.code === 11000) {
      console.error('Admin seed failed: an account already uses ADMIN_EMAIL.');
      process.exitCode = 1;
      return;
    }
    console.error(`Admin seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
