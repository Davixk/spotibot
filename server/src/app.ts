import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { ApiError } from '@spotibot/shared';
import type { AppContext } from './context';
import { registerSession } from './plugins/auth';
import { registerApiRoutes } from './routes/index';
import { registerStatic } from './static';

export async function configureApp(app: FastifyInstance, ctx: AppContext): Promise<void> {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const message = error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; ');
      return reply.code(400).send({ error: message } satisfies ApiError);
    }
    request.log.error({ err: error }, 'request failed');
    return reply.code(500).send({ error: 'Internal server error' } satisfies ApiError);
  });

  await registerSession(app, ctx.config);
  await registerApiRoutes(app, ctx);
  await registerStatic(app);
}
