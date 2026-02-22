// ---------------------------------------------------------------------------
// RV Trax — Comprehensive Database Seed Script
// Usage: pnpm db:seed  (requires DATABASE_URL env var)
// ---------------------------------------------------------------------------

import { createDb } from '../connection.js';
import { dealershipGroups, dealerships } from '../schema/dealerships.js';
import { users } from '../schema/users.js';
import { lots, lotSpots } from '../schema/lots.js';
import { units } from '../schema/units.js';
import { trackers, trackerAssignments } from '../schema/trackers.js';
import { gateways } from '../schema/gateways.js';
import { locationHistory, movementEvents } from '../schema/locations.js';
import { geoFences } from '../schema/geofences.js';
import { alertRules, alerts } from '../schema/alerts.js';
import { stagingPlans } from '../schema/staging.js';
import { stagingAssignments } from '../schema/staging-assignments.js';
import { workOrders } from '../schema/work-orders.js';
import { unitNotes } from '../schema/unit-extras.js';
import { auditLog } from '../schema/audit.js';
import { complianceSnapshots } from '../schema/compliance-snapshots.js';
import { recalls } from '../schema/recalls.js';
import { scheduledReports } from '../schema/scheduled-reports.js';
import { billingEvents } from '../schema/billing-events.js';
import { featureFlags } from '../schema/feature-flags.js';
import { apiKeys } from '../schema/api-keys.js';
import { webhookEndpoints } from '../schema/webhooks.js';
import { dmsIntegrations } from '../schema/dms-integrations.js';
import { unitTransfers } from '../schema/transfers.js';
import { widgetConfigs } from '../schema/widget-configs.js';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomVin(): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  let vin = '';
  for (let i = 0; i < 17; i++) {
    vin += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return vin;
}

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600000);
}

function daysAgo(d: number): Date {
  return new Date(Date.now() - d * 86400000);
}

// ---------------------------------------------------------------------------
// Seed data constants
// ---------------------------------------------------------------------------

const MAKES_MODELS: Record<string, string[]> = {
  Jayco: ['Jay Flight', 'Eagle', 'North Point', 'Pinnacle', 'Seneca'],
  'Grand Design': ['Imagine', 'Reflection', 'Solitude', 'Transcend', 'Momentum'],
  Winnebago: ['View', 'Minnie Winnie', 'Voyage', 'Instinct', 'Micro Minnie'],
  Thor: ['Four Winds', 'Chateau', 'Venetian', 'Ace', 'Magnitude'],
  'Forest River': ['Rockwood', 'Flagstaff', 'Cherokee', 'Wildwood', 'Vibe'],
  Keystone: ['Montana', 'Cougar', 'Passport', 'Springdale', 'Bullet'],
  Coachmen: ['Catalina', 'Freelander', 'Leprechaun', 'Mirada', 'Cross Trail'],
  Airstream: ['Classic', 'Flying Cloud', 'International', 'Basecamp', 'Bambi'],
};

const UNIT_TYPES = [
  'motorhome',
  'fifth_wheel',
  'travel_trailer',
  'toy_hauler',
  'truck_camper',
  'popup',
  'van',
] as const;

const FLOORPLANS = [
  '28BHS', '32RS', '36QBOK', '24RBS', '29TBS',
  '21MBH', '30DS', '27BHS', '38FKTS', '22MLE',
  '26BH', '33BHTS',
] as const;

// Sunshine status distribution: new_arrival(3), pdi_pending(3), lot_ready(5),
// available(15), hold(3), shown(2), deposit(2), sold(3), in_service(2), pending_delivery(2)
const SUNSHINE_STATUS_POOL: string[] = [
  ...Array<string>(3).fill('new_arrival'),
  ...Array<string>(3).fill('pdi_pending'),
  ...Array<string>(5).fill('lot_ready'),
  ...Array<string>(15).fill('available'),
  ...Array<string>(3).fill('hold'),
  ...Array<string>(2).fill('shown'),
  ...Array<string>(2).fill('deposit'),
  ...Array<string>(3).fill('sold'),
  ...Array<string>(2).fill('in_service'),
  ...Array<string>(2).fill('pending_delivery'),
];

