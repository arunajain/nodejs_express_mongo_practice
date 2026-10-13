# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

A practice **Task Manager** REST API built with Node.js + Express 5 + MongoDB (Mongoose), using Redis for short-lived data and Nodemailer for email. Written in TypeScript as **native ESM** (`"type": "module"`).

Built so far: **authentication** (register → email OTP verification → login) and **Task CRUD** scoped to the logged-in user.

## Commands

```bash
npm run dev          # tsx watch src/server.ts (needs MongoDB + Redis + .env)
npm test             # all Jest tests (ESM mode via --experimental-vm-modules)
npm run test:unit    # unit tests only (skips *.int.test.ts)
npm run test:integration  # *.int.test.ts: real app + in-memory MongoDB
npx tsc --noEmit     # type-check (no build script yet)
docker compose up -d # Redis 7 on host port 6380
```

MongoDB is **not** in docker-compose; `MONGODB_URI` must point to an existing instance.

## Environment variables (`.env`, read in `src/config/index.ts`)

`PORT` (default 3001), `NODE_ENV`, `SERVICE_NAME`, `MONGODB_URI`, `MONGODB_USERNAME`, `MONGODB_PASSWORD`,
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `FROM_NAME`, `FROM_ADDRESS`,
`VERIFICATION_EMAIL_SUBJECT`, `VERIFICATION_EMAIL_EXPIRES_IN_MINUTES` (default 15),
`REDIS_HOST`, `REDIS_PORT`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`JWT_ACCESS_EXPIRES_IN` (default `15m`), `JWT_REFRESH_EXPIRES_IN` (default `7d`).

Always import config from `src/config/index.ts`, never read `process.env` directly elsewhere.

## Architecture

Layered: **routes → controller → service → repository / infra services → model**.

```
src/
  server.ts                 # connects Mongo + Redis, then app.listen
  app.ts                    # express app, /health, mounts /api, error middleware
  routes/index.routes.ts    # /api router; mounts /auth  (other.routes.ts is empty)
  auth/
    auth.routes.ts          # POST /register, /verify-email, /resend-otp, /login
    auth.controller.ts      # static methods; zod-parse body, call service, next(err)
    auth.service.ts         # AuthService class (business logic) + default singleton
    token.service.ts        # access/refresh token pair generation & verification
    jwt.service.ts          # thin jsonwebtoken wrapper; maps errors to UnauthorizedError
    auth.type.ts            # token payload types + re-exported zod input types
    auth.service.test.ts    # unit tests for AuthService
  tasks/
    task.routes.ts          # all behind `authenticate`; POST /, GET /, GET/PATCH/DELETE /:id
    task.controller.ts      # zod-parse body/params, getAuthUser(req), call service
    task.service.ts         # TaskService; returns TaskResponseDTO, throws NotFoundError
    task.type.ts            # TaskRecord (DB) / Task (domain) / TaskResponseDTO (API)
    task.mapper.ts          # toTask (record → domain), toTaskResponse (domain → DTO)
  repositories/user.repository.ts  # ALL User DB access goes through here
  repositories/task.repository.ts  # ALL Task DB access; every query scoped by userId
  middleware/auth.middleware.ts    # authenticate (Bearer access token → req.user), getAuthUser
  types/express.d.ts        # adds `user?: AccessTokenPayload` to Express Request
  models/User.ts, Task.ts   # Mongoose schemas
  services/
    redis.service.ts        # generic Redis helpers (get/set/hash/expire)
    pendingRegistration.service.ts  # Redis hash "pending_registration:<email>"
    email.service.ts        # sendEmail / sendVerificationEmail
  validations/auth.validation.ts    # zod schemas; input types inferred from them
  errors/AppError.ts        # AppError + Unauthorized/Forbidden/NotFound/Conflict/Validation/TooManyRequests
  middleware/error.middleware.ts    # AppError → its status, ZodError → 400 with field list, else 500
  templates/emails/         # HTML email templates
  utils/                    # generateOTP (crypto.randomInt), durationToMS ("15m" → ms)
```

### Auth flow

