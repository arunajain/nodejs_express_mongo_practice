/**
 * Integration tests for /api/tasks.
 *
 * Everything is REAL here: Express app, routes, authenticate middleware,
 * zod validation, service, repository, Mongoose and the error middleware.
 * Only the database is swapped for an in-memory MongoDB (see testDb.ts).
 *
 * Users are inserted directly and their access tokens are signed with
 * TokenService, so these tests don't depend on Redis or email.
 * JWT secrets come from jest.setup.js.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "@jest/globals";
import request from "supertest";
import { Types } from "mongoose";
import app from "../../app.js";
import User from "../../models/User.js";
import Task from "../../models/Task.js";
import TokenService from "../../auth/token.service.js";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./testDb.js";

interface TestUser {
  id: string;
  token: string;
}

async function createUser(email: string): Promise<TestUser> {
  const user = await User.create({
    firstname: "Test",
    lastname: "User",
    email,
    password: "not-used-in-these-tests",
    emailVerified: true,
  });
  const id = user._id.toString();
  const token = TokenService.generateAccessToken({
    userId: id,
    email,
    name: "Test User",
    role: "user",
  });
  return { id, token };
}

// Creates a task through the API, the way a real client would
async function createTask(user: TestUser, body: object) {
  const res = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${user.token}`)
    .send(body);
  expect(res.status).toBe(201);
  return res.body.task as { id: string; title: string };
}

describe("Tasks API (integration)", () => {
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    await connectTestDb();
  }, 120_000); // first run may download the mongod binary

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // Fresh users for every test (afterEach wipes the DB)
  const setupUsers = async () => {
    alice = await createUser("alice@example.com");
    bob = await createUser("bob@example.com");
  };

  // -------------------------------------------------------------------------
  describe("authentication", () => {
    it("returns 401 when no token is sent", async () => {
      const res = await request(app).get("/api/tasks");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Access token is missing" });
    });

    it("returns 401 for an invalid token", async () => {
      const res = await request(app)
        .get("/api/tasks")
        .set("Authorization", "Bearer not-a-real-token");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Invalid Token" });
    });

    it("returns 401 for a token signed with a different secret", async () => {
      const { default: jwt } = await import("jsonwebtoken");
      const forged = jwt.sign({ userId: "x" }, "some-other-secret");

      const res = await request(app)
        .get("/api/tasks")
        .set("Authorization", `Bearer ${forged}`);

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  describe("POST /api/tasks", () => {
    it("creates a task and returns only public fields", async () => {
      await setupUsers();

      const res = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${alice.token}`)
        .send({
          title: "  Buy milk ",
          description: "2 litres",
          dueDate: "2026-12-01",
        });

      expect(res.status).toBe(201);
      expect(res.body.task).toEqual({
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        title: "Buy milk",
        description: "2 litres",
        dueDate: "2026-12-01T00:00:00.000Z",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      // No DB fields leak to the client
      expect(res.body.task).not.toHaveProperty("_id");
      expect(res.body.task).not.toHaveProperty("userId");
      expect(res.body.task).not.toHaveProperty("due_date");
      expect(res.body.task).not.toHaveProperty("__v");
    });

    it("stores the task in MongoDB owned by the caller", async () => {
      await setupUsers();

      const task = await createTask(alice, { title: "Buy milk" });

      const record = await Task.findById(task.id).lean();
      expect(record?.userId.toString()).toBe(alice.id);
      expect(record?.title).toBe("Buy milk");
    });

    it("ignores a userId sent in the body (cannot create tasks for others)", async () => {
      await setupUsers();

      const task = await createTask(alice, {
        title: "Sneaky",
        userId: bob.id,
      });

      const record = await Task.findById(task.id).lean();
      expect(record?.userId.toString()).toBe(alice.id);
    });

    it("returns 400 with field errors for invalid input", async () => {
      await setupUsers();

      const res = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${alice.token}`)
        .send({ title: "", dueDate: "not-a-date" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation Error");
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          { field: "title", message: "Title is required" },
          { field: "dueDate", message: "Due date must be a valid date" },
        ]),
      );
      await expect(Task.countDocuments()).resolves.toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("GET /api/tasks", () => {
    it("returns only the caller's tasks, newest first", async () => {
      await setupUsers();
      await createTask(alice, { title: "Alice first" });
      await createTask(bob, { title: "Bob's task" });
      await createTask(alice, { title: "Alice second" });

      const res = await request(app)
        .get("/api/tasks")
        .set("Authorization", `Bearer ${alice.token}`);

      expect(res.status).toBe(200);
      expect(res.body.tasks.map((t: { title: string }) => t.title)).toEqual([
        "Alice second",
        "Alice first",
      ]);
    });

    it("returns an empty list for a user with no tasks", async () => {
      await setupUsers();

      const res = await request(app)
        .get("/api/tasks")
        .set("Authorization", `Bearer ${bob.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ tasks: [] });
    });
  });

  // -------------------------------------------------------------------------
  describe("GET /api/tasks/:id", () => {
    it("returns the caller's own task", async () => {
      await setupUsers();
      const task = await createTask(alice, { title: "Buy milk" });

      const res = await request(app)
        .get(`/api/tasks/${task.id}`)
        .set("Authorization", `Bearer ${alice.token}`);

      expect(res.status).toBe(200);
      expect(res.body.task).toMatchObject({ id: task.id, title: "Buy milk" });
    });

    it("returns 404 (not 403) for another user's task", async () => {
      await setupUsers();
      const task = await createTask(alice, { title: "Private" });

      const res = await request(app)
        .get(`/api/tasks/${task.id}`)
        .set("Authorization", `Bearer ${bob.token}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Task not found" });
    });

    it("returns 404 for a task id that does not exist", async () => {
      await setupUsers();

      const res = await request(app)
        .get(`/api/tasks/${new Types.ObjectId().toString()}`)
        .set("Authorization", `Bearer ${alice.token}`);

      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed id instead of a 500 CastError", async () => {
      await setupUsers();

      const res = await request(app)
        .get("/api/tasks/abc")
        .set("Authorization", `Bearer ${alice.token}`);

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([
        { field: "id", message: "Invalid task id" },
      ]);
    });
  });

  // -------------------------------------------------------------------------
  describe("PATCH /api/tasks/:id", () => {
    it("updates only the fields sent", async () => {
      await setupUsers();
      const task = await createTask(alice, {
        title: "Buy milk",
        description: "2 litres",
      });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set("Authorization", `Bearer ${alice.token}`)
        .send({ title: "Buy oat milk" });

      expect(res.status).toBe(200);
      expect(res.body.task).toMatchObject({
        title: "Buy oat milk",
        description: "2 litres",
      });
    });

    it("clears description and dueDate when null is sent", async () => {
      await setupUsers();
      const task = await createTask(alice, {
        title: "Buy milk",
        description: "2 litres",
        dueDate: "2026-12-01",
      });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set("Authorization", `Bearer ${alice.token}`)
        .send({ description: null, dueDate: null });

      expect(res.status).toBe(200);
      expect(res.body.task).toMatchObject({ description: null, dueDate: null });
      const record = await Task.findById(task.id).lean();
      expect(record).not.toHaveProperty("description");
      expect(record).not.toHaveProperty("due_date");
    });

    it("moves updatedAt forward", async () => {
      await setupUsers();
      const task = await createTask(alice, { title: "Buy milk" });
      const before = (await Task.findById(task.id).lean())!.updatedAt;

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set("Authorization", `Bearer ${alice.token}`)
        .send({ title: "Changed" });

      expect(new Date(res.body.task.updatedAt).getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it("returns 404 and leaves another user's task unchanged", async () => {
      await setupUsers();
      const task = await createTask(alice, { title: "Alice's task" });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set("Authorization", `Bearer ${bob.token}`)
        .send({ title: "Hacked" });

      expect(res.status).toBe(404);
      const record = await Task.findById(task.id).lean();
      expect(record?.title).toBe("Alice's task");
    });

    it("returns 400 for an empty body", async () => {
      await setupUsers();
      const task = await createTask(alice, { title: "Buy milk" });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set("Authorization", `Bearer ${alice.token}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  describe("DELETE /api/tasks/:id", () => {
    it("deletes the caller's own task with 204", async () => {
      await setupUsers();
      const task = await createTask(alice, { title: "Buy milk" });

      const res = await request(app)
        .delete(`/api/tasks/${task.id}`)
        .set("Authorization", `Bearer ${alice.token}`);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      await expect(Task.findById(task.id)).resolves.toBeNull();
    });

    it("returns 404 and does NOT delete another user's task", async () => {
      await setupUsers();
      const task = await createTask(alice, { title: "Alice's task" });

      const res = await request(app)
        .delete(`/api/tasks/${task.id}`)
        .set("Authorization", `Bearer ${bob.token}`);

      expect(res.status).toBe(404);
      await expect(Task.findById(task.id)).resolves.not.toBeNull();
    });

    it("returns 404 when deleting the same task twice", async () => {
      await setupUsers();
      const task = await createTask(alice, { title: "Buy milk" });
      const del = () =>
        request(app)
          .delete(`/api/tasks/${task.id}`)
          .set("Authorization", `Bearer ${alice.token}`);

      expect((await del()).status).toBe(204);
      expect((await del()).status).toBe(404);
    });
  });
});
