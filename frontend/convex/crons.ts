import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Raise an alert when a sensor stops reporting.
crons.interval("sensor offline check", { minutes: 5 }, internal.iot.checkOffline, {});
export default crons;