1. **register**: check passwords match and no *verified* user with that email exists → bcrypt hash (12 rounds) → store pending registration in Redis (hash + TTL) → send OTP email fire-and-forget (errors only logged). No Mongo write yet.
2. **verify-email**: load pending registration from Redis, compare OTP → create User with `emailVerified: true` via repository → delete Redis key (only after a successful save, so the user can retry).
3. **resend-otp**: new OTP + reset TTL on the existing Redis hash, re-send email.
4. **login**: `findVerifiedByEmail` + bcrypt compare (same generic error for unknown email or wrong password) → token pair. Refresh token goes into an httpOnly `refreshToken` cookie; access token goes in the `Authorization: Bearer` response header.

## Conventions

- **ESM imports use the `.js` extension** even for `.ts` files (NodeNext resolution). Use `import type` for type-only imports (`verbatimModuleSyntax` is on).
- Strict TS: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- Services that touch the DB take dependencies through the **constructor** (e.g. `new AuthService(userRepository)`) and export a default singleton. Infrastructure services (Redis, email, token) are classes with static methods.
- Validate request bodies in the controller with zod `schema.parse`, and let errors flow to `next(error)`.
- The `User` schema uses lowercase field names `firstname`/`lastname`; API inputs and Redis use `firstName`/`lastName`.
- Emails are stored lowercased and trimmed; the repository normalises emails on lookup.
- **Three types per entity**: DB record (only the repository sees it), domain model (service layer), response DTO (sent to the client). Mappers convert between them; never return Mongoose docs or `_id` from the API.
- **Ownership**: task repository methods take `(id, userId)` and filter on both. Another user's task is treated as not found (404), so its existence isn't revealed.

## Testing

- Jest 30 + `@swc/jest`, config in `jest.config.js`; unit tests live next to the code as `*.test.ts`.
- `jest.setup.js` sets fixed test env vars (JWT secrets) before each file; dotenv never overrides them.
- Integration tests live in `src/tests/integration/*.int.test.ts`. They use supertest against the real `app` and `mongodb-memory-server` (`testDb.ts`), so they never touch the real DB. Insert users directly and sign tokens with `TokenService` to avoid Redis/email.
- Because the project is ESM, `jest.mock` hoisting does not work. Register mocks with `jest.unstable_mockModule(...)` **before** a dynamic `await import(...)` of the module under test.
- Mock I/O (repository, Redis, email, token, config); keep pure code real (bcrypt, generateOTP, AppError, in-memory `new User(...)`).
- `resetMocks` / `restoreMocks` are on, so set default mock behaviour in `beforeEach`.
- Known bugs are documented with `it.failing(...)`. When one gets fixed, change it to a normal `it`.

## Current status (as of 2026-10-11)

**Done**
- Project setup: TypeScript, Express 5, Mongoose, Redis client, Nodemailer, dotenv config, docker-compose for Redis
- User model + `UserRepository`, which keeps all DB calls out of the service layer
- Central error handling (`AppError` hierarchy + error middleware with zod support)
- Auth: register, verify email (OTP via Redis + email), resend OTP, login with JWT access + refresh tokens
- HTML email templates
- Task CRUD (`/api/tasks`) with zod validation, repository → domain → DTO mapping, and owner-only read/update/delete
- `authenticate` middleware for access tokens
- Tests: 88 passing. Unit tests for AuthService, TaskService, task mapper, task validation and auth middleware; integration tests for `/api/tasks` (auth, validation, ownership); `tsc --noEmit` is clean

**Not done yet / next steps**
- RBAC: `authorize(...roles)` middleware; admin-only user deletion
- Pagination/filtering for `GET /api/tasks`; integration tests for `/api/auth` (needs Redis or a mock for it)
- Refresh-token endpoint, logout, forgot/reset password
- Wire up the installed but unused `cors`, `helmet`, `cookie-parser` packages in `app.ts`
- Rate limiting for OTP and login (`TooManyRequestsError` exists but isn't used)
- Unique index on `User.email`; use Mongoose `timestamps` instead of the manual `createdAt`/`updatedAt` fields
- `build` / `start` scripts; MongoDB service in docker-compose; README

**Known issues**
- `login` builds the token name as `firstname + " " + lastname`, which gives `"John null"` when there is no last name (covered by an `it.failing` test)
- `verifyEmail` / `resendOtp` use the email as given in the request for the Redis key, but `register` stores the key lowercased. A mixed-case email on verify/resend won't find the pending registration.
- `AppError` defaults to status **500**, so business errors such as "Passwords do not match", "Email already exists", "Invalid OTP" and "Invalid email or password" return 500. They should use 400/409/401 (or the subclasses).
