import request from "supertest";

jest.mock("../lib/redis", () => ({
  producer: {
    llen: jest.fn(),
    zcard: jest.fn(),
    lrange: jest.fn(),
    rpop: jest.fn(),
    lpush: jest.fn(),
  },
  consumer: {},
  janitorRedis: {},
}));

import app from "../app";
import { producer } from "../lib/redis";

const mockedProducer = producer as jest.Mocked<typeof producer>;

describe("Express app routing", () => {
  it("GET /api/stats returns queue counts", async () => {
    mockedProducer.llen.mockResolvedValue(0 as any);
    mockedProducer.zcard.mockResolvedValue(0 as any);

    const res = await request(app).get("/api/stats");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ pendingCount: 0, dlqCount: 0, processingCount: 0 })
    );
  });

  it("GET /api/dlq returns parsed dead-letter tasks", async () => {
    mockedProducer.lrange.mockResolvedValue([
      JSON.stringify({ id: "1", task: "x", retries: 3 }),
    ] as any);

    const res = await request(app).get("/api/dlq");

    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([{ id: "1", task: "x", retries: 3 }]);
  });

  it("POST /api/tasks injects a manual task", async () => {
    const res = await request(app).post("/api/tasks").send({ taskName: "hello" });

    expect(res.status).toBe(200);
    expect(res.body.task.task).toBe("hello");
    expect(mockedProducer.lpush).toHaveBeenCalled();
  });

  it("POST /api/dlq/retry re-queues dead-lettered tasks", async () => {
    mockedProducer.rpop
      .mockResolvedValueOnce(JSON.stringify({ id: "1", task: "x", retries: 3 }) as any)
      .mockResolvedValueOnce(null as any);

    const res = await request(app).post("/api/dlq/retry");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Successfully re-queued 1 tasks.");
  });

  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/unknown");
    expect(res.status).toBe(404);
  });
});
