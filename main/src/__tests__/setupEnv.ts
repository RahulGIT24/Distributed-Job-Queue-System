// Ensures env vars the app reads at module-load time are present for every
// test run, whether or not a local .env file exists (e.g. in CI).
process.env.REDIS_HOST = process.env.REDIS_HOST || "localhost";
process.env.REDIS_PORT = process.env.REDIS_PORT || "6379";
process.env.PORT = process.env.PORT || "5002";
process.env.QUEUE_PENDING = process.env.QUEUE_PENDING || "queue:pending:test";
process.env.QUEUE_PROCESSING = process.env.QUEUE_PROCESSING || "queue:processing:test";
process.env.QUEUE_DLQ = process.env.QUEUE_DLQ || "queue:dead_letters:test";
