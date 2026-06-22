import type { FastifyInstance } from 'fastify';
import { createSpotifyAppInputSchema } from '@spotibot/shared';
import type { AppContext } from '../context';
import { encryptSecret } from '../crypto';
import { createSpotifyApp, deleteSpotifyApp, listSpotifyApps, toAppDto } from '../db/store';
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

  app.delete('/apps/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await deleteSpotifyApp(ctx.db, id);
    return reply.code(204).send();
  });
}
