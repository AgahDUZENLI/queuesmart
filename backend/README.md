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

## Adding a module

1. Create `src/<name>.js` with an Express router (see `src/auth.js`).
2. Add your arrays to `data` and `reset()` in `src/data.js`.
3. Mount the router in `src/app.js`: `app.use('/api/<name>', require('./<name>').router)`.
4. Protect routes with `requireAuth` and `requireAdmin` from `src/auth.js`.
5. Add tests in `tests/<name>.test.js`.
