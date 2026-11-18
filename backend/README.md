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
- Password Hashing
- JWT Authentication
- Create Tasks
- View All Tasks
- Update Tasks
- Mark Tasks as Completed
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
│   ├── authRoutes.js
│   └── taskRoutes.js
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

### 4. Configure Environment Variables

Create a `.env` file in the backend folder and add:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_random_secret_key
PORT=5000
```

Replace the values with your own credentials.

**Note:** Never upload your `.env` file or share your database credentials.

### 5. Start the Server

```bash
npm run dev
```

The backend server will run at:

`http://localhost:5000`

## API Endpoints

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
| PATCH | `/api/tasks/:id/complete` | Update task completion status |
| DELETE | `/api/tasks/:id` | Delete a task |

**Authentication:** All task endpoints require a valid JWT Bearer token.

## API Testing

All backend APIs were tested using Postman.

## Project

To-Do Application – Group 3