import { z } from 'zod';

export const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});
export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export const profileSchema = z.object({
  id: z.string(),
  display_name: z.string().nullish(),
  product: z.string().optional(),
});

export const deviceApiSchema = z.object({
  id: z.string().nullable(),
  is_active: z.boolean(),
  is_restricted: z.boolean().optional(),
  name: z.string(),
  type: z.string(),
  volume_percent: z.number().nullable().optional(),
  supports_volume: z.boolean().optional(),
});
export type DeviceApi = z.infer<typeof deviceApiSchema>;

export const devicesResponseSchema = z.object({
  devices: z.array(deviceApiSchema),
});

export const trackSchema = z.object({
  id: z.string().nullish(),
  type: z.string().optional(),
  name: z.string(),
  artists: z.array(z.object({ name: z.string() })),
  external_urls: z.object({ spotify: z.string().optional() }).optional(),
});

export const playbackStateSchema = z.object({
  is_playing: z.boolean(),
  device: deviceApiSchema.nullable(),
  item: trackSchema.nullable().optional(),
});

export const oauthErrorSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const apiErrorBodySchema = z.object({
  error: z
    .object({
      status: z.number().optional(),
      message: z.string().optional(),
      reason: z.string().optional(),
    })
    .optional(),
});
