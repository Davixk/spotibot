import type { FastifyBaseLogger } from 'fastify';
import type { AppConfig } from './config';
import type { Database, DbHandle } from './db/index';
import { PollerEngine } from './poller/engine';
import { TokenManager } from './spotify/tokens';

export interface AppContext {
  config: AppConfig;
  db: Database;
  pool: DbHandle['pool'];
  tokens: TokenManager;
  poller: PollerEngine;
}

export function buildContext(params: {
  config: AppConfig;
  dbHandle: DbHandle;
  logger: FastifyBaseLogger;
}): AppContext {
  const tokens = new TokenManager(params.dbHandle.db, params.config.encryptionKey);
  const poller = new PollerEngine({
    db: params.dbHandle.db,
    tokens,
    logger: params.logger,
  });
  return {
    config: params.config,
    db: params.dbHandle.db,
    pool: params.dbHandle.pool,
    tokens,
    poller,
  };
}
