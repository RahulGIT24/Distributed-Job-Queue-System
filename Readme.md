# Distributed Fault-Tolerant Task Queue

![CI](https://github.com/RahulGIT24/Distributed-Job-Queue-System/actions/workflows/ci.yml/badge.svg)

A high-performance, horizontally scalable, and fault-tolerant distributed task queue built from scratch using **Node.js**, **Redis**, and **Lua Scripting**. Designed to handle high-concurrency background job processing with strict **at-least-once delivery guarantees**, automated dead-letter routing, and real-time observability.

## Architecture & System Design

This system abandons basic, fragile list-popping in favor of a robust state-machine architecture, ensuring no tasks are lost to microsecond hardware failures or "poison pill" data.

* **Producers:** Ingest tasks into a Redis `List` (`queue:pending`) at extremely high throughput.
* **Worker Cluster (Consumers):** Scaled horizontally via **PM2**. Workers use atomic operations to safely acquire tasks.
* **The State Engine:** Tasks are moved to a Redis `Sorted Set` (`queue:processing`) using the current timestamp as a score. Workers emit continuous **Heartbeats** to extend their lease.
* **The Janitor (Reaper):** A detached microservice that sweeps the `queue:processing` set for "zombie" tasks (where a worker crashed and stopped emitting heartbeats) and safely re-queues them.
* **Observability API:** An Express.js backend and React dashboard to monitor queue health and manually recover Dead Letters.

## Key Technical Features

* **100% Atomic Task Acquisition:** Utilized custom **Redis Lua Scripts** to combine `RPOP` and `ZADD` into a single atomic transaction, closing the microsecond gap where tasks could be lost during a crash.
* **Crash Resilience & Heartbeats:** Workers run in parallel and maintain tasks via a heartbeat lease mechanism. If a worker process is killed (`SIGINT`, Out of Memory), the task is preserved and automatically recovered by the independent Janitor process.
* **Poison Pill Isolation:** Tasks that continuously fail logic blocks are tracked via a retry counter. Upon exceeding `MAX_RETRIES`, they are banished to a **Dead Letter Queue (DLQ)** to prevent infinite loop processing.
* **Horizontal Scalability:** Deployed using PM2 in cluster mode, allowing seamless CPU core utilization and linear throughput scaling.

---

## 📊 Performance Benchmarks & Proof of Concept

The system was stress-tested with a burst of **10,000 concurrent jobs** to validate ingestion limits, concurrency handling, and error recovery routing.

### 1. High-Throughput Ingestion
The Redis producer easily handles massive traffic spikes. In benchmark testing, the system successfully ingested **10,000 tasks in 631ms** (achieving an ingestion rate of ~15,800 tasks/second).

![Ingestion Benchmark](./proofs/Screenshot%20from%202026-04-11%2023-41-20.png)

### 2. Live Cluster Processing
The React Observability Dashboard tracks real-time engine state. Below, the system is dynamically distributing the 10,000 queued tasks across the multi-worker PM2 cluster.

![Dashboard Under Load](./proofs/Screenshot%20from%202026-04-11%2023-41-39.png)

### 3. Concurrency & Retry Logic in Action
PM2 logs validate the parallel nature of the system. Workers operate completely independently. When `bench-8576` fails, the worker immediately logs the error, increments the retry counter, re-queues it, and continues processing other tasks without blocking the event loop.

![PM2 Cluster Logs](./proofs/Screenshot%20from%202026-04-11%2023-48-55.png)

### 4. Dead Letter Queue (DLQ) Routing
Tasks that systematically fail (simulated 20% crash rate) exhaust their retry limits (3/3). The system successfully catches these "poison pills" and routes them to the DLQ, ensuring the main processing queue remains unblocked. 

![DLQ Dashboard](./proofs/Screenshot%20from%202026-04-11%2023-48-37.png)

### 5. Automated Recovery & State Resolution
Using the API Control Panel, all 22 tasks in the Dead Letter Queue were reset and successfully re-processed. The system reaches a completely healthy, empty state with **0% task loss**.

![Healthy Empty State](./proofs/Screenshot%20from%202026-04-11%2023-49-08.png)

---

## 🛠️ Getting Started

### Prerequisites
* Node.js (v20+)
* Redis Server (Running locally or via Docker)
* pnpm (`npm install -g pnpm`)
* PM2 (`npm install -g pm2`)

### Installation
1. Clone the repository:
   ```bash
   git clone [https://github.com/RahulGIT24/Distributed-Job-Queue-System](https://github.com/RahulGIT24/Distributed-Job-Queue-System)
   cd main
    ```

2. Install dependencies:
    ```bash
    pnpm install
    ```
3. Start the Redis server (if not already running):

4. Configure environment variables:
    Create a `.env` file in the root directory with the following content:
    ```
    REDIS_HOST=localhost
    REDIS_PORT=6379
    PORT=3000
    QUEUE_PENDING="queue:pending"
    QUEUE_PROCESSING = "queue:processing"
    QUEUE_DLQ = "queue:dead_letters"
    ```

5. Build the TypeScript code:
    ```bash
    pnpm run build
    ```

6. Start the worker cluster:
    ```bash
    pm2 start ecosystem.config.js
    ```
7. Start the Janitor process:
    ```bash
    pnpm run janitor
    ```
8. Start the Observability API:
    ```bash
    pnpm run start
    ```
9. Start stress testing:
    ```bash
    pnpm run benchmark
    ```
10. Now go to frontend directory and start the React dashboard:
    ```bash
    cd client
    pnpm install
    pnpm run start
    ```
11. Open the dashboard at `http://localhost:5173` to monitor the queue in real-time.

---

## ✅ Testing

The backend (`main/`) has two test suites:

* **Unit tests** — mock the Redis client, so they run offline with no external services. They cover the observability API (`apiController`), the Express route wiring (`app`), and the Janitor's stale-task sweep logic (`sweepStuckTasks`).
* **Integration tests** — run against a real Redis instance to verify behavior that can't be faithfully mocked, most importantly the atomicity of the `popToProcessing` Lua script (the `RPOP` + `ZADD` combo that makes task acquisition crash-safe), plus the full HTTP → controller → Redis path.

```bash
cd main

# Unit tests (no Redis required)
pnpm test

# Integration tests (requires a reachable Redis, see REDIS_HOST/REDIS_PORT)
pnpm run test:integration

# Watch mode for unit tests
pnpm run test:watch
```

Integration tests use dedicated `*:ci`/`*:test`-style Redis keys (overridable via `QUEUE_PENDING`, `QUEUE_PROCESSING`, `QUEUE_DLQ` env vars) so they never touch your real development queues, and clean up after themselves.

The frontend (`client/`) is checked via `pnpm run lint` and a production `pnpm run build`.

## 🔁 Continuous Integration

Every push and pull request to `main`/`master` runs via [GitHub Actions](./.github/workflows/ci.yml):

* **Backend job** — spins up a `redis:7-alpine` service container, installs dependencies, type-checks and builds the TypeScript, then runs the unit and integration test suites.
* **Frontend job** — installs dependencies, lints, and builds the React dashboard.

A PR can't merge with a red build, which keeps the atomic task-acquisition guarantees and the API contract from silently regressing.
