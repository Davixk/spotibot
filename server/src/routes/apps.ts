import type { FastifyInstance } from 'fastify';
import {
  type ApiError,
  createSpotifyAppInputSchema,
  updateSpotifyAppInputSchema,
} from '@spotibot/shared';
import type { AppContext } from '../context';
import { encryptSecret } from '../crypto';
import {
  createSpotifyApp,
  deleteSpotifyApp,
  getAppAccountCount,
  getSpotifyApp,
  listSpotifyApps,
  toAppDto,
  updateSpotifyApp,
} from '../db/store';
import { idParamSchema } from './params';

export function registerAppRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/apps', () => listSpotifyApps(ctx.db));

  app.post('/apps', async (request, reply) => {
    const input = createSpotifyAppInputSchema.parse(request.body);
    const row = await createSpotifyApp(ctx.db, {
      name: input.name,
      clientId: input.clientId,
      encClientSecret: encryptSecret(input.clientSecret, ctx.config.encryptionKey),
      redirectUri: input.redirectUri,
    });
    return reply.code(201).send(toAppDto(row, 0));
  });

  app.put('/apps/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = updateSpotifyAppInputSchema.parse(request.body);
    const existing = await getSpotifyApp(ctx.db, id);
    if (!existing) {
      return reply.code(404).send({ error: 'Spotify app not found' } satisfies ApiError);
    }
    const encClientSecret =
      input.clientSecret !== undefined && input.clientSecret.length > 0
        ? encryptSecret(input.clientSecret, ctx.config.encryptionKey)
        : undefined;
    const row = await updateSpotifyApp(ctx.db, id, {
      name: input.name,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      encClientSecret,
    });
    if (!row) {
      return reply.code(404).send({ error: 'Spotify app not found' } satisfies ApiError);
    }
    return toAppDto(row, await getAppAccountCount(ctx.db, id));
  });

  app.delete('/apps/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await deleteSpotifyApp(ctx.db, id);
    return reply.code(204).send();
  });
}
