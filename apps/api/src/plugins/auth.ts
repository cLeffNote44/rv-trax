// ---------------------------------------------------------------------------
// RV Trax API — Auth plugin (JWT + role guards)
// ---------------------------------------------------------------------------

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import type { UserRole } from '@rv-trax/shared';

// ── JWT payload shape -------------------------------------------------------

export interface JwtPayload {
  sub: string;
  dealershipId: string;
  role: UserRole;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: UserRole[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(fastify: FastifyInstance): Promise<void> {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  await fastify.register(fastifyJwt, {
    secret,
    sign: {
      expiresIn: '1h',
    },
  });

  // ── authenticate preHandler -----------------------------------------------

  const authenticate = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // If no Authorization header, try reading the HttpOnly access-token cookie
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      const cookieToken = (request.cookies as Record<string, string | undefined>)?.[
        'rv-trax-token'
      ];
      if (cookieToken) {
        (request.headers as Record<string, string>).authorization = `Bearer ${cookieToken}`;
      }
    }
    await request.jwtVerify();
  };

  fastify.decorate('authenticate', authenticate);

  // ── requireRole factory ----------------------------------------------------

  const requireRole = (...roles: UserRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      await request.jwtVerify();
      const userRole = request.user.role;
      if (!roles.includes(userRole as UserRole)) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: `This action requires one of the following roles: ${roles.join(', ')}`,
            details: null,
            request_id: request.id,
          },
        });
      }
    };
  };

  fastify.decorate('requireRole', requireRole);
}

export default fp(authPlugin, {
  name: 'auth',
});
