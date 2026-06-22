import { createHash, timingSafeEqual } from 'node:crypto';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config';

declare module 'fastify' {
  interface Session {
    authenticated?: boolean;
    oauth?: { state: string; appId: string };
  }
}

export async function registerSession(app: FastifyInstance, config: AppConfig): Promise<void> {
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: config.sessionSecret,
    cookieName: 'spotibot.sid',
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.publicBaseUrl.startsWith('https://'),
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}

export function isAuthenticated(request: FastifyRequest): boolean {
  return request.session.authenticated === true;
}

/** Constant-time comparison of the provided password against the configured one. */
export function verifyPassword(provided: string, expected: string): boolean {
  const providedHash = createHash('sha256').update(provided).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}
