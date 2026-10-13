/**
 * Unit tests for the authenticate middleware and getAuthUser.
 *
 * What we MOCK (and why):
 *  - TokenService -> JWT verification has its own responsibility. Here we only
 *                    care what the middleware does with a valid/invalid result.
 *
 * ESM note: register the mock with `jest.unstable_mockModule()` and THEN
 * dynamically import the middleware, so it picks up the mock.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../errors/AppError.js";
import type TokenService from "../auth/token.service.js";
import type { AccessTokenPayload } from "../auth/auth.type.js";

const tokenServiceMock = {
  verifyAccessToken: jest.fn<(typeof TokenService)["verifyAccessToken"]>(),
};
jest.unstable_mockModule("../auth/token.service.js", () => ({
  default: tokenServiceMock,
}));

const { authenticate, getAuthUser } = await import("./auth.middleware.js");

const payload: AccessTokenPayload = {
  userId: "6721f0c2a1b2c3d4e5f60001",
  email: "john.doe@example.com",
  name: "John Doe",
  role: "user",
};

// Minimal fake request: the middleware only reads headers and writes user
function buildRequest(authorization?: string): Request {
  return {
    headers: authorization === undefined ? {} : { authorization },
  } as Request;
}

describe("authenticate", () => {
  const res = {} as Response;
  // NextFunction has overloads jest.Mock can't model, so mock a plain function
  let next: jest.Mock<(error?: unknown) => void>;
  const run = (req: Request) =>
    authenticate(req, res, next as unknown as NextFunction);

  beforeEach(() => {
    next = jest.fn<(error?: unknown) => void>();
  });

  it("sets req.user and calls next() for a valid Bearer token", () => {
    tokenServiceMock.verifyAccessToken.mockReturnValue(payload);
    const req = buildRequest("Bearer valid-token");

    run(req);

    expect(tokenServiceMock.verifyAccessToken).toHaveBeenCalledWith(
      "valid-token",
    );
    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    ["no Authorization header", undefined],
    ["an empty header", ""],
    ["a non-Bearer scheme", "Basic abc123"],
    ["lowercase bearer", "bearer valid-token"],
  ])("rejects %s with 401", (_label, header) => {
    const req = buildRequest(header);

    run(req);

    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).toHaveProperty("message", "Access token is missing");
    expect(tokenServiceMock.verifyAccessToken).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it("passes token verification errors to next() and does not set req.user", () => {
    const expired = new UnauthorizedError("Token has expired");
    tokenServiceMock.verifyAccessToken.mockImplementation(() => {
      throw expired;
    });
    const req = buildRequest("Bearer expired-token");

    run(req);

    expect(next).toHaveBeenCalledWith(expired);
    expect(req.user).toBeUndefined();
  });
});

describe("getAuthUser", () => {
  it("returns req.user when it is set", () => {
    const req = { user: payload } as Request;

    expect(getAuthUser(req)).toBe(payload);
  });

  it("throws UnauthorizedError when req.user is missing", () => {
    expect(() => getAuthUser({} as Request)).toThrow(UnauthorizedError);
  });
});
