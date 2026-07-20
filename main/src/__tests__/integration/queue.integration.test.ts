// These tests require a real, reachable Redis instance (see REDIS_HOST/
// REDIS_PORT). They exercise the actual Lua script used for atomic task
// acquisition, which cannot be faithfully verified with a mocked client.
import { producer, consumer } from "../../lib/redis";
import "../../final"; // registers the "popToProcessing" command on `consumer`

const QUEUE_PENDING = process.env.QUEUE_PENDING!;
const QUEUE_PROCESSING = process.env.QUEUE_PROCESSING!;

describe("popToProcessing (atomic RPOP + ZADD lua script)", () => {
  beforeEach(async () => {
    await producer.del(QUEUE_PENDING, QUEUE_PROCESSING);
  });

  afterAll(async () => {
    await producer.del(QUEUE_PENDING, QUEUE_PROCESSING);
    await producer.quit();
    await consumer.quit();
  });

  it("moves a task from pending to the processing zset atomically", async () => {
    const task = JSON.stringify({ id: "1", task: "x", retries: 0 });
    await producer.lpush(QUEUE_PENDING, task);

    const popped = await (consumer as any).popToProcessing(
      QUEUE_PENDING,
      QUEUE_PROCESSING,
      Date.now()
    );

    expect(popped).toBe(task);
    expect(await producer.llen(QUEUE_PENDING)).toBe(0);
    expect(await producer.zscore(QUEUE_PROCESSING, task)).not.toBeNull();
  });

  it("returns nil when the pending queue is empty", async () => {
    const popped = await (consumer as any).popToProcessing(
      QUEUE_PENDING,
      QUEUE_PROCESSING,
      Date.now()
    );

    expect(popped).toBeNull();
  });

  it("pops tasks in FIFO order (oldest produced task first)", async () => {
    await producer.lpush(QUEUE_PENDING, JSON.stringify({ id: "1" }));
    await producer.lpush(QUEUE_PENDING, JSON.stringify({ id: "2" }));

    const first = await (consumer as any).popToProcessing(
      QUEUE_PENDING,
      QUEUE_PROCESSING,
      Date.now()
    );

    expect(JSON.parse(first).id).toBe("1");
  });
});
