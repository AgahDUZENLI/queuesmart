# QueueSmart Backend (A3)

Node.js + Express. Data is kept in memory in `src/data.js`, so restarting the server resets it.

```bash
cd backend
npm install
npm run dev        # http://localhost:4000
npm test
npm run coverage   # report in coverage/lcov-report/index.html
```

Or run everything from the repo root with `docker compose up -d`.

Demo accounts, places and services are loaded on startup from `src/demo.js`. Demo join codes: `123456` (Student Services Center), `234567` (Main Street Tire Shop), `345678` (Eastside Health Clinic).

## Files

| File | What it does |
|---|---|
| `src/app.js` | Sets up Express and mounts each module's routes |
| `src/server.js` | Starts the server and loads the demo data |
| `src/demo.js` | Demo accounts, places and services |
| `src/data.js` | In-memory data |
| `src/validation.js` | Field checks: required, type, length, email, password |
| `src/auth.js` | Authentication routes plus `requireAuth` / `requireAdmin` |
| `src/places.js` | Places, join codes and users' saved places |
| `src/services.js` | Service management routes |
| `src/queues.js` | Queue tickets, priority ordering, serving and wait estimates |

## Auth API

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/register` | `firstName`, `lastName`, `email`, `password`, `emailMe?`, `role?` (`user` or `admin`), `placeName` (admins only; creates their place) | `201 { user, token }` |
| POST | `/api/auth/login` | `email`, `password`, `role?` | `200 { user, token }` |
| POST | `/api/auth/logout` | | `204` |
| GET | `/api/auth/me` | | `200 { user }` |

## Places API

Each admin runs one place, created when they register. A place's `id` is a random 6-digit number, and that number is also its join code. In A4 it can become the primary key. A user adds a place to their list by typing the code or by scanning the place's QR code. The QR code is just the `joinLink` below, a front-end link with the code in it.

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| GET | `/api/places/code/:code` | anyone | | `200 { place, services }` |
| GET | `/api/places/saved` | signed in | | `200 { places }` |
| POST | `/api/places/saved` | user | `code` | `201 { place, services }` |
| DELETE | `/api/places/saved/:id` | signed in | | `204` |
| GET | `/api/places/mine` | admin | | `200 { place, joinLink }` |

## Services API

Each service belongs to the place of the admin who created it. Admins can only change services at their own place.

**Two kinds of priority.** A service's `priority` decides which queues come first: `GET /api/services` and `GET /api/queues/mine` list High services, then Normal, then Low. Within the same priority, the queue whose first person has waited longest comes first (by join time); queues with nobody waiting go last in their group. Staff see the most urgent, longest-waiting queues at the top, and the order updates as people join and are served. A ticket's `priority` (set by an admin, see Queue API) decides who is served next inside one queue.

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| GET | `/api/services?placeId=` | anyone | | `200 { services }` |
| GET | `/api/services/:id` | anyone | | `200 { service }` |
| POST | `/api/services` | admin | see fields below | `201 { service }` |
| PUT | `/api/services/:id` | admin | only the fields that change | `200 { service }` |
| DELETE | `/api/services/:id` | admin | | `204` |

| Field | Rule | Default |
|---|---|---|
| `name` | required text, max 100 | |
| `description` | required text, max 500 | |
| `duration` | required whole number of minutes, 1–480 | |
| `priority` | required: `Low`, `Normal` or `High` | |
| `maxInLine` | whole number, 1–500 | `25` |
| `status` | `Open`, `Paused` or `Closed` | `Closed` |
| `opens`, `closes` | `HH:MM` time; closes must be after opens | `09:00`, `16:30` |
| `appointments` | `true` / `false` | `false` |

Send the token as `Authorization: Bearer <token>`.

Errors look like `{ "error": "Validation failed.", "fields": { "email": "Email is required." } }`. Status codes: 400 for invalid input, 401 when not signed in or the password is wrong, 403 for the wrong role, 409 when the email is taken.

## Queue API

Users join an open service with `POST /api/queues/:serviceId/join`, view their active ticket and estimate with `GET /api/queues/me`, and leave with `DELETE /api/queues/tickets/:ticketId`. A user can have one active ticket at a time.

Admins can view queues at their place with `GET /api/queues/mine`, call the next person with `POST /api/queues/:serviceId/next`, complete the current ticket with `POST /api/queues/:serviceId/complete`, and mark a no-show with `POST /api/queues/:serviceId/no-show`. Waiting tickets can be reprioritized or reordered within their priority group with `PATCH /api/queues/:serviceId/tickets/:ticketId`, using `{ "priority": "High" }` or `{ "position": 1 }`. New tickets default to `Normal`; equal-priority tickets are served in arrival order.

Wait estimates use the rule `people ahead × minutes per person`. Minutes per person starts each day as the service's `duration` and learns from real visits: it is the average of today's last 5 served visits (time from "Call next" to "Done"), with the set `duration` filling in until 5 visits exist today. Visits from earlier days are ignored, so every morning starts again from the admin's number. No-shows and people who left are not measured.

| Today's served visits (set duration 15) | Minutes per person |
|---|---|
| none | 15 |
| one visit of 5 min | (5 + 15 + 15 + 15 + 15) / 5 = 13 |
| five or more | average of the last 5 real visits only | The estimate for a new arrival includes the currently serving ticket, if any. Estimates, queue counts, `averageDuration` and `measuredVisits` are also included in `GET /api/services?placeId=...` and `GET /api/queues/mine`.

## Adding a module

1. Create `src/<name>.js` with an Express router (see `src/auth.js`).
2. Add your arrays to `data` and `reset()` in `src/data.js`.
3. Mount the router in `src/app.js`: `app.use('/api/<name>', require('./<name>').router)`.
4. Protect routes with `requireAuth` and `requireAdmin` from `src/auth.js`.
5. Add tests in `tests/<name>.test.js`.
