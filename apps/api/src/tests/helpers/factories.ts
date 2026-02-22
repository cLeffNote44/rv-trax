import type { FastifyInstance } from 'fastify';
import { dealerships, dealershipGroups } from '@rv-trax/db';
import { users } from '@rv-trax/db';
import { units, lots } from '@rv-trax/db';
import { trackers } from '@rv-trax/db';
import bcrypt from 'bcrypt';
import type { UserRole } from '@rv-trax/shared';

let counter = 0;
function seq(): number {
  return ++counter;
}

export async function createTestDealership(
  app: FastifyInstance,
  overrides?: Partial<{ name: string; groupId: string; tier: string }>,
): Promise<{ id: string; groupId: string }> {
  const n = seq();
  const [group] = await app.db
    .insert(dealershipGroups)
    .values({ name: `Test Group ${n}` })
    .returning();
  const [dealership] = await app.db
    .insert(dealerships)
    .values({
      groupId: overrides?.groupId ?? group!.id,
      name: overrides?.name ?? `Test Dealership ${n}`,
      address: '123 Test St',
      city: 'Tampa',
      state: 'FL',
      zip: '33614',
      subscriptionTier: overrides?.tier ?? 'professional',
      subscriptionStatus: 'active',
    })
    .returning();
  return { id: dealership!.id, groupId: group!.id };
}

export async function createTestUser(
  app: FastifyInstance,
  dealershipId: string,
  role: UserRole = 'owner',
  overrides?: Partial<{ email: string; name: string }>,
): Promise<{ id: string; email: string; role: UserRole }> {
  const n = seq();
  const passwordHash = await bcrypt.hash('Password1!', 4); // low cost for speed
  const email = overrides?.email ?? `testuser${n}@test.com`;
  const [user] = await app.db
    .insert(users)
    .values({
      dealershipId,
      email,
      passwordHash,
      name: overrides?.name ?? `Test User ${n}`,
      role,
    })
    .returning();
  return { id: user!.id, email, role };
}

export async function createTestUnit(
  app: FastifyInstance,
  dealershipId: string,
  overrides?: Partial<{
    stockNumber: string;
    status: string;
    lotId: string;
    make: string;
    year: number;
    vin: string;
    unitType: string;
  }>,
): Promise<{ id: string; stockNumber: string }> {
  const n = seq();
  const [unit] = await app.db
    .insert(units)
    .values({
      dealershipId,
      stockNumber: overrides?.stockNumber ?? `TEST-${n}`,
      vin: overrides?.vin ?? `VIN${String(n).padStart(14, '0')}`,
      year: overrides?.year ?? 2025,
      make: overrides?.make ?? 'Jayco',
      model: 'Test Model',
      unitType: overrides?.unitType ?? 'travel_trailer',
      status: overrides?.status ?? 'available',
      lotId: overrides?.lotId,
    })
    .returning();
  return { id: unit!.id, stockNumber: unit!.stockNumber };
}

export async function createTestLot(
  app: FastifyInstance,
  dealershipId: string,
  overrides?: Partial<{ name: string; totalSpots: number }>,
): Promise<{ id: string }> {
  const n = seq();
  const [lot] = await app.db
    .insert(lots)
    .values({
      dealershipId,
      name: overrides?.name ?? `Test Lot ${n}`,
      totalSpots: overrides?.totalSpots ?? 50,
    })
    .returning();
  return { id: lot!.id };
}

export async function createTestTracker(
  app: FastifyInstance,
  dealershipId: string,
  overrides?: Partial<{ deviceEui: string; status: string }>,
): Promise<{ id: string; deviceEui: string }> {
  const n = seq();
  const eui = overrides?.deviceEui ?? `TEST${String(n).padStart(12, '0')}`;
  const [tracker] = await app.db
    .insert(trackers)
    .values({
      dealershipId,
      deviceEui: eui,
      status: overrides?.status ?? 'unassigned',
      batteryPct: 85,
      lastSeenAt: new Date(),
    })
    .returning();
  return { id: tracker!.id, deviceEui: eui };
}
