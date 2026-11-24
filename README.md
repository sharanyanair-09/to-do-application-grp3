# to-do-application-grp3
To-Do Application Group Project
About the Project

The To-Do Application is a task management system that helps users organise, manage, and track their daily activities efficiently.

Features

- User Registration and Login
- Add New Tasks
- View All Tasks
- Edit Existing Tasks
- Delete Tasks
- Mark Tasks as Completed
- Task Management

Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB

Project Structure

- "frontend/" – Contains frontend files.
- "backend/" – Contains backend files.
- "database/" – Contains database-related files.

Team Project

This project is developed as part of a group project. 

## Deploy to Render

The root `render.yaml` Blueprint creates a Node.js API and a static frontend. In Render, create a Blueprint from this repository and provide the prompted environment values:

- `MONGODB_URI`: your MongoDB Atlas connection string. Configure Atlas network access to allow connections from Render.
- `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`: the initial admin account details. Use a strong password.
- Render generates `JWT_SECRET` automatically.

After the API deploys, run `npm run seed:admin` from the `backend` directory with the production MongoDB URI and the same `ADMIN_*` values. The frontend build reads the API service hostname from the Blueprint and generates its production API URL; local development continues to use `http://localhost:5000/api`.
