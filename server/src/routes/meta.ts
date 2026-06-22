import type { FastifyInstance } from 'fastify';
import type { ClientConfig } from '@spotibot/shared';
import { SPOTIFY_REDIRECT_PATH } from '../config';
import type { AppContext } from '../context';

export function registerMetaRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/config', () => {
    return {
      spotifyRedirectUri: `${ctx.config.publicBaseUrl}${SPOTIFY_REDIRECT_PATH}`,
    } satisfies ClientConfig;
  });
}
