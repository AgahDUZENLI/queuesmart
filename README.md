# QueueSmart

QueueSmart is a smart queue management web application designed to help organizations — student service centers, clinics, advising offices, help desks — manage long queues and give people clear visibility into wait times.

Built as a semester-long group project for **COSC 4353 - Software Design**.

## The Problem

Many organizations struggle with long queues and poor visibility into wait times. Users often don't know how long they'll wait, and staff have limited tools to manage demand efficiently.

## What QueueSmart Does

**For Users**
- Add a place by its 6-digit join code or QR code, then join one of its queues
- See their position and an estimated wait that counts down live
- Get notified when they join, when they are next, when they are called, and if their service is cancelled (plus a mock email if they opted in)
- See their past visits in History

**For Administrators**
- Create, edit, pause and delete services (name, duration, priority, hours, line limit). Deleting asks for confirmation, says how many people are in line, and notifies them
- Run live queues: call next, mark done or no-show, raise a ticket's priority, reorder or remove people
- See every visit in History with totals
- **Reports**: filter by date range and service, see customers, services and usage statistics, download as **CSV** or **Print / Save as PDF**

## Smart Features

- **Wait estimates that learn.** Each service starts the day at the admin's set duration, then uses the average of today's last 5 real visits (time from "Call next" to "Done"). A 15-minute service whose visits actually take 9 minutes gets shorter, more accurate estimates within the day. Estimates also count down while the current person is being served.
- **Priority-based queue handling.** High priority services and the longest-waiting queues are listed first for staff, and High priority tickets are served before Normal ones within a queue.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (schema in [backend/db/schema.sql](./backend/db/schema.sql))
- **Tests:** Jest + Supertest, with [pg-mem](https://github.com/oguimbal/pg-mem) running the real schema in memory
- **Runs with:** Docker Compose (frontend, backend, database)

Full API reference: [backend/README.md](./backend/README.md).

## Project Status

| Assignment | Focus | Status |
|---|---|---|
| [A1](./docs/assignment-1/A1.md) | Initial Thoughts & System Design | ✅ Complete |
| [A2](./docs/assignment-2/A2_QueueSmart.docx) | UI/UX Design (React front end) | ✅ Complete |
| [A3](./docs/assignment-3/A3_QueueSmart.pdf) | Back-End & API (Express, Jest tests) | ✅ Complete |
| [A4](./docs/assignment-4/A4_QueueSmart.pdf) | Data Design & Persistence (PostgreSQL) | ✅ Complete |
| Final | Reports, smart features, full integration & demo | ✅ Built, demo pending |

## Running It

```bash
docker compose up -d --build                  # front end at http://localhost:5173, API at http://localhost:4000
docker compose exec backend npm run seed      # optional: six weeks of example data (run once)
```

```bash
cd backend && npm install && npm test         # backend tests
cd backend && npm run coverage                # coverage report in backend/coverage/
```

To start over with an empty database: `docker compose down -v && docker compose up -d` (this deletes all data), then seed again.

The backend runs on Houston time (`TZ=America/Chicago` in `docker-compose.yml`). That decides what "today" means for wait estimates and report date filters. After changing it, run `docker compose up -d backend`.

**Demo accounts** (password `demo-pass-123` for all): admin `admin@queuesmart.test`; users `user@queuesmart.test` (Maya Robinson), `user2@queuesmart.test`, `user3@queuesmart.test`, `user4@queuesmart.test`. The sign-in pages have "Sign in as demo" buttons. Join codes: `123456` (Student Services Center), `234567` (Main Street Tire Shop), `345678` (Eastside Health Clinic). The seed adds 17 more users; see [Example data](./backend/README.md#example-data-seed).

## Team

| Name |
|---|
| Agah Duzenli |
| Dang Nguyen |
| Derek F Lihou |
| Skyler Tran |
