# Writing unit and integration tests: steps

Practice notes for how the Jest tests were added for the Task feature and the auth middleware.
Each step says what was done and why, plus the problems hit along the way.

Order followed: **install tools → test setup → unit tests → fix the bug the tests found → integration tests → type-check → run everything**

---

## Step 1: Install test tools

```bash
npm install -D supertest @types/supertest mongodb-memory-server
```

- **supertest**: sends real HTTP requests to the Express `app` without starting a server on a port.
- **mongodb-memory-server**: starts a temporary MongoDB in memory, so tests never touch the real database.
  The first run downloads a `mongod` binary, which is slow once and then cached.

Jest, `@swc/jest` and `@jest/globals` were already installed.

---

## Step 2: Test setup

### 2a. Fixed environment variables: `jest.setup.js` (project root)

```js
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.DOTENV_CONFIG_QUIET = "true";
```

**Why:** `config/index.ts` reads `.env` through dotenv. dotenv **never overrides** variables that are already set,
so setting them first means tests use these values on every machine, not whatever is in a developer's `.env`.
`DOTENV_CONFIG_QUIET` hides dotenv's "injected env" log in the test output.

### 2b. Register it in `jest.config.js`

```js
setupFiles: ["<rootDir>/jest.setup.js"],
```

`setupFiles` runs **before each test file, before its imports**, so the config already sees these values.

### 2c. Separate scripts in `package.json`

```json
"test:unit": "... jest.js --testPathIgnorePatterns \"\\\\.int\\\\.test\\\\.ts$\"",
"test:integration": "... jest.js --testPathPatterns \"\\\\.int\\\\.test\\\\.ts$\""
```

Naming rule: **unit** tests are `*.test.ts` next to the code; **integration** tests are `*.int.test.ts`.
Note that Jest 30 uses `--testPathPatterns` (plural).

---

## Step 3: Unit tests

**What makes a test a unit test:** it tests one piece in isolation. Anything that does I/O (database, Redis, email, JWT secrets) is mocked.
Pure code (mappers, zod, bcrypt, error classes) stays real.

### 3a. Mapper tests: `src/tasks/task.mapper.test.ts`

Pure functions, so **nothing is mocked**.
- Built a fake `TaskRecord` with `new Types.ObjectId()` and fixed dates.
- `toTask`: ObjectIds become strings, `due_date` becomes `dueDate`, and missing or `null` optional fields become `null`.
- `toTaskResponse`: dates become ISO strings and the result has **no `userId`** (`not.toHaveProperty("userId")`).

### 3b. Validation tests: `src/validations/task.validation.test.ts`

No mocks. Used **`safeParse`** instead of `parse`: it returns `{ success, data, error }` instead of throwing, which keeps the assertions short.
- Small helper `messagesOf(error)` to collect error messages.
- **`it.each([...])`** runs the same test for many bad inputs (empty title, title too long, bad date, …), with less copy-paste.
- Checked trimming, the date string becoming a `Date`, `null` being allowed on update but not on create, the empty update body, and bad ids.

### 3c. Service tests: `src/tasks/task.service.test.ts`

- **Mocked the repository through the constructor.** No module mocking is needed because `TaskService` receives its repository:
  ```ts
  function createTaskRepositoryMock() {
    return {
      create: jest.fn<TaskRepository["create"]>(),
      ...
    } satisfies TaskRepository;   // compile error if a method is missing
  }
  taskService = new TaskService(taskRepository);
  ```
- Fresh mock in `beforeEach` (the config has `resetMocks: true`).
- Tested that:
  - the caller's `userId` is always passed to the repository (`toHaveBeenCalledWith(TASK_ID, USER_ID)`)
  - the service returns the **DTO**, not the domain model
  - `null` / `false` from the repository → `NotFoundError("Task not found")`
  - repository errors are passed through unchanged

**Note:** the unit test can't prove the DB query really filters by owner. That is the job of the integration test.

### 3d. Middleware tests: `src/middleware/auth.middleware.test.ts`

