import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const QuerySchema = z.object({
  query: z.string().min(1).max(1000).trim(),
  filters: z.record(z.any()).optional(),
});

export const validateQuery = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = QuerySchema.parse(req.body);
    req.body = validated;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    next(error);
  }
};
