import Fastify from 'fastify';
import { configureApp } from './app';
import { loadConfig } from './config';
import { buildContext } from './context';
import { createDb, runMigrations } from './db/index';

async function main(): Promise<void> {
  const config = loadConfig();
  const dbHandle = createDb(config.databaseUrl);
  await runMigrations(dbHandle.db);

  const app = Fastify({
    trustProxy: true,
    logger:
      config.nodeEnv === 'development'
        ? { level: 'debug', transport: { target: 'pino-pretty' } }
        : { level: 'info' },
  });

  const ctx = buildContext({ config, dbHandle, logger: app.log });
  await configureApp(app, ctx);

  ctx.poller.start();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down`);
    ctx.poller.stop();
    await app.close();
    await dbHandle.pool.end();
  };
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM').finally(() => {
      process.exit(0);
    });
  });
  process.once('SIGINT', () => {
    void shutdown('SIGINT').finally(() => {
      process.exit(0);
    });
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