- The middleware **imports** `TokenService` directly (it isn't injected), so it needs **module mocking**.
- This project is ESM, so `jest.mock()` hoisting doesn't work. Use:
  ```ts
  jest.unstable_mockModule("../auth/token.service.js", () => ({ default: tokenServiceMock }));
  const { authenticate, getAuthUser } = await import("./auth.middleware.js"); // AFTER the mock
  ```
- Fake `req` with only `headers`, an empty `res`, and `next` as a `jest.fn()`.
- Cases: valid Bearer token → `req.user` set and `next()` called with no error; missing header / empty / `Basic …` / lowercase `bearer` → `next(UnauthorizedError)`; verify throws → error passed to `next`.

### Run them

```bash
npm run test:unit
```

---

## Step 4: The tests found a real bug, so fix the code (not the test)

The first run had **8 failures**, all of this form:

```
Expected constructor: NotFoundError
Received constructor: AppError
```

**Cause**, in `src/errors/AppError.ts`:

```ts
Object.setPrototypeOf(this, AppError.prototype);   // ❌ every subclass becomes a plain AppError
```

**Fix:**

```ts
Object.setPrototypeOf(this, new.target.prototype); // ✅ new.target = the class actually created
this.name = new.target.name;
```

**Lesson:** when a test fails, first decide whether the **test** or the **code** is wrong.
Here the code was wrong. Status codes still worked because the middleware only checks `instanceof AppError`, which hid the bug.

After the fix, the unit tests passed (67).

---

## Step 5: Integration tests

**What makes a test an integration test:** many real pieces working together.
Here that is Express → middleware → zod → service → repository → Mongoose → error middleware.
Only the database is swapped for an in-memory one.

### 5a. Database helper: `src/tests/integration/testDb.ts`

```ts
connectTestDb()     // MongoMemoryServer.create() + mongoose.connect(uri)
clearTestDb()       // deleteMany({}) on every collection
disconnectTestDb()  // mongoose.disconnect() + mongod.stop()
```

### 5b. Test file: `src/tests/integration/tasks.int.test.ts`

Lifecycle:
```ts
beforeAll(connectTestDb, 120_000);   // long timeout: first run downloads mongod
afterEach(clearTestDb);              // each test starts with an empty DB
afterAll(disconnectTestDb);          // otherwise Jest hangs on open handles
```

How users are set up (no Redis, no email):
- Insert the user directly with `User.create({... emailVerified: true })`.
- Make a real token with `TokenService.generateAccessToken(...)`, signed with the test secret from `jest.setup.js`.
- Two users, **alice** and **bob**, to test ownership.

How requests are made:
```ts
await request(app)
  .post("/api/tasks")
  .set("Authorization", `Bearer ${alice.token}`)
  .send({ title: "Buy milk" });
```

What was tested (grouped by route):
- **Auth:** no token → 401; garbage token → 401; token signed with another secret → 401.
- **POST:** 201 and the exact response shape; **no `_id`, `userId`, `due_date`, `__v` in the response**;
  the DB record really has alice's `userId`; a `userId` sent in the body is ignored; bad input → 400 with field errors and nothing saved.
- **GET list:** alice sees only her tasks, newest first; bob with no tasks gets `[]`.
- **GET one:** own task → 200; bob reading alice's task → **404**; unknown id → 404; `abc` → **400** (not a 500 CastError).
- **PATCH:** only the sent fields change; `null` really **removes** the field in MongoDB; bob can't change alice's task (404, and the DB is unchanged); empty body → 400.
- **DELETE:** own task → 204 and gone from the DB; bob → 404 **and alice's task still exists**; deleting twice → 204, then 404.

**Tip:** for ownership tests, don't only check the status code. Also **read the DB** to prove nothing changed.

### Run them

```bash
npm run test:integration
```

Result: 21 passed.

---

## Step 6: Type-check the tests too

```bash
npx tsc --noEmit
```

Jest with SWC **does not type-check**, so tests can pass while TypeScript errors still exist.

### Problem hit

```
Argument of type 'Mock<NextFunction>' is not assignable to parameter of type 'NextFunction'.
```

Express's `NextFunction` has **overloads**, and `jest.Mock` can only model one signature.
**Fix:** mock a plain function and cast it once in a small helper:

```ts
let next: jest.Mock<(error?: unknown) => void>;
const run = (req: Request) => authenticate(req, res, next as unknown as NextFunction);
```

---

## Step 7: Run everything

```bash
npx tsc --noEmit   # no output = OK
npm test           # 6 suites, 88 tests passed
```

---

## Unit vs integration (quick recap)

| | Unit | Integration |
|---|---|---|
| Scope | one function/class | the whole request path |
| Database | mocked | real (in-memory) MongoDB |
| Speed | very fast | slower (starts mongod) |
| Proves | logic and branches | pieces really work together (queries, routes, status codes) |
| File name | `*.test.ts` next to the code | `src/tests/integration/*.int.test.ts` |

---

## Practice exercises

1. Write unit tests for `durationToMS` and `generateOTP` in `src/utils` (pure functions, no mocks).
2. Write unit tests for `error.middleware.ts`: an `AppError` → its status, a `ZodError` → 400 with field list, anything else → 500.
3. Integration test for `POST /api/auth/login`: insert a verified user with a bcrypt hash and check the cookie and `Authorization` header.
   (Register/verify need Redis, so try mocking `pendingRegistration.service.js` with `unstable_mockModule`.)
4. Add a test that an **expired** token returns 401. Hint: sign with `expiresIn: "1s"` and wait, or use `jest.useFakeTimers()`.
5. Run `npx jest --coverage` and find lines that no test reaches.
