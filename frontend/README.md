# Daymark frontend

The frontend is a static HTML/CSS/JavaScript app and uses the backend in `../backend` for sign-in and task storage.

## Run it

1. Configure `backend/.env` and start the API with `npm run dev` from the `backend` directory. The default API address is `http://localhost:5000/api`.
2. Serve this folder over HTTP (for example, run `python -m http.server 8080` from `frontend`, then visit `http://localhost:8080`). The API address is configured internally in `app.js`.
3. Users can create an account from **User login**. Public registration always creates a regular user.
4. Create the admin account using the backend's `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` settings, then run `npm run seed:admin` from `backend`. Sign in through **Admin login** with those credentials.

The admin workspace reads the protected `/api/admin/dashboard`, `/api/admin/users`, `/api/admin/users/:id/tasks`, and `/api/admin/tasks` endpoints. User task requests use the authenticated `/api/tasks` endpoints, which assign tasks to the signed-in user. The backend enforces role access; the separate login screens are not the security boundary.
