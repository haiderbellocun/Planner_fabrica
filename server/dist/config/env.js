import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const envSchema = z
    .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    JWT_SECRET: z
        .string()
        .min(8, 'JWT_SECRET must be set and at least 8 characters long'),
    JWT_EXPIRES_IN: z.string().optional(),
    DATABASE_URL: z.string().url().optional(),
    PGHOST: z.string().optional(),
    PGPORT: z.coerce.number().int().optional(),
    PGDATABASE: z.string().optional(),
    PGUSER: z.string().optional(),
    PGPASSWORD: z.string().optional(),
    CORS_ORIGIN: z
        .string()
        .min(1, 'CORS_ORIGIN must be set')
        .default('http://localhost:5173'),
})
    .superRefine((env, ctx) => {
    const hasDatabaseUrl = !!env.DATABASE_URL;
    const hasPgParams = !!env.PGHOST && !!env.PGPORT && !!env.PGDATABASE && !!env.PGUSER && !!env.PGPASSWORD;
    if (!hasDatabaseUrl && !hasPgParams) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'You must set either DATABASE_URL or all of PGHOST, PGPORT, PGDATABASE, PGUSER and PGPASSWORD.',
            path: ['DATABASE_URL'],
        });
    }
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    // Show a clear error and fail fast on boot
    console.error('❌ Invalid environment configuration:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
     
    process.exit(1);
}
export const env = parsed.data;
