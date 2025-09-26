const Queue = require("bull");
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const reportQueue = new Queue("reports", REDIS_URL);

reportQueue.on("error", (err) => console.error("ReportQueue error:", err));
reportQueue.on("failed", (job, err) => console.error(`Job ${job.id} failed:`, err && err.message ? err.message : err));
reportQueue.on("completed", (job) => { /* optional logging */ });

module.exports = reportQueue;