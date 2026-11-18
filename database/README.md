Database – To-Do Application

Database Technology

MongoDB Atlas (Cloud Database)

Database Name

"todo_app"

Collections

1. users

Stores user account information, including:

- User ID
- Name
- Email
- Password Hash
- Created At

2. tasks

Stores task information, including:

- Task ID
- User ID
- Task Title
- Description
- Due Date
- Status
- Priority
- Created At
- Updated At

Purpose

The database stores user information and task details securely and allows users to manage their tasks.

Security

- Passwords must be stored as secure hashes.
- Users should only access their own tasks.
- Database credentials must be stored in environment variables and never committed to GitHub. 
