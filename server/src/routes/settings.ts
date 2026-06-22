import type { FastifyInstance } from 'fastify';
import { settingsSchema } from '@spotibot/shared';
import type { AppContext } from '../context';
import { getSettings, toSettingsDto, updateSettings } from '../db/store';

export function registerSettingsRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/settings', async () => {
    const row = await getSettings(ctx.db);
    return toSettingsDto(row);
  });

  app.put('/settings', async (request) => {
    const input = settingsSchema.parse(request.body);
    const row = await updateSettings(ctx.db, input);
    return toSettingsDto(row);
  });
}
