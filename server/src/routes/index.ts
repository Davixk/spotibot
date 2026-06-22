import type { FastifyInstance } from 'fastify';
import type { ApiError } from '@spotibot/shared';
import type { AppContext } from '../context';
import { isAuthenticated } from '../plugins/auth';
import { registerAccountRoutes } from './accounts';
import { registerAppRoutes } from './apps';
import { registerAuthRoutes } from './auth';
import { registerMetaRoutes } from './meta';
import { registerSettingsRoutes } from './settings';
import { registerSpotifyRoutes } from './spotify';
import { registerStatusRoutes } from './status';

const PUBLIC_ROUTES = new Set(['POST /api/auth/login', 'GET /api/auth/me']);

export async function registerApiRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  await app.register(
    (api, _opts, done) => {
      api.addHook('preHandler', async (request, reply) => {
        const url = request.routeOptions.url ?? request.url;
        if (PUBLIC_ROUTES.has(`${request.method} ${url}`)) return;
        if (!isAuthenticated(request)) {
          await reply.code(401).send({ error: 'Authentication required' } satisfies ApiError);
        }
      });

      registerMetaRoutes(api, ctx);
      registerAuthRoutes(api, ctx);
      registerSpotifyRoutes(api, ctx);
      registerAppRoutes(api, ctx);
      registerAccountRoutes(api, ctx);
      registerSettingsRoutes(api, ctx);
      registerStatusRoutes(api, ctx);
      done();
    },
    { prefix: '/api' },
  );
}
