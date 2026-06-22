import type { FastifyInstance } from 'fastify';
import { type ApiError, accountConfigSchema, updateAccountInputSchema } from '@spotibot/shared';
import type { AppContext } from '../context';
import {
  deleteAccount,
  getAccount,
  getAccountConfig,
  listAccounts,
  setAccountEnabled,
  toAccountDto,
  toConfigDto,
  updateAccountConfig,
} from '../db/store';
import { getDevices } from '../spotify/client';
import { ReauthRequiredError, SpotifyApiError } from '../spotify/errors';
import { idParamSchema } from './params';

export function registerAccountRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/accounts', async () => {
    const rows = await listAccounts(ctx.db);
    return rows.map(toAccountDto);
  });

  app.patch('/accounts/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = updateAccountInputSchema.parse(request.body);
    const row = await setAccountEnabled(ctx.db, id, input.enabled);
    if (!row) {
      return reply.code(404).send({ error: 'Account not found' } satisfies ApiError);
    }
    if (!input.enabled) {
      ctx.poller.invalidate(id);
    }
    return toAccountDto(row);
  });

  app.delete('/accounts/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await deleteAccount(ctx.db, id);
    ctx.poller.invalidate(id);
    return reply.code(204).send();
  });

  app.get('/accounts/:id/devices', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const account = await getAccount(ctx.db, id);
    if (!account) {
      return reply.code(404).send({ error: 'Account not found' } satisfies ApiError);
    }
    try {
      const token = await ctx.tokens.getAccessToken(account);
      return await getDevices(token);
    } catch (error) {
      if (error instanceof ReauthRequiredError) {
        return reply
          .code(409)
          .send({ error: 'Account requires re-authentication' } satisfies ApiError);
      }
      if (error instanceof SpotifyApiError) {
        return reply.code(502).send({ error: error.message } satisfies ApiError);
      }
      throw error;
    }
  });

  app.get('/accounts/:id/config', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const account = await getAccount(ctx.db, id);
    if (!account) {
      return reply.code(404).send({ error: 'Account not found' } satisfies ApiError);
    }
    const config = await getAccountConfig(ctx.db, id);
    return toConfigDto(config);
  });

  app.put('/accounts/:id/config', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const account = await getAccount(ctx.db, id);
    if (!account) {
      return reply.code(404).send({ error: 'Account not found' } satisfies ApiError);
    }
    const input = accountConfigSchema.parse(request.body);
    const config = await updateAccountConfig(ctx.db, id, input);
    return toConfigDto(config);
  });
}
