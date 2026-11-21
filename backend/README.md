# To-Do Application – Backend

## About

This is the backend of the To-Do Application Group Project. It provides REST APIs for user authentication and task management.

## Technologies Used

- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- JSON Web Token (JWT)
- bcrypt

## Features

- User Registration
- User Login
- User and admin roles
- Password Hashing
- JWT Authentication
- Admin-only user, task, and dashboard APIs
- Create Tasks
- View All Tasks
- Update Tasks
- Set task status to Pending, In Progress, or Completed
- Delete Tasks
- User-specific Task Management

## Project Structure

```text
backend/
│
├── config/
│   └── db.js
│
├── controllers/
│   ├── adminController.js
│   ├── authController.js
│   └── taskController.js
│
├── middleware/
│   ├── authMiddleware.js
│   └── errorMiddleware.js
│
├── models/
│   ├── User.js
│   └── Task.js
│
├── routes/
│   ├── adminRoutes.js
│   ├── authRoutes.js
│   └── taskRoutes.js
│
├── scripts/
│   └── seedAdmin.js
│
├── utils/
│   └── validation.js
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── server.js
```

## Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Navigate to Backend Folder

```bash
cd backend
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Create Environment File

Create a `.env` file inside the backend folder.

On Windows Command Prompt, run:

```cmd
copy .env.example .env
```

### 5. Generate JWT Secret Key

Run the following command in the terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated secret key and paste it into your `.env` file.

### 6. Configure Environment Variables

Open the `.env` file and add your credentials:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=paste_your_generated_secret_key
PORT=5000
ADMIN_NAME=Admin Name
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_a_secure_password
```

Replace the MongoDB connection string with your own MongoDB Atlas connection string and use the generated JWT secret key.
Set the three `ADMIN_*` values to the desired initial admin account before running the seed command. Use a unique email and a strong password of at least 8 characters; do not commit real credentials.

**Important:**
- Never upload the `.env` file to GitHub.
- Never share your MongoDB username, password, or JWT secret key.
- Each developer should configure their own `.env` file.

### 7. Start the Backend Server

Run:

```bash
npm run dev
```

If everything is configured correctly, you should see:

```text
Connected to MongoDB database todo_app.
Server listening on port 5000.
```

The backend server will run at:

`http://localhost:5000`

## API Endpoints

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check whether the API is running |

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login user |

### Task Management

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks` | Get all user tasks |
| GET | `/api/tasks/:id` | Get a specific task |
| PUT | `/api/tasks/:id` | Update a task |
| PATCH | `/api/tasks/:id/complete` | Backward-compatible boolean completion update |
| DELETE | `/api/tasks/:id` | Delete a task |

**Authentication:** All task endpoints require a valid JWT Bearer token.

### Roles and Admin Account

Public registration always creates a `user`. A supplied role other than `user` is rejected, and there is no public role-change API. Existing users without a stored role are treated as `user`. Login JWTs include the role; older tokens without a role continue to work for user task APIs but cannot access admin endpoints. Log in again after seeding an admin account to obtain an admin token.

Create the admin account from the backend directory after configuring `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env`:

```bash
npm run seed:admin
```

The script hashes the password with bcrypt. It does not promote an existing regular user, and rerunning it for an existing admin email makes no changes. The seed account is not created by public registration.

### Admin APIs

All admin endpoints require `Authorization: Bearer <admin-token>`. Missing/invalid tokens return `401`; an authenticated non-admin receives `403`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/users` | List users (name, email, role, createdAt) |
| GET | `/api/admin/users/:id` | Get one user |
| GET | `/api/admin/users/:id/tasks` | Get tasks for one user |
| GET | `/api/admin/tasks` | List all tasks with owner details in `userId` |
| GET | `/api/admin/dashboard` | Task totals, completion percentage, and per-user progress |

User and task identifiers must be valid MongoDB ObjectIds. Admin user responses omit password hashes.

### Request and Response Examples

Register a regular user:

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "name": "Sam Example",
  "email": "sam@example.com",
  "password": "a-strong-password"
}
```

Login as either a regular user or the seeded admin:

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "admin@example.com",
  "password": "the-password-configured-in-env"
}
```

Successful login returns `data.token` and a user object containing `id`, `name`, `email`, and `role`.

Create a task with one of the supported statuses:

```http
POST /api/tasks
Authorization: Bearer <user-token>
Content-Type: application/json
```

```json
{
  "title": "Prepare report",
  "description": "Review this week's tasks",
  "dueDate": "2026-11-24",
  "priority": "high",
  "category": "Work",
  "important": true,
  "status": "In Progress"
}
```

