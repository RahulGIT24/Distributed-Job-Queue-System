import { Redis } from 'ioredis';
import 'dotenv/config'

export const producer = new Redis({
    host: process.env.REDIS_HOST! || "localhost",
    port: Number(process.env.REDIS_PORT!) || 6379
})

export const consumer = new Redis({
    host: process.env.REDIS_HOST! || "localhost",
    port: Number(process.env.REDIS_PORT!) || 6379
})

export const janitorRedis = new Redis({
    host: process.env.REDIS_HOST! || "localhost",
    port:Number(process.env.REDIS_PORT!) || 6379
})