import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context';

export function registerStatusRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/status', () => ctx.poller.getStatus());
}
