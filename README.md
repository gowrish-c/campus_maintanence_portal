# Campus Maintenance Portal

A Web Technology Lab project built with Flask, HTML, CSS, JavaScript and Supabase PostgreSQL.

## Features

### Student
- Register and login
- Submit campus maintenance problems
- View submitted requests
- Track request status
- View admin comments
- Dashboard updates automatically every 3 seconds

### Admin
- Login using an admin account
- View all maintenance requests
- Approve or reject requests
- Assign a request to a maintenance team
- Update request status
- Add comments
- Dashboard updates automatically every 3 seconds

## Technology

- Python Flask
- HTML5
- CSS3
- JavaScript Fetch API
- Supabase PostgreSQL
- Vercel

## 1. Create Supabase database

1. Create a project in Supabase.
2. Open SQL Editor.
3. Copy and run `database/schema.sql`.
4. Get the project URL and API key from the Supabase project settings.

## 2. Configure locally

Create a `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-key
SECRET_KEY=your-random-secret
```

Install:

```bash
pip install -r requirements.txt
```

Run:

```bash
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

## 3. Create an admin account

The safest lab setup is:

1. Register through `/register`.
2. In Supabase SQL Editor run:

```sql
update public.users
set role = 'admin'
where email = 'your-email@example.com';
```

3. Log out and log in again.

For your lab demonstration, you can create one admin account and several student accounts.

## 4. GitHub

```bash
git init
git add .
git commit -m "Initial Campus Maintenance Portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/campus-maintenance-portal.git
git push -u origin main
```

Do NOT commit `.env`.

## 5. Vercel

Import the GitHub repository into Vercel.

Add these environment variables in Vercel:

```text
SUPABASE_URL
SUPABASE_KEY
SECRET_KEY
```

Then deploy.

The application does not write database files or application data to Vercel's filesystem. All persistent data is stored in Supabase PostgreSQL.

## Automatic updates

The dashboards call the API every 3 seconds. Therefore, when an admin changes a request, the student's dashboard automatically retrieves the new database state without requiring a manual page refresh.

For a lab project this is simple and reliable. Supabase Realtime can be added later if true WebSocket-based updates are required.
