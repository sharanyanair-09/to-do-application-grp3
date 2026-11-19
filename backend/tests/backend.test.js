import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { errorHandler } from '../middleware/errorMiddleware.js';
import { isValidEmail } from '../utils/validation.js';

const backendDirectory = fileURLToPath(new URL('..', import.meta.url));
const testMongoUri = process.env.TEST_MONGODB_URI;
const skipIntegrationReason = !testMongoUri
  ? 'TEST_MONGODB_URI is not configured'
  : testMongoUri === process.env.MONGODB_URI
    ? 'TEST_MONGODB_URI must not equal MONGODB_URI'
    : false;

function responseRecorder() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('email validation accepts common addresses and rejects malformed domains', () => {
  assert.equal(isValidEmail('user.name+tag@example.co.uk'), true);
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('user@sub..example.com'), false);
  assert.equal(isValidEmail('.user@example.com'), false);
  assert.equal(isValidEmail('user@example'), false);
  assert.equal(isValidEmail('user@example.com\n'), false);
});

test('JWT middleware rejects absent, invalid, expired, and malformed-subject tokens', () => {
  const secret = 'test-secret-that-is-long-enough-for-unit-tests';
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  const invalidTokens = [
    undefined,
    'not-a-token',
    jwt.sign({ sub: 'not-an-object-id' }, secret),
    jwt.sign({ sub: '64b000000000000000000001' }, secret, { expiresIn: -1 })
  ];

  try {
    for (const token of invalidTokens) {
      let nextCalled = false;
      const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
      const res = responseRecorder();

      authenticateToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
    }

    let authenticatedUser;
    const validRequest = {
      headers: {
        authorization: `Bearer ${jwt.sign(
          { role: 'admin' },
          secret,
          { subject: '64b000000000000000000001' }
        )}`
      }
    };
    authenticateToken(
      validRequest,
      responseRecorder(),
      () => {
        authenticatedUser = validRequest.user;
      }
    );
    assert.deepEqual(authenticatedUser, {
      id: '64b000000000000000000001',
      role: 'admin'
    });
  } finally {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});

test('error middleware sanitizes validation details and returns 413 for oversized requests', () => {
  const validationError = new Error('Rejected value: confidential-input');
  validationError.name = 'ValidationError';
  const validationResponse = responseRecorder();
  errorHandler(validationError, {}, validationResponse, () => {});
  assert.equal(validationResponse.statusCode, 400);
  assert.equal(validationResponse.body.message, 'Invalid request data');

  const castError = new Error('Cast failed for value: confidential-input');
  castError.name = 'CastError';
  const castResponse = responseRecorder();
  errorHandler(castError, {}, castResponse, () => {});
  assert.equal(castResponse.statusCode, 400);
  assert.equal(castResponse.body.message, 'Invalid request value');

  const oversizedResponse = responseRecorder();
  errorHandler({ status: 413, type: 'entity.too.large' }, {}, oversizedResponse, () => {});
  assert.equal(oversizedResponse.statusCode, 413);
  assert.equal(oversizedResponse.body.message, 'Request body is too large');
});

function request(port, method, path, token, body) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const req = http.request(
      { hostname: '127.0.0.1', port, path, method, headers, timeout: 5000 },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data;
          try {
            data = text ? JSON.parse(text) : undefined;
          } catch (_error) {
            return reject(new Error('Backend returned a non-JSON response.'));
          }
          return resolve({ status: res.statusCode, data });
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('Backend request timed out.')));
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

async function findAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function waitForHealth(port, child) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('Backend server exited before becoming ready.');
    }
    try {
      const result = await request(port, 'GET', '/api/health');
      if (result.status === 200) {
        return;
      }
    } catch (_error) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error('Backend server did not become ready with the isolated test database.');
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }
  const closed = once(child, 'close');
  let timeout;
  child.kill();
  await Promise.race([
    closed,
    new Promise((resolve) => {
      timeout = setTimeout(resolve, 5000);
    })
  ]);
  clearTimeout(timeout);
}

