import { z } from 'zod';
// Project validation schemas
export const projectCreateSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
    key: z.string().regex(/^[A-Z0-9-]{2,10}$/, 'Key must be 2-10 uppercase alphanumeric characters (hyphens allowed)'),
    description: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
});
export const projectUpdateSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().optional(),
    status: z.enum(['active', 'completed', 'archived']).optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
});
// Task validation schemas
export const taskCreateSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    assignee_id: z.string().uuid().optional(),
    due_date: z.string().optional(),
    tags: z.array(z.string()).optional(),
    material_requerido_id: z.string().uuid().optional(),
});
export const taskUpdateSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    assignee_id: z.string().uuid().optional().nullable(),
    due_date: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
});
// Middleware factory for validation
export const validate = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors.map((e) => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });
            }
            return res.status(400).json({ error: 'Invalid request data' });
        }
    };
};
// Convenience middleware exports
export const validateProjectCreate = validate(projectCreateSchema);
export const validateProjectUpdate = validate(projectUpdateSchema);
export const validateTaskCreate = validate(taskCreateSchema);
export const validateTaskUpdate = validate(taskUpdateSchema);
