import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    SCAN_WORKERS_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    SCANNER_MAX_PAGES: z.coerce.number().int().min(1).default(100),
    SCANNER_DEFAULT_SITE_DEPTH: z.coerce.number().int().min(1).default(2),
    SCANNER_USER_AGENT: z.string().default("BunSEOChecker/1.0"),
    SCANNER_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
});

export const env = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    SCAN_WORKERS_MAX_CONCURRENCY: process.env.SCAN_WORKERS_MAX_CONCURRENCY,
    SCANNER_MAX_PAGES: process.env.SCANNER_MAX_PAGES,
    SCANNER_DEFAULT_SITE_DEPTH: process.env.SCANNER_DEFAULT_SITE_DEPTH,
    SCANNER_USER_AGENT: process.env.SCANNER_USER_AGENT,
    SCANNER_REQUEST_TIMEOUT_MS: process.env.SCANNER_REQUEST_TIMEOUT_MS,
});

export type AppConfig = typeof env;