async function runAdminSeed(env) {
  const child = spawn(process.execPath, ['scripts/seedAdmin.js'], {
    cwd: backendDirectory,
    env,
    stdio: 'ignore'
  });
  const timeout = setTimeout(() => child.kill(), 20000);
  try {
    const [code] = await once(child, 'close');
    return code;
  } finally {
    clearTimeout(timeout);
  }
}

test(
  'isolated backend integration: auth, task CRUD/ownership, admin, seed, and dashboard',
  { skip: skipIntegrationReason },
  async (t) => {
    const databaseName = `todo_app_test_${process.pid}_${Date.now()}`;
    const jwtSecret = 'integration-test-secret-that-is-not-a-production-secret';
    const adminEmail = `admin-${process.pid}@example.test`;
    const adminPassword = `admin-password-${process.pid}-secure`;
    const serverPort = await findAvailablePort();
    const isolatedEnv = {
      ...process.env,
      MONGODB_URI: testMongoUri,
      MONGODB_DB_NAME: databaseName,
      JWT_SECRET: jwtSecret,
      PORT: String(serverPort)
    };
    let serverProcess;
    let connected = false;

    try {
      try {
        await mongoose.connect(testMongoUri, {
          dbName: databaseName,
          serverSelectionTimeoutMS: 8000
        });
        connected = true;
      } catch (_error) {
        return t.skip('Could not connect to TEST_MONGODB_URI; database tests were not run.');
      }

      await User.init();
      await Task.init();

      serverProcess = spawn(process.execPath, ['server.js'], {
        cwd: backendDirectory,
        env: isolatedEnv,
        stdio: 'ignore'
      });
      await waitForHealth(serverPort, serverProcess);

      const register = (name, email, password, extra = {}) =>
        request(serverPort, 'POST', '/api/auth/register', undefined, {
          name,
          email,
          password,
          ...extra
        });
      const login = (email, password) =>
        request(serverPort, 'POST', '/api/auth/login', undefined, { email, password });

      await t.test('registration, login, hashing, and duplicate protection', async () => {
        const user1 = {
          name: 'Test User One',
          email: `user-one-${process.pid}@example.test`,
          password: `user-one-password-${process.pid}`
        };
        const user2 = {
          name: 'Test User Two',
          email: `user-two-${process.pid}@example.test`,
          password: `user-two-password-${process.pid}`
        };

        const rejectedAdmin = await register(
          'Self Promoting User',
          `self-${process.pid}@example.test`,
          'user-password-123',
          { role: 'admin' }
        );
        assert.equal(rejectedAdmin.status, 400);

        const invalidEmail = await register('Invalid Email', 'user@domain..test', 'password-123');
        assert.equal(invalidEmail.status, 400);

        const firstRegistration = await register(user1.name, user1.email, user1.password);
        assert.equal(firstRegistration.status, 201);
        assert.equal(firstRegistration.data.data.user.role, 'user');
        assert.equal('passwordHash' in firstRegistration.data.data.user, false);
        user1.id = firstRegistration.data.data.user.id;

        const secondRegistration = await register(user2.name, user2.email, user2.password);
        assert.equal(secondRegistration.status, 201);
        user2.id = secondRegistration.data.data.user.id;

        const duplicateRegistration = await register(user1.name, user1.email, user1.password);
        assert.equal(duplicateRegistration.status, 409);

        const userLogin = await login(user1.email, user1.password);
        assert.equal(userLogin.status, 200);
        assert.equal(userLogin.data.data.user.role, 'user');
        assert.equal('passwordHash' in userLogin.data.data.user, false);
        user1.token = userLogin.data.data.token;

        const wrongPassword = await login(user1.email, 'wrong-password');
        assert.equal(wrongPassword.status, 401);

        const storedUser = await User.findById(user1.id).select('+passwordHash');
        assert.ok(storedUser.passwordHash);
        assert.ok(
          storedUser.passwordHash && storedUser.passwordHash !== user1.password,
          'stored password must be a hash, not the submitted password'
        );
        assert.equal(await bcrypt.compare(user1.password, storedUser.passwordHash), true);
      });

      const user1 = {
        name: 'Test User One',
        email: `user-one-${process.pid}@example.test`,
        password: `user-one-password-${process.pid}`
      };
      const user2 = {
        name: 'Test User Two',
        email: `user-two-${process.pid}@example.test`,
        password: `user-two-password-${process.pid}`
      };
      const registration1 = await User.findOne({ email: user1.email }).select('_id');
      const registration2 = await User.findOne({ email: user2.email }).select('_id');
      user1.id = registration1._id.toString();
      user2.id = registration2._id.toString();
      user1.token = (await login(user1.email, user1.password)).data.data.token;
      user2.token = (await login(user2.email, user2.password)).data.data.token;

      await t.test('authentication rejects missing, invalid, and expired tokens', async () => {
        assert.equal((await request(serverPort, 'GET', '/api/tasks')).status, 401);
        assert.equal((await request(serverPort, 'GET', '/api/tasks', 'invalid')).status, 401);
        assert.equal(
          (
            await request(serverPort, 'POST', '/api/auth/register', undefined, {
              name: 'Oversized Request',
              email: `oversized-${process.pid}@example.test`,
              password: 'secure-password-123',
              padding: 'x'.repeat(12000)
            })
          ).status,
          413
        );
        const expiredToken = jwt.sign(
          { role: 'user' },
          jwtSecret,
          { subject: user1.id, expiresIn: -1 }
        );
        assert.equal((await request(serverPort, 'GET', '/api/tasks', expiredToken)).status, 401);
      });

      let inProgressTask;
      let pendingTask;

      await t.test('task status, completion synchronization, CRUD, and ownership', async () => {
        const invalidStatus = await request(
          serverPort,
          'POST',
          '/api/tasks',
          user1.token,
          { title: 'Bad status', status: 'blocked' }
        );
        assert.equal(invalidStatus.status, 400);

        const mismatch = await request(
          serverPort,
          'POST',
          '/api/tasks',
          user1.token,
          { title: 'Mismatched state', status: 'In Progress', completed: true }
        );
        assert.equal(mismatch.status, 400);

        const inProgress = await request(
          serverPort,
          'POST',
          '/api/tasks',
          user1.token,
          { title: 'In progress task', status: 'In Progress', completed: false }
        );
        assert.equal(inProgress.status, 201);
        assert.equal(inProgress.data.data.status, 'In Progress');
        assert.equal(inProgress.data.data.completed, false);
        inProgressTask = inProgress.data.data;

        const pending = await request(
          serverPort,
          'POST',
          '/api/tasks',
          user1.token,
          { title: 'Task to complete' }
        );
        assert.equal(pending.status, 201);
        assert.equal(pending.data.data.status, 'Pending');

        const updateStatus = await request(
          serverPort,
          'PUT',
          `/api/tasks/${pending.data.data._id}`,
          user1.token,
          { status: 'Completed' }
        );
        assert.equal(updateStatus.status, 200);
        assert.equal(updateStatus.data.data.status, 'Completed');
        assert.equal(updateStatus.data.data.completed, true);

        const pendingUserTask = await request(
          serverPort,
          'POST',
          '/api/tasks',
          user2.token,
          { title: 'Pending user two task', completed: false }
        );
        assert.equal(pendingUserTask.status, 201);
        assert.equal(pendingUserTask.data.data.status, 'Pending');
        pendingTask = pendingUserTask.data.data;

        const completeLegacyEndpoint = await request(
          serverPort,
          'PATCH',
          `/api/tasks/${pendingTask._id}/complete`,
          user2.token,
          { completed: true }
        );
        assert.equal(completeLegacyEndpoint.status, 200);
        assert.equal(completeLegacyEndpoint.data.data.status, 'Completed');
        assert.equal(completeLegacyEndpoint.data.data.completed, true);
        const uncompleteLegacyEndpoint = await request(
          serverPort,
          'PATCH',
          `/api/tasks/${pendingTask._id}/complete`,
          user2.token,
          { completed: false }
        );
        assert.equal(uncompleteLegacyEndpoint.data.data.status, 'Pending');
        assert.equal(uncompleteLegacyEndpoint.data.data.completed, false);

        const temporary = await request(
          serverPort,
          'POST',
          '/api/tasks',
          user1.token,
          { title: 'Temporary CRUD task' }
        );
        assert.equal(temporary.status, 201);
        const taskId = temporary.data.data._id;
        const readTask = await request(serverPort, 'GET', `/api/tasks/${taskId}`, user1.token);
        assert.equal(readTask.status, 200);
        const updateTask = await request(
          serverPort,
          'PUT',
          `/api/tasks/${taskId}`,
          user1.token,
          { title: 'Updated temporary task' }
        );
        assert.equal(updateTask.status, 200);
        assert.equal(updateTask.data.data.title, 'Updated temporary task');
        const deleteTask = await request(serverPort, 'DELETE', `/api/tasks/${taskId}`, user1.token);
        assert.equal(deleteTask.status, 200);
        assert.equal((await request(serverPort, 'GET', `/api/tasks/${taskId}`, user1.token)).status, 404);
        assert.equal((await request(serverPort, 'GET', '/api/tasks/not-an-id', user1.token)).status, 400);

        assert.equal(
          (await request(serverPort, 'GET', `/api/tasks/${inProgressTask._id}`, user2.token)).status,
          404
        );
        assert.equal(
          (
            await request(
              serverPort,
              'PUT',
              `/api/tasks/${inProgressTask._id}`,
              user2.token,
              { title: 'Unauthorized change' }
            )
          ).status,
          404
        );
        assert.equal(
          (await request(serverPort, 'DELETE', `/api/tasks/${inProgressTask._id}`, user2.token)).status,
          404
        );
        const user1Tasks = await request(serverPort, 'GET', '/api/tasks', user1.token);
        assert.equal(user1Tasks.status, 200);
        assert.equal(user1Tasks.data.data.length, 2);

        const legacyId = new mongoose.Types.ObjectId();
        await Task.collection.insertOne({
          _id: legacyId,
          userId: new mongoose.Types.ObjectId(user2.id),
          title: 'Legacy completed task',
          description: '',
          completed: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        const legacyRead = await request(
          serverPort,
          'GET',
          `/api/tasks/${legacyId.toString()}`,
          user2.token
        );
        assert.equal(legacyRead.status, 200);
        assert.equal(legacyRead.data.data.status, 'Completed');
        assert.equal(legacyRead.data.data.completed, true);

        const conflict = await request(
          serverPort,
          'PUT',
          `/api/tasks/${inProgressTask._id}`,
          user1.token,
          { status: 'In Progress', completed: true }
        );
        assert.equal(conflict.status, 400);
        const unchanged = await request(
          serverPort,
          'GET',
          `/api/tasks/${inProgressTask._id}`,
          user1.token
        );
        assert.equal(unchanged.data.data.status, 'In Progress');
        assert.equal(unchanged.data.data.completed, false);
      });

      const seedEnv = {
        ...isolatedEnv,
        ADMIN_NAME: 'Integration Test Admin',
        ADMIN_EMAIL: adminEmail,
        ADMIN_PASSWORD: adminPassword
      };
      await t.test('admin seed creation, duplicate handling, and no user promotion', async () => {
        assert.equal(await runAdminSeed(seedEnv), 0);
        assert.equal(await runAdminSeed({ ...seedEnv, ADMIN_PASSWORD: 'different-password-123' }), 0);

        const adminLogin = await login(adminEmail, adminPassword);
        assert.equal(adminLogin.status, 200);
        assert.equal(adminLogin.data.data.user.role, 'admin');
        assert.equal('passwordHash' in adminLogin.data.data.user, false);
        const wrongAdminPassword = await login(adminEmail, 'different-password-123');
        assert.equal(wrongAdminPassword.status, 401);
        const adminToken = adminLogin.data.data.token;

        const promoteExistingUser = await runAdminSeed({
          ...seedEnv,
          ADMIN_EMAIL: user1.email
        });
        assert.notEqual(promoteExistingUser, 0);
        const invalidEmailSeed = await runAdminSeed({
          ...seedEnv,
          ADMIN_EMAIL: 'admin@invalid..example'
        });
        assert.notEqual(invalidEmailSeed, 0);
        const regularUser = await User.findById(user1.id).select('role');
        assert.equal(regularUser.role, 'user');
      });

      const adminLogin = await login(adminEmail, adminPassword);
      const adminToken = adminLogin.data.data.token;
      const adminPaths = [
        '/api/admin/users',
        `/api/admin/users/${user1.id}`,
        `/api/admin/users/${user1.id}/tasks`,
        '/api/admin/tasks',
        '/api/admin/dashboard'
      ];

      await t.test('admin APIs enforce current DB role and return correct data/statistics', async () => {
        for (const path of adminPaths) {
          assert.equal((await request(serverPort, 'GET', path, adminToken)).status, 200, path);
          assert.equal((await request(serverPort, 'GET', path, user1.token)).status, 403, path);
          assert.equal((await request(serverPort, 'GET', path)).status, 401, path);
          assert.equal((await request(serverPort, 'GET', path, 'invalid')).status, 401, path);
        }

        const users = await request(serverPort, 'GET', '/api/admin/users', adminToken);
        assert.equal(users.data.data.length, 3);
        assert.equal(users.data.data.some((user) => 'passwordHash' in user), false);

        const userById = await request(
          serverPort,
          'GET',
          `/api/admin/users/${user1.id}`,
          adminToken
        );
        assert.equal(userById.data.data.email, user1.email);
        assert.equal('passwordHash' in userById.data.data, false);

        const userTasks = await request(
          serverPort,
          'GET',
          `/api/admin/users/${user1.id}/tasks`,
          adminToken
        );
        assert.equal(userTasks.data.data.length, 2);

        const allTasks = await request(serverPort, 'GET', '/api/admin/tasks', adminToken);
        assert.equal(allTasks.data.data.length, 4);
        assert.ok(allTasks.data.data.every((task) => task.userId && task.userId.email));

        const dashboard = await request(serverPort, 'GET', '/api/admin/dashboard', adminToken);
        const stats = dashboard.data.data;
        assert.equal(stats.totalUsers, 2);
        assert.equal(stats.totalTasks, 4);
        assert.equal(stats.pendingTasks, 1);
        assert.equal(stats.inProgressTasks, 1);
        assert.equal(stats.completedTasks, 2);
        assert.equal(stats.completionPercentage, 50);
        assert.equal(stats.users.length, 2);
        assert.equal(stats.users.some((user) => user.email === adminEmail), false);
        const user1Progress = stats.users.find((user) => user.email === user1.email);
        const user2Progress = stats.users.find((user) => user.email === user2.email);
        assert.deepEqual(
          {
            total: user1Progress.totalTasks,
            pending: user1Progress.pendingTasks,
            inProgress: user1Progress.inProgressTasks,
            completed: user1Progress.completedTasks,
            percent: user1Progress.completionPercentage
          },
          { total: 2, pending: 0, inProgress: 1, completed: 1, percent: 50 }
        );
        assert.deepEqual(
          {
            total: user2Progress.totalTasks,
            pending: user2Progress.pendingTasks,
            inProgress: user2Progress.inProgressTasks,
            completed: user2Progress.completedTasks,
            percent: user2Progress.completionPercentage
          },
          { total: 2, pending: 1, inProgress: 0, completed: 1, percent: 50 }
        );

        assert.equal(
          (await request(serverPort, 'GET', '/api/admin/users/not-an-id', adminToken)).status,
          400
        );
        assert.equal(
          (await request(serverPort, 'GET', '/api/admin/users/not-an-id/tasks', adminToken)).status,
          400
        );

        await User.updateOne({ _id: adminLogin.data.data.user.id }, { $set: { role: 'user' } });
        assert.equal(
          (await request(serverPort, 'GET', '/api/admin/users', adminToken)).status,
          403
        );
        await User.updateOne({ _id: adminLogin.data.data.user.id }, { $set: { role: 'admin' } });
      });
    } finally {
      await stopChild(serverProcess);
      if (connected) {
        try {
          await mongoose.connection.dropDatabase();
        } finally {
          await mongoose.disconnect();
        }
      }
    }
  }
);
