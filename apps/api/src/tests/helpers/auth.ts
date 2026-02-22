import type { FastifyInstance } from 'fastify';
import type { UserRole } from '@rv-trax/shared';

export interface TestUser {
  id: string;
  dealershipId: string;
  role: UserRole;
}

export function generateToken(app: FastifyInstance, user: TestUser): string {
  return app.jwt.sign({
    sub: user.id,
    dealershipId: user.dealershipId,
    role: user.role,
  });
}

export function authHeader(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}
