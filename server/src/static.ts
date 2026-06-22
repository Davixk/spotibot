import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

/**
 * Serves the built React SPA and falls back to index.html for client-side routes.
 * In production the image sets STATIC_DIR to the bundled web build; in dev the
 * Vite dev server handles the UI and this is skipped if the build is absent.
 */
export async function registerStatic(app: FastifyInstance): Promise<void> {
  const staticDir = process.env.STATIC_DIR ?? '../web/dist';
  const root = path.resolve(process.cwd(), staticDir);
  if (!existsSync(root)) {
    app.log.warn(`Static directory ${root} not found; the SPA will not be served by this server.`);
    return;
  }

  await app.register(fastifyStatic, { root, wildcard: false });

  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith('/api')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
}
