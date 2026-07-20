import { Request, Response } from "express";

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

import { producer } from "../lib/redis";
import {
  getApiStats,
  getFailedTasks,
  retryDLQTasks,
  pushTask,
} from "../controllers/apiController";

const mockedProducer = producer as jest.Mocked<typeof producer>;

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("getApiStats", () => {
  it("returns pending, dlq and processing counts", async () => {
    mockedProducer.llen.mockImplementation(((key: string) => {
      if (key === process.env.QUEUE_PENDING) return Promise.resolve(5);
      if (key === process.env.QUEUE_DLQ) return Promise.resolve(2);
      return Promise.resolve(0);
    }) as typeof mockedProducer.llen);
    mockedProducer.zcard.mockResolvedValue(3 as any);

    const res = mockRes();
    await getApiStats({} as Request, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ pendingCount: 5, dlqCount: 2, processingCount: 3 })
    );
  });

  it("responds with 500 when redis fails", async () => {
    mockedProducer.llen.mockRejectedValue(new Error("boom"));

    const res = mockRes();
    await getApiStats({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error" });
  });
});

describe("getFailedTasks", () => {
  it("parses and returns dead-lettered tasks", async () => {
    const tasks = [
      { id: "1", task: "a", retries: 3 },
      { id: "2", task: "b", retries: 3 },
    ];
    mockedProducer.lrange.mockResolvedValue(tasks.map((t) => JSON.stringify(t)) as any);

    const res = mockRes();
    await getFailedTasks({} as Request, res);

    expect(mockedProducer.lrange).toHaveBeenCalledWith(process.env.QUEUE_DLQ, 0, 99);
    expect(res.json).toHaveBeenCalledWith({ tasks });
  });

  it("responds with 500 when redis fails", async () => {
    mockedProducer.lrange.mockRejectedValue(new Error("boom"));

    const res = mockRes();
    await getFailedTasks({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("retryDLQTasks", () => {
  it("drains the DLQ, resets retries, and re-queues every task", async () => {
    const rawTasks = [
      JSON.stringify({ id: "1", task: "a", retries: 3 }),
      JSON.stringify({ id: "2", task: "b", retries: 3 }),
    ];
    mockedProducer.rpop
      .mockResolvedValueOnce(rawTasks[0] as any)
      .mockResolvedValueOnce(rawTasks[1] as any)
      .mockResolvedValueOnce(null as any);

    const res = mockRes();
    await retryDLQTasks({} as Request, res);

    expect(mockedProducer.lpush).toHaveBeenCalledTimes(2);
    expect(mockedProducer.lpush).toHaveBeenNthCalledWith(
      1,
      process.env.QUEUE_PENDING,
      JSON.stringify({ id: "1", task: "a", retries: 0 })
    );
    expect(res.json).toHaveBeenCalledWith({ message: "Successfully re-queued 2 tasks." });
  });

  it("reports zero tasks when the DLQ is empty", async () => {
    mockedProducer.rpop.mockResolvedValue(null as any);

    const res = mockRes();
    await retryDLQTasks({} as Request, res);

    expect(mockedProducer.lpush).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: "Successfully re-queued 0 tasks." });
  });
});

describe("pushTask", () => {
  it("injects a task using the provided name", async () => {
    const req = { body: { taskName: "custom-job" } } as Request;
    const res = mockRes();

    await pushTask(req, res);

    expect(mockedProducer.lpush).toHaveBeenCalledWith(
      process.env.QUEUE_PENDING,
      expect.stringContaining("custom-job")
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Task injected successfully" })
    );
  });

  it("falls back to a default task name when none is provided", async () => {
    const req = { body: {} } as Request;
    const res = mockRes();

    await pushTask(req, res);

    const [, pushedString] = mockedProducer.lpush.mock.calls[0];
    expect(JSON.parse(pushedString as string).task).toBe("Manual Override Task");
  });
});
