# Task CRUD: how it was built, step by step

Practice notes for adding Task CRUD (create, read, update, delete) to this project.
Each step lists the file, what was done, and **why**. The "Problems hit" sections are real errors from building it.

Order followed: **model → types → zod validator → mapper → repository → service → auth middleware → controller → routes → verify**

---

## Step 0: Check library versions before writing code

```bash
node -p "require('mongoose/package.json').version"   # 9.10.3
grep -n "returnDocument\|new?:" node_modules/mongoose/types/query.d.ts
```

**Why:** Mongoose 9 deprecates the `{ new: true }` option on `findOneAndUpdate`.
Use `{ returnDocument: "after" }` instead.
(`UserRepository.updateById` still uses `new: true`. Updating it is a good exercise.)

---

## Step 1: Fix and export the model ([src/models/Task.ts](../src/models/Task.ts))

Changes:

- Removed the unused `import { ref } from "node:process"` and the unused `User` import.
- Added `index: true` on `userId`, because every task query filters by owner.
- Exported the model: `export default Task` (it wasn't exported before).
- Exported the **DB record type**:

```ts
export type TaskRecord = InferSchemaType<typeof taskSchema> & {
  _id: Types.ObjectId;
};
```

**Why:** `InferSchemaType` derives the type from the schema, so the two can't drift apart.
`_id` is added manually because `InferSchemaType` doesn't include it.

---

## Step 2: Write the types ([src/tasks/task.type.ts](../src/tasks/task.type.ts))

There are three shapes of the same task, one per layer:

| Type              | Used by              | Looks like                                                                      |
| ----------------- | -------------------- | ------------------------------------------------------------------------------- |
| `TaskRecord`      | repository only      | `_id: ObjectId`, `userId: ObjectId`, `due_date`, optional fields may be missing |
| `Task` (domain)   | service              | `id: string`, `userId: string`, `dueDate: Date \| null`, camelCase              |
| `TaskResponseDTO` | sent to the frontend | no `userId`, dates as ISO strings                                               |

There are also two repository input types:

- `NewTaskData`: what's needed to create a task.
- `TaskChanges`: fields to update. `undefined` = don't touch, `null` = clear.

**Why:** the frontend should never see DB details (`_id`, `due_date`, ObjectIds, Mongoose internals).
If the DB schema changes later, only the repository and mapper need to change.

**Note on `exactOptionalPropertyTypes`** (enabled in tsconfig): `field?: string` does **not** accept an explicit `undefined`.
Zod output types are `field?: string | undefined`, so the repository input types must also say `| undefined`.

---

## Step 3: Write the zod validator ([src/validations/task.validation.ts](../src/validations/task.validation.ts))

- `createTaskSchema`: `title` required (trimmed, 1–200 characters); `description` optional (max 2000); `dueDate` optional.
- `updateTaskSchema`: all fields optional; `description` and `dueDate` are `.nullable()` so the client can send `null` to clear them.
  `.refine(...)` rejects an empty body `{}`.
- `taskIdParamSchema`: `id` must match `/^[0-9a-fA-F]{24}$/`.
- Types inferred with `z.infer<typeof schema>`, the same pattern as `auth.validation.ts`.

**Why validate the id?** Without it, `findOne({ _id: "abc" })` throws a Mongoose `CastError`.
The error middleware doesn't know that error, so the client would get a **500** instead of a **400**.

**Why `z.coerce.date()`?** JSON has no date type, so the client sends a string like `"2026-12-01"`.
Coerce turns it into a `Date`, and an invalid string fails with the custom message.

---

## Step 4: Write the mapper ([src/tasks/task.mapper.ts](../src/tasks/task.mapper.ts))

```ts
toTask(record: TaskRecord): Task                 // DB → domain   (used in the repository)
toTaskResponse(task: Task): TaskResponseDTO      // domain → API  (used in the service)
```

- `_id.toString()`, `userId.toString()`: ObjectId → string.
- `record.description ?? null`: a missing or undefined field → `null` (the domain never uses `undefined`).
- `toISOString()`: Date → string for JSON.
- `userId` is **dropped** in the DTO.

---

## Step 5: Write the repository ([src/repositories/task.repository.ts](../src/repositories/task.repository.ts))

**Main rule:** every single-task query filters by **both** `_id` and `userId`:

```ts
TaskModel.findOne({ _id: id, userId })
TaskModel.findOneAndUpdate({ _id: id, userId }, ...)
TaskModel.deleteOne({ _id: id, userId })
```

This is how "only the owner can delete their task" is enforced. Someone else's task simply isn't found.
Doing it in one query is safer than "find the task, then check the owner in JS", which is two steps and easy to forget.

Other details:

- `.lean<TaskRecord>()` returns plain objects instead of Mongoose documents, which is faster and maps cleanly.
- `create` uses `TaskModel.create(...)`, then `doc.toObject()`, then `toTask(...)`.
- `update` builds `$set` only from defined fields, and builds `$unset` for fields set to `null`.
  `$unset` is only sent when it isn't empty.
- `updatedAt` is set manually on update (the schema doesn't use Mongoose `timestamps` yet).
- `delete` returns `boolean` (`deletedCount === 1`).
- Methods return the **domain `Task`**, never `TaskRecord`.

### Problems hit

1. **`exactOptionalPropertyTypes` vs Mongoose types**

   ```
   Type 'string | undefined' is not assignable to type 'string | RegExp | null'
   ```

   Passing `description: data.description ?? undefined` to `TaskModel.create` failed.
   **Fix:** use `?? null`. Mongoose accepts `null` for optional fields.

2. That error also caused the follow-on error `Property 'toObject' does not exist on type 'never'`.
   Fixing the first error fixed this one too. Always fix the **first** TypeScript error first.

---

## Step 6: Write the service ([src/tasks/task.service.ts](../src/tasks/task.service.ts))

- `TaskService` class takes `TaskRepository` in its **constructor** (same pattern as `AuthService`), so tests can pass a fake repository.
- Exports a default singleton: `new TaskService(new TaskRepository())`.
- Methods: `createTask`, `getTasks`, `getTask`, `updateTask`, `deleteTask`. Each takes `userId` first.
- Converts domain → DTO with `toTaskResponse`.
- If the repository returns `null` or `false`, it throws `NotFoundError("Task not found")` (404).

**Why 404 and not 403 for someone else's task?** A 403 would tell an attacker "this task id exists, it just isn't yours."
A 404 reveals nothing.

---

## Step 7: Write the authentication middleware ([src/middleware/auth.middleware.ts](../src/middleware/auth.middleware.ts))

Task routes need to know **who** is calling, and nothing did that yet.

- `authenticate(req, res, next)`: reads `Authorization: Bearer <token>`, verifies it with `TokenService.verifyAccessToken`, and sets `req.user`.
  A missing or bad token goes to `next(error)`, which returns 401.
- `getAuthUser(req)`: returns `req.user` or throws 401. This avoids writing `req.user!` everywhere.

Express's `Request` type has no `user` field, so it's added with **declaration merging** in [src/types/express.d.ts](../src/types/express.d.ts):

```ts
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}
export {}; // makes the file a module, so `declare global` works
```

---

## Step 8: Write the controller ([src/tasks/task.controller.ts](../src/tasks/task.controller.ts))

The same pattern as `AuthController`, for every handler:

```ts
try {
  const { userId } = getAuthUser(req);
  const { id } = taskIdParamSchema.parse(req.params);   // when there's an :id
  const inputData = createTaskSchema.parse(req.body);   // when there's a body
  const task = await taskService.xxx(userId, ...);
  res.status(...).json({ task });
} catch (error) {
  next(error);  // AppError / ZodError handled by error.middleware
}
```

Status codes: create **201**, read/update **200**, delete **204** (no body).

---

## Step 9: Add the routes ([src/tasks/task.routes.ts](../src/tasks/task.routes.ts) and [src/routes/index.routes.ts](../src/routes/index.routes.ts))

```ts
router.use(authenticate); // protects every route below
router.post("/", TaskController.create);
router.get("/", TaskController.getAll);
router.get("/:id", TaskController.getOne);
router.patch("/:id", TaskController.update);
router.delete("/:id", TaskController.delete);
```

Mounted in `index.routes.ts` with `router.use("/tasks", taskRoutes)`, so the full path is `/api/tasks`.

PATCH (not PUT) is used because the client sends only the fields it wants to change.

---

## Step 10: Verify

```bash
npx tsc --noEmit   # type-check: no output = OK
npm test           # existing tests still pass (23)
```

A small throwaway script was run with `npx tsx` to try the zod schemas and mappers with sample input:

- `{ title: "  Buy milk ", dueDate: "2026-12-01" }` → trimmed title, Date parsed ✅
- `{ title: "" }` → "Title is required" ✅
- `{ dueDate: "not-a-date" }` → "Due date must be a valid date" ✅
- update `{}` → "At least one field must be provided" ✅
- `id: "abc"` → "Invalid task id" ✅
- mapper output has no `userId` and uses ISO date strings ✅

**Not done yet:** running against a real MongoDB, and unit tests for `TaskService`.

### Manual test with curl (once the server is running)

```bash
# 1. Log in and copy the access token from the Authorization response header
curl -i -X POST localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"Secret@123"}'

TOKEN=...   # paste it here

curl -X POST localhost:3001/api/tasks -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"title":"Buy milk","dueDate":"2026-12-01"}'
curl localhost:3001/api/tasks -H "Authorization: Bearer $TOKEN"
curl -X PATCH localhost:3001/api/tasks/<id> -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"description":null}'
curl -i -X DELETE localhost:3001/api/tasks/<id> -H "Authorization: Bearer $TOKEN"
```

To test ownership, log in as a **second** user and try to GET or DELETE the first user's task id. You should get **404**.

---

## Practice exercises

1. Write `src/tasks/task.service.test.ts`, mocking `TaskRepository` through the constructor (copy the approach in `auth.service.test.ts`).
2. Add pagination to `GET /api/tasks` (`?page=1&limit=20`) with a zod query schema.
3. Add a `completed: boolean` field. Change the model, types, mapper, validator and DTO. Notice how many layers one field touches.
4. Switch the Task schema to Mongoose `timestamps: true` and remove the manual `updatedAt`.
5. RBAC: write `authorize(...roles)` middleware that checks `req.user.role`, and use it for an admin-only `DELETE /api/users/:id`.

---

npm install -D supertest @types/supertest mongodb-memory-server 2>&1 | tail -5

implementing test after that
