import type { FastifyInstance } from 'fastify';
import { type ApiError, type AuthState, loginInputSchema } from '@spotibot/shared';
import type { AppContext } from '../context';
import { isAuthenticated, verifyPassword } from '../plugins/auth';

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/auth/login', async (request, reply) => {
    const { password } = loginInputSchema.parse(request.body);
    if (!verifyPassword(password, ctx.config.dashboardPassword)) {
      return reply.code(401).send({ error: 'Invalid password' } satisfies ApiError);
    }
    // Rotate the session id on privilege change to prevent session fixation.
    await request.session.regenerate();
    request.session.authenticated = true;
    return { authenticated: true } satisfies AuthState;
  });

  app.post('/auth/logout', async (request) => {
    // Fully invalidate the server-side session and clear the cookie.
    await request.session.destroy();
    return { authenticated: false } satisfies AuthState;
  });

  app.get('/auth/me', (request) => {
    return { authenticated: isAuthenticated(request) } satisfies AuthState;
  });
}
