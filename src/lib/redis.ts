import { Redis } from 'ioredis';

export const producer = new Redis({
    host: "localhost",
    port: 6379
})

export const consumer = new Redis({
    host: "localhost",
    port: 6379
})

export const janitorRedis = new Redis({
    host: "localhost",
    port: 6379
})