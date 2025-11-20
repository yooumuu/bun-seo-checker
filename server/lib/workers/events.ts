import { EventEmitter } from "node:events";
import { desc } from "drizzle-orm";
import { db } from "../db";
import { taskEvents } from "../db/schema/scan_jobs";

export type TaskEventMessage = {
    id: number;
    jobId: number;
    type: string;
    payload: Record<string, unknown> | null;
    createdAt: Date | null;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export const recordTaskEvent = async (
    jobId: number,
    type: string,
    payload: Record<string, unknown> = {}
) => {
    const [event] = await db
        .insert(taskEvents)
        .values({
            jobId,
            type,
            payload,
        })
        .returning();

    if (!event) {
        throw new Error("Failed to persist task event");
    }

    const formatted: TaskEventMessage = {
        id: event.id,
        jobId: event.jobId,
        type: event.type,
        payload: (event.payload as Record<string, unknown> | null) ?? null,
        createdAt: event.createdAt ?? new Date(),
    };

    emitter.emit("event", formatted);
    return formatted;
};

export const subscribeToTaskEvents = (
    listener: (event: TaskEventMessage) => void
) => {
    emitter.on("event", listener);
    return () => emitter.off("event", listener);
};

export const getRecentTaskEvents = async (limit = 25) => {
    const events = await db
        .select()
        .from(taskEvents)
        .orderBy(desc(taskEvents.createdAt))
        .limit(limit);

    return events
        .reverse()
        .map<TaskEventMessage>((event) => ({
            id: event.id,
            jobId: event.jobId,
            type: event.type,
            payload: (event.payload as Record<string, unknown> | null) ?? null,
            createdAt: event.createdAt ?? null,
        }));
};
