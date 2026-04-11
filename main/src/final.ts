import { consumer, producer } from "./lib/redis";
import { Message } from "./phase1";
import { delayFn } from "./phase2";
import 'dotenv/config'

const QUEUE_PENDING = process.env.QUEUE_PENDING!;
const QUEUE_PROCESSING = process.env.QUEUE_PROCESSING!;
const QUEUE_DLQ = process.env.QUEUE_DLQ!


const HEARTBEAT_INTERVAL = 30 * 1000;

interface extendedTask extends Message {
    retries: number,
}
const MAX_RETRIES = 3;

// lua script for making brpop and zadd atomic in consumer
consumer.defineCommand("popToProcessing", {
    numberOfKeys: 2,
    lua: `
        local task = redis.call('RPOP', KEYS[1])
        if task then
            redis.call('ZADD', KEYS[2], ARGV[1], task)
            return task
        end
        return nil
    `
});

const reliableProducer = async () => {
    let counter = 0;

    console.log("[PRODUCER] Ready For Pushing Tasks.....")

    while (true) {
        counter++;
        let task: extendedTask = {
            id: counter,
            task: "Processing Batch of Id " + counter,
            retries: 0
        }
        const taskString = JSON.stringify(task);
        await producer.lpush(QUEUE_PENDING, taskString);

        console.log("[PRODUCED TASK] of Id " + task.id);
        await delayFn(3000)
    }
}

export const reliableConsumer = async () => {
    console.log("[CONSUMER] Connected. Waiting for reliable connections.");
    while (true) {
        // use BLMOVE to atomically pop and push to processing queue
        // const taskString = await consumer.blmove(
        //     QUEUE_PENDING, QUEUE_PROCESSING, "RIGHT", "LEFT", 0
        // );
        const startTime = Date.now();

        // instead of BLMOVE one should use zsets it will help janitor to recover stuck tasks without allowing duplication based on score value
        // Now lua script have made that operation atomic

        // @ts-ignore
        const taskString = await consumer.popToProcessing(
            QUEUE_PENDING, 
            QUEUE_PROCESSING, 
            startTime
        );

        if (taskString) {
            const task = JSON.parse(taskString);
            console.log(`[Consumer] Processing: ${task.id}`);

            const heartbeatTimer = setInterval(async () => {
                try {
                    // Overwrite the old score with the new current time
                    await consumer.zadd(QUEUE_PROCESSING, Date.now(), taskString);
                    console.log(`[Heartbeat] Extended lease for task ${task.id}`);
                } catch (err) {
                    console.error(`[Heartbeat Error] Failed to update task ${task.id}`, err);
                }
            }, HEARTBEAT_INTERVAL);

            try {
                await delayFn(3500);

                // if failure happens here the task will be stuck in queue:processing
                if (Math.random() < 0.2) {
                    throw new Error("FATAL SERVER CRASH!");
                }
                console.log(`[Consumer] Success: ${task.id}`);

                // now we will remove from zset after processing
                await consumer.zrem(QUEUE_PROCESSING, taskString);

                // await consumer.lrem(QUEUE_PROCESSING, taskString, 1);
            } catch (error) {
                console.log(`[CONSUMER] Error on task ${task.id}`);
                await consumer.zrem(QUEUE_PROCESSING, taskString);
                if (task.retries >= MAX_RETRIES) {
                    await consumer.lpush(QUEUE_DLQ, taskString);
                    console.log(`DLQ] Task ${task.id} routed to DLQ.`);
                } else {
                    task.retries += 1;
                    await consumer.lpush(QUEUE_PENDING, JSON.stringify(task));
                    console.log(`[Retry] Task ${task.id} queued for attempt ${task.retries}`);
                }
            } finally {
                clearInterval(heartbeatTimer)
            }
        }
    }
}

// reliableProducer();
// reliableConsumer();