`dueDate` is an optional `YYYY-MM-DD` string. `priority` accepts `low`, `medium`, or `high`; it defaults to `medium`. `category` defaults to `Personal`, and `important` defaults to `false`. If `status` is omitted when creating a task, it defaults to `Pending`. These task fields are stored with the user's task in MongoDB.

Update task status with `PUT /api/tasks/:id`:

```json
{
  "status": "Completed"
}
```

The response includes the status and the compatible boolean `completed` (`true` only for `Completed`). The old `PATCH /api/tasks/:id/complete` endpoint continues accepting `{ "completed": true }` or `{ "completed": false }`.

The dashboard's `totalUsers` and per-user progress include regular users only (legacy accounts without a role are treated as users). Global task totals include tasks of all owners.

Example admin dashboard response:

```json
{
  "success": true,
  "message": "Dashboard statistics retrieved successfully",
  "data": {
    "totalUsers": 2,
    "totalTasks": 4,
    "pendingTasks": 1,
    "inProgressTasks": 1,
    "completedTasks": 2,
    "completionPercentage": 50,
    "users": [
      {
        "id": "64b000000000000000000001",
        "name": "Sam Example",
        "email": "sam@example.com",
        "totalTasks": 2,
        "pendingTasks": 1,
        "inProgressTasks": 0,
        "completedTasks": 1,
        "completionPercentage": 50
      }
    ]
  }
}
```

All list and detail endpoints use the common `{ "success": true, "message": "...", "data": ... }` response format. Admin tasks include the owner's basic details populated in `userId`.

Example `GET /api/admin/users` response:

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    {
      "_id": "64b000000000000000000001",
      "name": "Sam Example",
      "email": "sam@example.com",
      "role": "user",
      "createdAt": "2026-11-19T07:18:00.000Z"
    }
  ]
}
```

Example `GET /api/admin/tasks` response:

```json
{
  "success": true,
  "message": "Tasks retrieved successfully",
  "data": [
    {
      "_id": "64b000000000000000000101",
      "title": "Prepare report",
      "description": "Review this week's tasks",
      "status": "In Progress",
      "completed": false,
      "userId": {
        "_id": "64b000000000000000000001",
        "name": "Sam Example",
        "email": "sam@example.com",
        "createdAt": "2026-11-19T07:18:00.000Z"
      }
    }
  ]
}
```

### Postman Testing

1. **Register:** `POST {{baseUrl}}/api/auth/register` with name, email, and password. Confirm the returned role is `user`. Try `"role": "admin"` and confirm the API rejects it with `400`.
2. **User login:** `POST {{baseUrl}}/api/auth/login`; save `data.token` as `userToken`.
3. **Admin login:** run `npm run seed:admin`, then log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`; save `data.token` as `adminToken`.
4. **Admin APIs:** set `Authorization` to `Bearer {{adminToken}}` and call each of `GET /api/admin/users`, `/api/admin/users/:id`, `/api/admin/users/:id/tasks`, `/api/admin/tasks`, and `/api/admin/dashboard`.
5. **Role denial:** call an admin endpoint with `Bearer {{userToken}}`; expect `403`.
6. **Unauthenticated denial:** call an admin endpoint without a token (or with an invalid token); expect `401`.
7. **Status changes:** create a task, then use `PUT /api/tasks/:id` with `Pending`, `In Progress`, and `Completed`. Confirm the response's `completed` boolean remains compatible. Also test the existing `PATCH /api/tasks/:id/complete` request.
8. **Dashboard:** compare dashboard counts and percentages against the tasks just created and the individual `users` entries.
9. **Existing task CRUD:** using the user token, test `POST /api/tasks`, `GET /api/tasks`, `GET /api/tasks/:id`, `PUT /api/tasks/:id`, `PATCH /api/tasks/:id/complete`, and `DELETE /api/tasks/:id`. Confirm a different user's task is not returned or modified.

Set `{{baseUrl}}` to `http://localhost:5000`. Keep the `.env` file private; `.env.example` contains placeholders only.

## Automated Tests

The test suite uses Node.js's built-in test runner and does not add dependencies. Unit tests run with:

```bash
npm test
```

HTTP/database integration tests require a dedicated `TEST_MONGODB_URI`. Do not set it to the application or production database. The suite creates a uniquely named `todo_app_test_*` database and drops only that database afterward. If the variable is missing, integration tests are reported as skipped.

In PowerShell, set the test-only URI for the current terminal before running:

```powershell
$env:TEST_MONGODB_URI = "mongodb+srv://<test-user>:<test-password>@<test-cluster>/"
npm test
```

The suite overrides the backend's database name for its child server and admin seed processes; it does not read or modify `.env`.

## Project

To-Do Application – Group 3
