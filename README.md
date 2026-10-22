# QueueSmart

QueueSmart is a smart queue management web application designed to help organizations — student service centers, clinics, advising offices, help desks — manage long queues and give people clear visibility into wait times.

Built as a semester-long group project for **COSC 4353 - Software Design**.

## The Problem

Many organizations struggle with long queues and poor visibility into wait times. Users often don't know how long they'll wait, and staff have limited tools to manage demand efficiently.

## What QueueSmart Does

**For Users**
- Join a queue or book an appointment
- View current position and estimated wait time (learned from how long today's visits actually take)
- Receive notifications as their turn approaches

**For Administrators**
- Create and manage services (name, duration, priority level — High-priority services and longest-waiting queues are listed first)
- Monitor active queues in real time
- View usage statistics and queue history

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express, in-memory data (see [backend/README.md](./backend/README.md))
- **Tests:** Jest + Supertest
- **Database:** TBD (A4)

## Project Status

This project is being built incrementally across a series of assignments:

| Assignment | Focus | Status |
|---|---|---|
| [A1](./docs/assignment-1/A1.md) | Initial Thoughts & System Design | ✅ Complete |
| [A2](./docs/assignment-2/A2_QueueSmart.docx) | UI/UX Design (React front end) | ✅ Complete |
| [A3](./backend/README.md) | Back-End & API (Express, in-memory data, Jest tests) | 🚧 In progress |
| A4 | Data Design & Persistence | 🔲 Not started |
| Final | Full Implementation & Demo | 🔲 Not started |

## Running It

```bash
docker compose up -d --build      # front end at http://localhost:5173, API at http://localhost:4000
cd backend && npm install && npm test        # backend unit tests
cd backend && npm run coverage               # coverage report in backend/coverage/
```

Demo accounts: `user@queuesmart.test` and `admin@queuesmart.test`, both with password `demo-pass-123`. The sign-in pages also have "Sign in as demo" buttons.

## Team

| Name |
|---|
| Agah Duzenli |
| Dang Nguyen |
| Derek F Lihou |
| Skyler Tran |