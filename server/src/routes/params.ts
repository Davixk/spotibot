import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.uuid(),
});

export const authorizeQuerySchema = z.object({
  appId: z.uuid(),
});

export const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});