const MV_STATUSES = [
  'new_arrival', 'pdi_pending', 'lot_ready', 'available', 'available',
  'available', 'available', 'available', 'hold', 'shown',
  'deposit', 'sold', 'in_service', 'lot_ready', 'available',
] as const;

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const { db, client } = createDb(databaseUrl);

  try {
    console.log('Seeding RV Trax database...\n');

    // Pre-compute password hash once for all users
    const passwordHash = bcrypt.hashSync('Password1!', 10);
    const makes = Object.keys(MAKES_MODELS);

    // ── 1. Dealership Group ─────────────────────────────────────────────
    const [group] = await db
      .insert(dealershipGroups)
      .values({ name: 'Southeast RV Alliance' })
      .returning();

    console.log('  \u2713 1 dealership group (Southeast RV Alliance)');

    // ── 2. Dealerships ──────────────────────────────────────────────────
    const [sunshineDealer, mountainDealer] = await db
      .insert(dealerships)
      .values([
        {
          groupId: group!.id,
          name: 'Sunshine RV Center',
          address: '4501 W Hillsborough Ave',
          city: 'Tampa',
          state: 'FL',
          zip: '33614',
          timezone: 'America/New_York',
          subscriptionTier: 'professional',
          subscriptionStatus: 'active',
          settings: { enableSms: true, defaultMapZoom: 17 },
        },
        {
          groupId: group!.id,
          name: 'Mountain View RV',
          address: '210 Tunnel Rd',
          city: 'Asheville',
          state: 'NC',
          zip: '28805',
          timezone: 'America/New_York',
          subscriptionTier: 'starter',
          subscriptionStatus: 'active',
          settings: { enableSms: false, defaultMapZoom: 16 },
        },
      ])
      .returning();

    const sunId = sunshineDealer!.id;
    const mvId = mountainDealer!.id;

    console.log('  \u2713 2 dealerships (Sunshine RV Center, Mountain View RV)');

    // ── 3. Lots ─────────────────────────────────────────────────────────
    const [sunMainLot, sunOverflowLot, mvMainLot] = await db
      .insert(lots)
      .values([
        {
          dealershipId: sunId,
          name: 'Main Lot',
          address: '4501 W Hillsborough Ave, Tampa, FL 33614',
          totalSpots: 100,
          boundary: JSON.stringify({
            type: 'Polygon',
            coordinates: [[
              [-82.5080, 27.9620],
              [-82.5060, 27.9620],
              [-82.5060, 27.9600],
              [-82.5080, 27.9600],
              [-82.5080, 27.9620],
            ]],
          }),
        },
        {
          dealershipId: sunId,
          name: 'Overflow Lot',
          address: '4515 W Hillsborough Ave, Tampa, FL 33614',
          totalSpots: 50,
          boundary: JSON.stringify({
            type: 'Polygon',
            coordinates: [[
              [-82.5100, 27.9620],
              [-82.5080, 27.9620],
              [-82.5080, 27.9600],
              [-82.5100, 27.9600],
              [-82.5100, 27.9620],
            ]],
          }),
        },
        {
          dealershipId: mvId,
          name: 'Main Lot',
          address: '210 Tunnel Rd, Asheville, NC 28805',
          totalSpots: 40,
          boundary: JSON.stringify({
            type: 'Polygon',
            coordinates: [[
              [-82.5510, 35.5950],
              [-82.5490, 35.5950],
              [-82.5490, 35.5930],
              [-82.5510, 35.5930],
              [-82.5510, 35.5950],
            ]],
          }),
        },
      ])
      .returning();

    console.log('  \u2713 3 lots (Main: 100 spots, Overflow: 50 spots, MV Main: 40 spots)');

    // ── 4. Lot Spots ────────────────────────────────────────────────────
    const allSpots: Array<{
      lotId: string;
      rowLabel: string;
      spotNumber: number;
      spotType: string;
      centerLat: string;
      centerLng: string;
      widthFt: string;
      depthFt: string;
    }> = [];

    // Sunshine Main Lot: rows A-J x 10
    for (let rowIdx = 0; rowIdx < 10; rowIdx++) {
      const rowLabel = String.fromCharCode(65 + rowIdx);
      for (let spot = 1; spot <= 10; spot++) {
        allSpots.push({
          lotId: sunMainLot!.id,
          rowLabel,
          spotNumber: spot,
          spotType: 'standard',
          centerLat: (27.960 + rowIdx * 0.0002).toFixed(6),
          centerLng: (-82.508 + spot * 0.0002).toFixed(6),
          widthFt: '12',
          depthFt: '50',
        });
      }
    }

    // Sunshine Overflow Lot: rows A-E x 10
    for (let rowIdx = 0; rowIdx < 5; rowIdx++) {
      const rowLabel = String.fromCharCode(65 + rowIdx);
      for (let spot = 1; spot <= 10; spot++) {
        allSpots.push({
          lotId: sunOverflowLot!.id,
          rowLabel,
          spotNumber: spot,
          spotType: 'standard',
          centerLat: (27.960 + rowIdx * 0.0002).toFixed(6),
          centerLng: (-82.510 + spot * 0.0002).toFixed(6),
          widthFt: '12',
          depthFt: '50',
        });
      }
    }

    // Mountain View Main Lot: rows A-D x 10
    for (let rowIdx = 0; rowIdx < 4; rowIdx++) {
      const rowLabel = String.fromCharCode(65 + rowIdx);
      for (let spot = 1; spot <= 10; spot++) {
        allSpots.push({
          lotId: mvMainLot!.id,
          rowLabel,
          spotNumber: spot,
          spotType: 'standard',
          centerLat: (35.593 + rowIdx * 0.0002).toFixed(6),
          centerLng: (-82.551 + spot * 0.0002).toFixed(6),
          widthFt: '12',
          depthFt: '50',
        });
      }
    }

    const insertedSpots = await db.insert(lotSpots).values(allSpots).returning();

    // ── 5. Users ────────────────────────────────────────────────────────
    const insertedUsers = await db
      .insert(users)
      .values([
        // Sunshine RV users
        { dealershipId: sunId, email: 'owner@sunshinervs.com', passwordHash, name: 'Sarah Mitchell', role: 'owner' },
        { dealershipId: sunId, email: 'manager@sunshinervs.com', passwordHash, name: 'James Rodriguez', role: 'manager' },
        { dealershipId: sunId, email: 'sales@sunshinervs.com', passwordHash, name: 'Emily Chen', role: 'sales' },
        { dealershipId: sunId, email: 'service@sunshinervs.com', passwordHash, name: 'Mike Thompson', role: 'service' },
        { dealershipId: sunId, email: 'porter@sunshinervs.com', passwordHash, name: 'David Garcia', role: 'porter' },
        { dealershipId: sunId, email: 'viewer@sunshinervs.com', passwordHash, name: 'Linda Park', role: 'viewer' },
        // Mountain View RV users
        { dealershipId: mvId, email: 'owner@mountainviewrv.com', passwordHash, name: 'Tom Bradley', role: 'owner' },
        { dealershipId: mvId, email: 'manager@mountainviewrv.com', passwordHash, name: 'Rachel Kim', role: 'manager' },
        { dealershipId: mvId, email: 'sales@mountainviewrv.com', passwordHash, name: 'Alex Turner', role: 'sales' },
      ])
      .returning();

    const sunOwner = insertedUsers[0]!;
    const sunManager = insertedUsers[1]!;
    const sunSales = insertedUsers[2]!;
    const sunService = insertedUsers[3]!;
    const sunPorter = insertedUsers[4]!;
    // insertedUsers[5] = Linda Park (viewer) — referenced via insertedUsers
    const mvOwner = insertedUsers[6]!;
    // insertedUsers[7] = Rachel Kim (manager) — referenced via insertedUsers

    console.log('  \u2713 9 users (6 Sunshine + 3 Mountain View)');

    // ── 6. Units ────────────────────────────────────────────────────────
    const unitValues: Array<{
      dealershipId: string;
      lotId: string;
      stockNumber: string;
      vin: string;
      year: number;
      make: string;
      model: string;
      floorplan: string;
      unitType: string;
      lengthFt: string;
      msrp: string;
      status: string;
      currentZone: string;
      currentRow: string;
      currentSpot: number;
    }> = [];

    // 40 Sunshine units
    for (let i = 0; i < 40; i++) {
      const make = randomPick(makes);
      const models = MAKES_MODELS[make]!;
      const model = randomPick(models);
      const lotId = i < 30 ? sunMainLot!.id : sunOverflowLot!.id;
      const rowIndex = i < 30 ? Math.floor(i / 10) : Math.floor((i - 30) / 10);
      const spotIndex = i < 30 ? (i % 10) + 1 : ((i - 30) % 10) + 1;
      const rowLabel = String.fromCharCode(65 + rowIndex);

      unitValues.push({
        dealershipId: sunId,
        lotId,
        stockNumber: `S${String(25000 + i + 1).padStart(5, '0')}`,
        vin: randomVin(),
        year: randomInt(2023, 2026),
        make,
        model,
        floorplan: randomPick(FLOORPLANS),
        unitType: randomPick(UNIT_TYPES),
        lengthFt: randomInt(18, 45).toString(),
        msrp: randomInt(22000, 185000).toString(),
        status: SUNSHINE_STATUS_POOL[i]!,
        currentZone: i < 30 ? 'main' : 'overflow',
        currentRow: rowLabel,
        currentSpot: spotIndex,
      });
    }

    // 15 Mountain View units
    for (let i = 0; i < 15; i++) {
      const make = randomPick(makes);
      const models = MAKES_MODELS[make]!;
      const model = randomPick(models);
      const rowIndex = Math.floor(i / 10);
      const spotIndex = (i % 10) + 1;
      const rowLabel = String.fromCharCode(65 + rowIndex);

      unitValues.push({
        dealershipId: mvId,
        lotId: mvMainLot!.id,
        stockNumber: `MV${String(10000 + i + 1).padStart(5, '0')}`,
        vin: randomVin(),
        year: randomInt(2023, 2026),
        make,
        model,
        floorplan: randomPick(FLOORPLANS),
        unitType: randomPick(UNIT_TYPES),
        lengthFt: randomInt(18, 45).toString(),
        msrp: randomInt(22000, 185000).toString(),
        status: MV_STATUSES[i]!,
        currentZone: 'main',
        currentRow: rowLabel,
        currentSpot: spotIndex,
      });
    }

    const insertedUnits = await db.insert(units).values(unitValues).returning();
    const sunUnits = insertedUnits.slice(0, 40);
    const mvUnits = insertedUnits.slice(40);

    console.log('  \u2713 55 units (40 Sunshine + 15 Mountain View)');

    // ── 7. Trackers ─────────────────────────────────────────────────────
    const trackerValues: Array<{
      dealershipId: string;
      deviceEui: string;
      label: string;
      firmwareVersion: string;
      status: string;
      batteryPct: number;
      batteryMv: number;
      lastSeenAt: Date;
      lastLatitude: string;
      lastLongitude: string;
      signalRssi: number;
    }> = [];

    // 50 Sunshine trackers
    for (let i = 0; i < 50; i++) {
      const hexSuffix = (i + 1).toString(16).toUpperCase().padStart(4, '0');
      const batteryPct = randomInt(15, 100);
      const isAssigned = i < 35;

      trackerValues.push({
        dealershipId: sunId,
        deviceEui: `A84041${hexSuffix}`,
        label: `SUN-Tracker-${i + 1}`,
        firmwareVersion: `1.${randomInt(0, 3)}.${randomInt(0, 9)}`,
        status: isAssigned ? 'assigned' : 'unassigned',
        batteryPct,
        batteryMv: 2400 + batteryPct * 12,
        lastSeenAt: new Date(Date.now() - randomInt(0, 86400000)),
        lastLatitude: (27.960 + Math.random() * 0.002).toFixed(6),
        lastLongitude: (-82.510 + Math.random() * 0.004).toFixed(6),
        signalRssi: -1 * randomInt(40, 120),
      });
    }

    // 15 Mountain View trackers
    for (let i = 0; i < 15; i++) {
      const hexSuffix = (50 + i + 1).toString(16).toUpperCase().padStart(4, '0');
      const batteryPct = randomInt(15, 100);
      const isAssigned = i < 10;

      trackerValues.push({
        dealershipId: mvId,
        deviceEui: `A84041${hexSuffix}`,
        label: `MV-Tracker-${i + 1}`,
        firmwareVersion: `1.${randomInt(0, 3)}.${randomInt(0, 9)}`,
        status: isAssigned ? 'assigned' : 'unassigned',
        batteryPct,
        batteryMv: 2400 + batteryPct * 12,
        lastSeenAt: new Date(Date.now() - randomInt(0, 86400000)),
        lastLatitude: (35.593 + Math.random() * 0.002).toFixed(6),
        lastLongitude: (-82.551 + Math.random() * 0.002).toFixed(6),
        signalRssi: -1 * randomInt(40, 120),
      });
    }

    const insertedTrackers = await db.insert(trackers).values(trackerValues).returning();
    const sunTrackers = insertedTrackers.slice(0, 50);
    const mvTrackers = insertedTrackers.slice(50);

    console.log('  \u2713 65 trackers (50 Sunshine + 15 Mountain View)');

    // ── 8. Tracker Assignments ──────────────────────────────────────────
    const assignmentValues: Array<{
      trackerId: string;
      unitId: string;
      assignedBy: string;
    }> = [];

    // First 35 Sunshine trackers -> first 35 Sunshine units
    for (let i = 0; i < 35; i++) {
      assignmentValues.push({
        trackerId: sunTrackers[i]!.id,
        unitId: sunUnits[i]!.id,
        assignedBy: sunOwner.id,
      });
    }

    // First 10 MV trackers -> first 10 MV units
    for (let i = 0; i < 10; i++) {
      assignmentValues.push({
        trackerId: mvTrackers[i]!.id,
        unitId: mvUnits[i]!.id,
        assignedBy: mvOwner.id,
      });
    }

    await db.insert(trackerAssignments).values(assignmentValues);

    console.log('  \u2713 45 tracker assignments (35 + 10)');

    // ── 9. Gateways ────────────────────────────────────────────────────
    await db.insert(gateways).values([
      {
        dealershipId: sunId,
        lotId: sunMainLot!.id,
        gatewayEui: 'GW01A8404100',
        name: 'Main Lot Gateway North',
        latitude: '27.9620',
        longitude: '-82.5070',
        backhaulType: 'ethernet',
        status: 'online',
        lastSeenAt: new Date(),
        firmwareVersion: '2.1.0',
      },
      {
        dealershipId: sunId,
        lotId: sunMainLot!.id,
        gatewayEui: 'GW02A8404100',
        name: 'Main Lot Gateway South',
        latitude: '27.9600',
        longitude: '-82.5070',
        backhaulType: 'ethernet',
        status: 'online',
        lastSeenAt: new Date(),
        firmwareVersion: '2.1.0',
      },
      {
        dealershipId: sunId,
        lotId: sunOverflowLot!.id,
        gatewayEui: 'GW03A8404100',
        name: 'Overflow Lot Gateway East',
        latitude: '27.9610',
        longitude: '-82.5090',
        backhaulType: 'cellular',
        status: 'online',
        lastSeenAt: new Date(),
        firmwareVersion: '2.0.5',
      },
      {
        dealershipId: sunId,
        lotId: sunOverflowLot!.id,
        gatewayEui: 'GW04A8404100',
        name: 'Overflow Lot Gateway West',
        latitude: '27.9610',
        longitude: '-82.5095',
        backhaulType: 'cellular',
        status: 'offline',
        lastSeenAt: hoursAgo(6),
        firmwareVersion: '2.0.5',
      },
      {
        dealershipId: mvId,
        lotId: mvMainLot!.id,
        gatewayEui: 'GW05A8404100',
        name: 'MV Main Gateway North',
        latitude: '35.5950',
        longitude: '-82.5500',
        backhaulType: 'ethernet',
        status: 'online',
        lastSeenAt: new Date(),
        firmwareVersion: '2.1.0',
      },
      {
        dealershipId: mvId,
        lotId: mvMainLot!.id,
        gatewayEui: 'GW06A8404100',
        name: 'MV Main Gateway South',
        latitude: '35.5930',
        longitude: '-82.5500',
        backhaulType: 'ethernet',
        status: 'online',
        lastSeenAt: new Date(),
        firmwareVersion: '2.1.0',
      },
    ]);

    console.log('  \u2713 6 gateways');

    // ── 10. Location History ────────────────────────────────────────────
    const locationValues: Array<{
      time: Date;
      trackerId: string;
      unitId: string;
      dealershipId: string;
      latitude: string;
      longitude: string;
      accuracyMeters: string;
      zone: string;
      rowLabel: string;
      source: string;
    }> = [];

    // 200 for Sunshine, spread over last 48h
    for (let i = 0; i < 200; i++) {
      const tIdx = i % 35; // use assigned trackers
      const tracker = sunTrackers[tIdx]!;
      const unit = sunUnits[tIdx]!;

      locationValues.push({
        time: new Date(Date.now() - randomInt(0, 48 * 3600000)),
        trackerId: tracker.id,
        unitId: unit.id,
        dealershipId: sunId,
        latitude: (27.960 + Math.random() * 0.002).toFixed(6),
        longitude: (-82.508 + Math.random() * 0.002).toFixed(6),
        accuracyMeters: randomInt(1, 15).toFixed(1),
        zone: 'main',
        rowLabel: String.fromCharCode(65 + randomInt(0, 9)),
        source: randomPick(['gps', 'rssi']),
      });
    }

    // 50 for Mountain View
    for (let i = 0; i < 50; i++) {
      const tIdx = i % 10;
      const tracker = mvTrackers[tIdx]!;
      const unit = mvUnits[tIdx]!;

      locationValues.push({
        time: new Date(Date.now() - randomInt(0, 48 * 3600000)),
        trackerId: tracker.id,
        unitId: unit.id,
        dealershipId: mvId,
        latitude: (35.593 + Math.random() * 0.002).toFixed(6),
        longitude: (-82.551 + Math.random() * 0.002).toFixed(6),
        accuracyMeters: randomInt(1, 15).toFixed(1),
        zone: 'main',
        rowLabel: String.fromCharCode(65 + randomInt(0, 3)),
        source: randomPick(['gps', 'rssi']),
      });
    }

    await db.insert(locationHistory).values(locationValues);

    console.log('  \u2713 250 location history entries');

    // ── 11. Movement Events ─────────────────────────────────────────────
    const movementValues: Array<{
      unitId: string;
      dealershipId: string;
      fromZone: string;
      fromRow: string;
      fromSpot: number;
      toZone: string;
      toRow: string;
      toSpot: number;
      distanceMeters: string;
      occurredAt: Date;
    }> = [];

    for (let i = 0; i < 20; i++) {
      const unit = sunUnits[randomInt(0, 34)]!;
      const fromRow = String.fromCharCode(65 + randomInt(0, 9));
      const toRow = String.fromCharCode(65 + randomInt(0, 9));

      movementValues.push({
        unitId: unit.id,
        dealershipId: sunId,
        fromZone: 'main',
        fromRow,
        fromSpot: randomInt(1, 10),
        toZone: randomPick(['main', 'overflow', 'service']),
        toRow,
        toSpot: randomInt(1, 10),
        distanceMeters: randomInt(10, 200).toFixed(1),
        occurredAt: new Date(Date.now() - randomInt(0, 48 * 3600000)),
      });
    }

    await db.insert(movementEvents).values(movementValues);

    console.log('  \u2713 20 movement events');

    // ── 12. Geofences ───────────────────────────────────────────────────
    await db.insert(geoFences).values([
      // Sunshine Main Lot
      {
        lotId: sunMainLot!.id,
        dealershipId: sunId,
        name: 'Main Lot Boundary',
        fenceType: 'lot_boundary',
        boundary: JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [-82.5080, 27.9620], [-82.5060, 27.9620],
            [-82.5060, 27.9600], [-82.5080, 27.9600],
            [-82.5080, 27.9620],
          ]],
        }),
        color: '#3B82F6',
      },
      {
        lotId: sunMainLot!.id,
        dealershipId: sunId,
        name: 'Service Area',
        fenceType: 'service_area',
        boundary: JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [-82.5075, 27.9615], [-82.5065, 27.9615],
            [-82.5065, 27.9605], [-82.5075, 27.9605],
            [-82.5075, 27.9615],
          ]],
        }),
        color: '#EF4444',
      },
      {
        lotId: sunMainLot!.id,
        dealershipId: sunId,
        name: 'Staging Area',
        fenceType: 'staging_area',
        boundary: JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [-82.5064, 27.9618], [-82.5060, 27.9618],
            [-82.5060, 27.9610], [-82.5064, 27.9610],
            [-82.5064, 27.9618],
          ]],
        }),
        color: '#F59E0B',
      },
      {
        lotId: sunMainLot!.id,
        dealershipId: sunId,
        name: 'Display Zone',
        fenceType: 'display_zone',
        boundary: JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [-82.5078, 27.9618], [-82.5070, 27.9618],
            [-82.5070, 27.9612], [-82.5078, 27.9612],
            [-82.5078, 27.9618],
          ]],
        }),
        color: '#10B981',
      },
      // Sunshine Overflow Lot
      {
        lotId: sunOverflowLot!.id,
        dealershipId: sunId,
        name: 'Overflow Lot Boundary',
        fenceType: 'lot_boundary',
        boundary: JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [-82.5100, 27.9620], [-82.5080, 27.9620],
            [-82.5080, 27.9600], [-82.5100, 27.9600],
            [-82.5100, 27.9620],
          ]],
        }),
        color: '#3B82F6',
      },
      // Mountain View
      {
        lotId: mvMainLot!.id,
        dealershipId: mvId,
        name: 'MV Main Lot Boundary',
        fenceType: 'lot_boundary',
        boundary: JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [-82.5510, 35.5950], [-82.5490, 35.5950],
            [-82.5490, 35.5930], [-82.5510, 35.5930],
            [-82.5510, 35.5950],
          ]],
        }),
        color: '#3B82F6',
      },
      {
        lotId: mvMainLot!.id,
        dealershipId: mvId,
        name: 'MV Service Area',
        fenceType: 'service_area',
        boundary: JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [-82.5508, 35.5948], [-82.5500, 35.5948],
            [-82.5500, 35.5940], [-82.5508, 35.5940],
            [-82.5508, 35.5948],
          ]],
        }),
        color: '#EF4444',
      },
    ]);

    console.log('  \u2713 7 geofences');

    // ── 13. Alert Rules ─────────────────────────────────────────────────
    const insertedAlertRules = await db
      .insert(alertRules)
      .values([
        {
          dealershipId: sunId,
          ruleType: 'geofence_breach',
          severity: 'warning',
          channels: 'in_app,push',
          parameters: {},
        },
        {
          dealershipId: sunId,
          ruleType: 'battery_low',
          severity: 'critical',
          channels: 'in_app,email',
          parameters: { thresholdPct: 20 },
        },
        {
          dealershipId: sunId,
          ruleType: 'idle_timeout',
          severity: 'info',
          channels: 'in_app',
          parameters: { hoursThreshold: 72 },
        },
      ])
      .returning();

    console.log('  \u2713 3 alert rules');

    // ── 14. Alerts ──────────────────────────────────────────────────────
    const alertStatuses = [
      'new_alert', 'new_alert', 'new_alert', 'new_alert', 'new_alert',
      'acknowledged', 'acknowledged', 'acknowledged',
      'dismissed', 'dismissed',
    ] as const;

    const alertTypes = [
      'geofence_breach', 'geofence_breach', 'geofence_breach',
      'battery_low', 'battery_low', 'battery_low',
      'idle_timeout', 'idle_timeout', 'idle_timeout', 'idle_timeout',
    ] as const;

    const alertValues: Array<{
      dealershipId: string;
      ruleId: string;
      alertType: string;
      severity: string;
      title: string;
      message: string;
      unitId: string;
      trackerId: string;
      status: string;
      acknowledgedBy: string | null;
      acknowledgedAt: Date | null;
      createdAt: Date;
    }> = [];

    for (let i = 0; i < 10; i++) {
      const alertType = alertTypes[i]!;
      const ruleIdx = alertType === 'geofence_breach' ? 0 : alertType === 'battery_low' ? 1 : 2;
      const unitIdx = randomInt(0, 34);
      const status = alertStatuses[i]!;
      const isAcknowledged = status === 'acknowledged';

      alertValues.push({
        dealershipId: sunId,
        ruleId: insertedAlertRules[ruleIdx]!.id,
        alertType,
        severity: alertType === 'battery_low' ? 'critical' : alertType === 'geofence_breach' ? 'warning' : 'info',
        title: alertType === 'geofence_breach'
          ? `Unit ${sunUnits[unitIdx]!.stockNumber} left lot boundary`
          : alertType === 'battery_low'
            ? `Tracker ${sunTrackers[unitIdx]!.deviceEui} battery critical`
            : `Unit ${sunUnits[unitIdx]!.stockNumber} idle for 72+ hours`,
        message: alertType === 'geofence_breach'
          ? 'Unit detected outside designated geofence boundary.'
          : alertType === 'battery_low'
            ? 'Tracker battery has dropped below 20%. Replace soon.'
            : 'Unit has not moved in over 72 hours. Consider repositioning.',
        unitId: sunUnits[unitIdx]!.id,
        trackerId: sunTrackers[unitIdx]!.id,
        status,
        acknowledgedBy: isAcknowledged ? sunManager.id : null,
        acknowledgedAt: isAcknowledged ? hoursAgo(randomInt(1, 12)) : null,
        createdAt: hoursAgo(randomInt(1, 72)),
      });
    }

    await db.insert(alerts).values(alertValues);

    console.log('  \u2713 10 alerts');

    // ── 15. Staging Plan + Assignments ──────────────────────────────────
    const [stagingPlan] = await db
      .insert(stagingPlans)
      .values({
        lotId: sunMainLot!.id,
        dealershipId: sunId,
        name: 'Spring Display Layout',
        isActive: true,
        activatedAt: daysAgo(7),
        rules: [
          { ruleType: 'by_type', config: { types: ['motorhome', 'fifth_wheel'], zone: 'A' } },
          { ruleType: 'by_price_range', config: { min: 50000, max: 100000, zone: 'B' } },
        ],
      })
      .returning();

    // 8 staging assignments
    const stagingStatuses = [
      'pending', 'pending', 'pending',
      'in_progress', 'in_progress',
      'completed', 'completed', 'completed',
    ] as const;

    // Get relevant spot IDs from Sunshine Main Lot (first 100 spots in insertedSpots)
    const sunMainSpots = insertedSpots.slice(0, 100);

    const stagingAssignmentValues: Array<{
      planId: string;
      unitId: string;
      spotId: string;
      targetRow: string;
      targetSpot: number;
      status: string;
      priority: number;
      completedAt: Date | null;
    }> = [];

    for (let i = 0; i < 8; i++) {
      const status = stagingStatuses[i]!;
      const targetRow = String.fromCharCode(65 + randomInt(0, 3)); // A-D
      const targetSpot = randomInt(1, 10);
      const spotIdx = (targetRow.charCodeAt(0) - 65) * 10 + (targetSpot - 1);

      stagingAssignmentValues.push({
        planId: stagingPlan!.id,
        unitId: sunUnits[i]!.id,
        spotId: sunMainSpots[spotIdx]!.id,
        targetRow,
        targetSpot,
        status,
        priority: 8 - i,
        completedAt: status === 'completed' ? hoursAgo(randomInt(1, 24)) : null,
      });
    }

    await db.insert(stagingAssignments).values(stagingAssignmentValues);

    console.log('  \u2713 1 staging plan + 8 assignments');

    // ── 16. Work Orders ─────────────────────────────────────────────────
    const woTypes = ['pdi', 'pdi', 'winterize', 'warranty', 'warranty', 'recall', 'detail', 'detail'] as const;
    const woStatuses = ['pending', 'pending', 'assigned', 'assigned', 'in_progress', 'in_progress', 'complete', 'complete'] as const;
    const woPriorities = ['high', 'normal', 'normal', 'high', 'normal', 'urgent', 'normal', 'low'] as const;

    const workOrderValues: Array<{
      dealershipId: string;
      unitId: string;
      orderType: string;
      priority: string;
      status: string;
      assignedTo: string | null;
      notes: string;
      dueDate: string;
    }> = [];

    for (let i = 0; i < 8; i++) {
      const status = woStatuses[i]!;
      workOrderValues.push({
        dealershipId: sunId,
        unitId: sunUnits[randomInt(0, 39)]!.id,
        orderType: woTypes[i]!,
        priority: woPriorities[i]!,
        status,
        assignedTo: (status === 'assigned' || status === 'in_progress' || status === 'complete')
          ? sunService.id
          : null,
        notes: `Seed work order #${i + 1}: ${woTypes[i]} task.`,
        dueDate: new Date(Date.now() + randomInt(-3, 10) * 86400000).toISOString().split('T')[0]!,
      });
    }

    await db.insert(workOrders).values(workOrderValues);

    console.log('  \u2713 8 work orders');

    // ── 17. Unit Notes ──────────────────────────────────────────────────
    const noteContents = [
      'Customer expressed strong interest during walkthrough. Follow up by end of week.',
      'Minor cosmetic scratch on passenger side. Documented with photos.',
      'PDI complete. All systems checked and operational. Ready for lot.',
      'Awning mechanism slightly stiff. Lubricated per maintenance protocol.',
      'VIP customer hold placed. Do not reassign spot.',
    ] as const;

    const noteUsers = [sunSales, sunService, sunService, sunPorter, sunManager];

    const noteValues: Array<{
      unitId: string;
      userId: string;
      content: string;
    }> = [];

    for (let i = 0; i < 5; i++) {
      noteValues.push({
        unitId: sunUnits[randomInt(0, 39)]!.id,
        userId: noteUsers[i]!.id,
        content: noteContents[i]!,
      });
    }

    await db.insert(unitNotes).values(noteValues);

    console.log('  \u2713 5 unit notes');

    // ── 18. Audit Log ───────────────────────────────────────────────────
    const auditActions = [
      'create', 'create', 'create', 'create',
      'update', 'update', 'update',
      'assign', 'assign',
      'status_change', 'status_change', 'status_change',
      'login', 'login',
      'invite',
    ] as const;

    const auditEntities = [
      'unit', 'unit', 'tracker', 'work_order',
      'unit', 'tracker', 'unit',
      'tracker', 'tracker',
      'unit', 'unit', 'work_order',
      'user', 'user',
      'user',
    ] as const;

    const auditValues: Array<{
      dealershipId: string;
      userId: string;
      action: string;
      entityType: string;
      entityId: string;
      changes: object;
      ipAddress: string;
      userAgent: string;
      createdAt: Date;
    }> = [];

    const auditUsers = [sunOwner, sunManager, sunService, sunSales, sunPorter];

    for (let i = 0; i < 15; i++) {
      const action = auditActions[i]!;
      const entityType = auditEntities[i]!;
      let entityId: string;

      if (entityType === 'unit') {
        entityId = sunUnits[randomInt(0, 39)]!.id;
      } else if (entityType === 'tracker') {
        entityId = sunTrackers[randomInt(0, 49)]!.id;
      } else if (entityType === 'work_order') {
        entityId = sunUnits[0]!.id; // placeholder reference
      } else {
        entityId = randomPick(auditUsers).id;
      }

      auditValues.push({
        dealershipId: sunId,
        userId: randomPick(auditUsers).id,
        action,
        entityType,
        entityId,
        changes: action === 'status_change'
          ? { from: 'new_arrival', to: 'lot_ready' }
          : action === 'login'
            ? { method: 'password' }
            : { seeded: true },
        ipAddress: `192.168.1.${randomInt(10, 200)}`,
        userAgent: 'Mozilla/5.0 (RV Trax Seed)',
        createdAt: hoursAgo(randomInt(1, 168)),
      });
    }

    await db.insert(auditLog).values(auditValues);

    console.log('  \u2713 15 audit log entries');

    // ── 19. Compliance Snapshots ────────────────────────────────────────
    const scores = [72, 76, 80, 84, 88] as const;

    const complianceValues: Array<{
      lotId: string;
      dealershipId: string;
      totalTracked: number;
      inCorrectZone: number;
      scorePct: string;
      snapshotAt: Date;
    }> = [];

    for (let i = 0; i < 5; i++) {
      const score = scores[i]!;
      const total = 35;
      const correct = Math.round(total * score / 100);

      complianceValues.push({
        lotId: sunMainLot!.id,
        dealershipId: sunId,
        totalTracked: total,
        inCorrectZone: correct,
        scorePct: score.toString(),
        snapshotAt: daysAgo(5 - i),
      });
    }

    await db.insert(complianceSnapshots).values(complianceValues);

    console.log('  \u2713 5 compliance snapshots');

    // ── 20. Recalls ─────────────────────────────────────────────────────
    await db.insert(recalls).values([
      {
        dealershipId: sunId,
        title: 'Jayco Slide-Out Recall 2024',
        description: 'Potential failure in slide-out mechanism actuator. Inspect and replace if needed.',
        affectedMakes: 'Jayco',
        affectedYearStart: 2023,
        affectedYearEnd: 2025,
        status: 'open',
        matchedUnitCount: 4,
      },
      {
        dealershipId: sunId,
        title: 'Thor Propane Valve Recall',
        description: 'Propane gas valve may not seal properly. Immediate inspection required.',
        affectedMakes: 'Thor',
        affectedYearStart: 2024,
        affectedYearEnd: 2026,
        status: 'in_progress',
        matchedUnitCount: 3,
      },
    ]);

    console.log('  \u2713 2 recalls');

    // ── 21. Scheduled Reports ───────────────────────────────────────────
    await db.insert(scheduledReports).values([
      {
        dealershipId: sunId,
        reportType: 'inventory_summary',
        schedule: 'weekly',
        format: 'pdf',
        recipients: 'owner@sunshinervs.com,manager@sunshinervs.com',
        lastRunAt: daysAgo(3),
        nextRunAt: new Date(Date.now() + 4 * 86400000),
      },
      {
        dealershipId: sunId,
        reportType: 'aging_report',
        schedule: 'monthly',
        format: 'csv',
        recipients: 'owner@sunshinervs.com',
        lastRunAt: daysAgo(15),
        nextRunAt: new Date(Date.now() + 15 * 86400000),
      },
    ]);

    console.log('  \u2713 2 scheduled reports');

    // ── 22. Billing Events ──────────────────────────────────────────────
    await db.insert(billingEvents).values([
      {
        dealershipId: sunId,
        eventType: 'invoice.paid',
        stripeEventId: 'evt_seed_001',
        amountCents: 14900,
        currency: 'usd',
        details: JSON.stringify({ invoiceId: 'inv_seed_001', description: 'Professional tier - monthly' }),
        processedAt: daysAgo(30),
      },
      {
        dealershipId: sunId,
        eventType: 'invoice.paid',
        stripeEventId: 'evt_seed_002',
        amountCents: 14900,
        currency: 'usd',
        details: JSON.stringify({ invoiceId: 'inv_seed_002', description: 'Professional tier - monthly' }),
        processedAt: daysAgo(60),
      },
      {
        dealershipId: sunId,
        eventType: 'customer.subscription.updated',
        stripeEventId: 'evt_seed_003',
        amountCents: null,
        currency: 'usd',
        details: JSON.stringify({ previousTier: 'starter', newTier: 'professional' }),
        processedAt: daysAgo(90),
      },
    ]);

    console.log('  \u2713 3 billing events');

    // ── 23. Feature Flags ───────────────────────────────────────────────
    const sunshineFeatures = ['staging', 'analytics', 'recalls', 'geofencing', 'sms_alerts', 'dms_integration', 'public_api'] as const;
    const mvFeatures = ['staging', 'analytics', 'geofencing'] as const;

    const featureFlagValues: Array<{
      dealershipId: string;
      feature: string;
      enabled: boolean;
    }> = [];

    for (const feature of sunshineFeatures) {
      featureFlagValues.push({ dealershipId: sunId, feature, enabled: true });
    }
    for (const feature of mvFeatures) {
      featureFlagValues.push({ dealershipId: mvId, feature, enabled: true });
    }

    await db.insert(featureFlags).values(featureFlagValues);

    console.log('  \u2713 10 feature flags');

    // ── 24. API Key ─────────────────────────────────────────────────────
    const keyHash = crypto.createHash('sha256').update('rvtrax_demo_key_001').digest('hex');

    await db.insert(apiKeys).values({
      dealershipId: sunId,
      name: 'Mobile App Integration',
      keyHash,
      keyPrefix: 'rvtrax_de',
      scopes: 'read,write',
      rateLimitPerMin: 500,
    });

    console.log('  \u2713 1 API key');

    // ── 25. Webhook Endpoint ────────────────────────────────────────────
    await db.insert(webhookEndpoints).values({
      dealershipId: sunId,
      url: 'https://hooks.example.com/rvtrax',
      secret: 'whsec_demo_secret_001',
      events: 'unit.created,unit.status_changed,geofence.breach',
      status: 'active',
    });

    console.log('  \u2713 1 webhook endpoint');

    // ── 26. DMS Integration ─────────────────────────────────────────────
    await db.insert(dmsIntegrations).values({
      dealershipId: sunId,
      provider: 'lightspeed',
      config: JSON.stringify({ apiUrl: 'https://api.lightspeed.com', dealerCode: 'SUNSHINE01' }),
      syncStatus: 'success',
      lastSyncAt: hoursAgo(2),
      isActive: true,
    });

    console.log('  \u2713 1 DMS integration');

    // ── 27. Unit Transfer ───────────────────────────────────────────────
    // Find an available Sunshine unit for transfer
    const transferUnit = sunUnits.find((u) => u.status === 'available');

    await db.insert(unitTransfers).values({
      unitId: transferUnit!.id,
      fromDealershipId: sunId,
      toDealershipId: mvId,
      fromLotId: sunMainLot!.id,
      toLotId: mvMainLot!.id,
      status: 'in_transit',
      initiatedBy: sunOwner.id,
      notes: 'Transferring unit to Mountain View RV per owner request.',
      departedAt: hoursAgo(6),
    });

    console.log('  \u2713 1 unit transfer');

    // ── 28. Widget Config ───────────────────────────────────────────────
    await db.insert(widgetConfigs).values({
      dealershipId: sunId,
      themeColor: '#1E40AF',
      showStatuses: 'available,lot_ready,shown',
      showPrices: true,
      isActive: true,
    });

    console.log('  \u2713 1 widget config');

    // ── Done ────────────────────────────────────────────────────────────
    console.log('\nSeed complete! Login with:');
    console.log('  Email: owner@sunshinervs.com');
    console.log('  Password: Password1!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
