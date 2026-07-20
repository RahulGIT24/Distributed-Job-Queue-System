jest.mock("../lib/redis", () => ({
  producer: {},
  consumer: {},
  janitorRedis: {
    zrange: jest.fn(),
    zrem: jest.fn(),
    lpush: jest.fn(),
  },
}));

import { janitorRedis } from "../lib/redis";
import { sweepStuckTasks } from "../lib/janitor";

const mockedJanitorRedis = janitorRedis as jest.Mocked<typeof janitorRedis>;

describe("sweepStuckTasks", () => {
  it("does nothing when no tasks have stalled", async () => {
    mockedJanitorRedis.zrange.mockResolvedValue([] as any);

    const rescued = await sweepStuckTasks(Date.now());

    expect(rescued).toBe(0);
    expect(mockedJanitorRedis.lpush).not.toHaveBeenCalled();
  });

  it("re-queues stalled tasks with an incremented retry count", async () => {
    const stuck = JSON.stringify({ id: "1", task: "x", retries: 1 });
    mockedJanitorRedis.zrange.mockResolvedValue([stuck] as any);
    mockedJanitorRedis.zrem.mockResolvedValue(1 as any);

    const rescued = await sweepStuckTasks(Date.now());

    expect(rescued).toBe(1);
    expect(mockedJanitorRedis.lpush).toHaveBeenCalledWith(
      process.env.QUEUE_PENDING,
      JSON.stringify({ id: "1", task: "x", retries: 2 })
    );
  });

  it("skips a task another janitor instance already claimed", async () => {
    const stuck = JSON.stringify({ id: "1", task: "x", retries: 1 });
    mockedJanitorRedis.zrange.mockResolvedValue([stuck] as any);
    // zrem returning 0 means a concurrent janitor already removed it first
    mockedJanitorRedis.zrem.mockResolvedValue(0 as any);

    const rescued = await sweepStuckTasks(Date.now());

    expect(rescued).toBe(0);
    expect(mockedJanitorRedis.lpush).not.toHaveBeenCalled();
  });

  it("only sweeps tasks whose lease is older than the stall timeout", async () => {
    const now = Date.now();
    await sweepStuckTasks(now);

    const [, , threshold] = mockedJanitorRedis.zrange.mock.calls[0];
    expect(threshold).toBe(now - 5 * 60 * 1000);
  });
});
