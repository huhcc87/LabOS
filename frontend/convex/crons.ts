import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Raise an alert when a sensor stops reporting.
crons.interval("sensor offline check", { minutes: 5 }, internal.iot.checkOffline, {});
// Lab meeting and action-item reminders.
crons.interval("meeting reminders", { minutes: 5 }, internal.meetings.sendReminders, {});
// Drop expired sign-in sessions and old rate-limit counters.
crons.interval("security cleanup", { hours: 6 }, internal.security.cleanup, {});
export default crons;
