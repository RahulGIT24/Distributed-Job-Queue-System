// Runs the real Express app against a real Redis instance (see REDIS_HOST/
// REDIS_PORT), exercising the full HTTP -> controller -> Redis path.
import request from "supertest";
import app from "../../app";
import { producer } from "../../lib/redis";

const QUEUE_PENDING = process.env.QUEUE_PENDING!;
const QUEUE_DLQ = process.env.QUEUE_DLQ!;

describe("API against a real Redis instance", () => {
  beforeEach(async () => {
    await producer.del(QUEUE_PENDING, QUEUE_DLQ);
  });

  afterAll(async () => {
    await producer.del(QUEUE_PENDING, QUEUE_DLQ);
    await producer.quit();
  });

  it("reflects a manually injected task in the stats and pending queue", async () => {
    await request(app).post("/api/tasks").send({ taskName: "integration-task" }).expect(200);

    const stats = await request(app).get("/api/stats").expect(200);
    expect(stats.body.pendingCount).toBe(1);

    const [raw] = await producer.lrange(QUEUE_PENDING, 0, -1);
    expect(JSON.parse(raw).task).toBe("integration-task");
  });

  it("retries every task currently in the DLQ", async () => {
    await producer.lpush(QUEUE_DLQ, JSON.stringify({ id: "1", task: "x", retries: 3 }));
    await producer.lpush(QUEUE_DLQ, JSON.stringify({ id: "2", task: "y", retries: 3 }));

    const res = await request(app).post("/api/dlq/retry").expect(200);

    expect(res.body.message).toBe("Successfully re-queued 2 tasks.");
    expect(await producer.llen(QUEUE_PENDING)).toBe(2);
    expect(await producer.llen(QUEUE_DLQ)).toBe(0);
  });
});
