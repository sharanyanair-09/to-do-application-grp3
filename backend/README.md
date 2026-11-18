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
```

Replace the MongoDB connection string with your own MongoDB Atlas connection string and use the generated JWT secret key.

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