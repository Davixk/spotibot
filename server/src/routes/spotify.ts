import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ApiError } from '@spotibot/shared';
import type { AppContext } from '../context';
import { decryptSecret, encryptSecret } from '../crypto';
import { getSpotifyApp, upsertAccount } from '../db/store';
import { buildAuthorizeUrl, exchangeCodeForTokens, fetchProfile } from '../spotify/oauth';
import { authorizeQuerySchema, callbackQuerySchema } from './params';

export function registerSpotifyRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/spotify/authorize', async (request, reply) => {
    const query = authorizeQuerySchema.parse(request.query);
    const appRow = await getSpotifyApp(ctx.db, query.appId);
    if (!appRow) {
      return reply.code(404).send({ error: 'Spotify app not found' } satisfies ApiError);
    }
    const state = randomBytes(16).toString('hex');
    request.session.oauth = { state, appId: appRow.id };
    const url = buildAuthorizeUrl({
      clientId: appRow.clientId,
      redirectUri: appRow.redirectUri,
      state,
    });
    return reply.redirect(url);
  });

  app.get('/spotify/callback', async (request, reply) => {
    const query = callbackQuerySchema.parse(request.query);
    const pending = request.session.oauth;
    delete request.session.oauth;

    if (query.error !== undefined) {
      return reply.redirect(`/?error=${encodeURIComponent(query.error)}`);
    }
    if (
      query.code === undefined ||
      query.state === undefined ||
      !pending ||
      pending.state !== query.state
    ) {
      return reply.redirect('/?error=invalid_oauth_state');
    }

    const appRow = await getSpotifyApp(ctx.db, pending.appId);
    if (!appRow) {
      return reply.redirect('/?error=app_not_found');
    }

    const clientSecret = decryptSecret(appRow.encClientSecret, ctx.config.encryptionKey);
    const tokens = await exchangeCodeForTokens(
      { clientId: appRow.clientId, clientSecret },
      query.code,
      appRow.redirectUri,
    );
    if (tokens.refresh_token === undefined) {
      return reply.redirect('/?error=missing_refresh_token');
    }

    const profile = await fetchProfile(tokens.access_token);
    await upsertAccount(ctx.db, {
      appId: appRow.id,
      spotifyUserId: profile.id,
      displayName: profile.displayName,
      encRefreshToken: encryptSecret(tokens.refresh_token, ctx.config.encryptionKey),
      isPremium: profile.isPremium,
    });
    return reply.redirect('/?connected=1');
  });
}
