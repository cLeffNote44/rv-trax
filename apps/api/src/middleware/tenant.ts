// ---------------------------------------------------------------------------
// RV Trax API — Tenant enforcement middleware
// ---------------------------------------------------------------------------

import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    dealershipId: string;
  }
}

/**
 * preHandler that extracts dealershipId from the JWT payload and attaches
 * it to the request. All downstream queries MUST filter by this ID to
 * enforce multi-tenancy.
 */
export async function enforceTenant(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { dealershipId } = request.user;

  if (!dealershipId) {
    return reply.status(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'Missing dealership context in token',
        details: null,
        request_id: request.id,
      },
    });
  }

  request.dealershipId = dealershipId;
}
