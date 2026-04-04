// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Integration tests: Full pipeline
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { TrackerEvent, AppConfig } from '../../types.js';

// ── Module-level mocks ───────────────────────────────────────────────────────
// Mock ioredis before any import resolves it, so Redis calls are intercepted.

const redisStore = new Map<string, string>();
const streamEntries: string[][] = [];

const mockRedis = {
  set: vi.fn(
    async (
      key: string,
      value: string,
      ...args: (string | number)[]
    ): Promise<string | null> => {
      // Handle SET key value EX ttl NX pattern (returns null if key exists)
      const nxIndex = args.findIndex((a) => String(a).toUpperCase() === 'NX');
      if (nxIndex !== -1) {
        if (redisStore.has(key)) {
          return null; // Key already exists — NX condition fails
        }
      }
      redisStore.set(key, value);
      return 'OK';
    },
  ),
  xadd: vi.fn(async (..._args: unknown[]): Promise<string> => {
    // Record the fields so we can assert on them
    streamEntries.push(_args as string[]);
    return `${Date.now()}-0`;
  }),
  xlen: vi.fn(async (): Promise<number> => streamEntries.length),
};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
  Redis: vi.fn(() => mockRedis),
}));

// ── DB mock ─────────────────────────────────────────────────────────────────
// The validator calls db.select().from(trackers).where(...).limit(1).
// We simulate a chainable query builder that resolves to a known list.

const KNOWN_DEVICE_EUI = 'aabbccddeeff0011';

function makeDbMock(deviceEuis: string[]) {
  // Drizzle's fluent API: db.select(...)..from(...)..where(...)..limit(1)
  const queryBuilder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(async (n: number) => {
      // Return a tracker row if the device EUI matches any known EUI.
      // The actual WHERE clause is a drizzle expression, so we cheat by
      // checking whether the mock call arg string contains a known EUI.
      const whereArg = String(queryBuilder.where.mock.calls.at(-1)?.[0] ?? '');
      const matched = deviceEuis.find((eui) => whereArg.includes(eui));
      return matched ? [{ id: 'tracker-uuid-1' }] : [];
    }),
  };
  return {
    select: vi.fn(() => queryBuilder),
    _queryBuilder: queryBuilder,
  };
}

vi.mock('@rv-trax/db', () => {
  const eq = vi.fn((column: unknown, value: unknown) => `${String(column)}=${String(value)}`);
  const trackers = { id: 'trackers.id', deviceEui: 'trackers.deviceEui' };
  return { eq, trackers };
});

// ── Imports (after mocks are set up) ────────────────────────────────────────

import { normalizeChirpStackEvent } from '../../mqtt/parser.js';
import { validateAndEnqueue } from '../../validation/validator.js';
import { resetMetrics, getCounter } from '../../utils/metrics.js';

// ── Shared config fixture ────────────────────────────────────────────────────

const config: AppConfig = {
  mqtt: { brokerUrl: 'mqtt://localhost:1883' },
  redis: {
    url: 'redis://localhost:6379',
    streamKey: 'iot:events',
    streamMaxLen: 10_000,
  },
  databaseUrl: 'postgres://localhost/test',
  host: '0.0.0.0',
  port: 3001,
  rateLimitSeconds: 5,
  dedupTtlSeconds: 60,
};

// ── ChirpStack payload builder ───────────────────────────────────────────────

function buildUplinkPayload(overrides?: {
  devEui?: string;
  deduplicationId?: string;
  time?: string;
  latitude?: number;
  longitude?: number;
  batteryVoltage?: number;
  rssi?: number;
  snr?: number;
}): { topic: string; payload: Buffer } {
  const devEui = overrides?.devEui ?? KNOWN_DEVICE_EUI;
  const body = {
    deduplicationId: overrides?.deduplicationId ?? `dedup-${Date.now()}`,
    time: overrides?.time ?? new Date().toISOString(),
    deviceInfo: {
      devEui,
      deviceProfileName: 'RV-GPS-V1',
      applicationId: 'app-001',
    },
    rxInfo: [
      {
        gatewayId: 'gw-aabbccdd',
        rssi: overrides?.rssi ?? -85,
        snr: overrides?.snr ?? 7.5,
      },
    ],
    txInfo: { frequency: 915_000_000 },
    object: {
      latitude: overrides?.latitude ?? 36.16,
      longitude: overrides?.longitude ?? -86.78,
      altitude: 180,
      batteryVoltage: overrides?.batteryVoltage ?? 3.7,
      motion: false,
    },
    data: null,
  };

  const topic = `application/app-001/device/${devEui}/event/up`;
  const payload = Buffer.from(JSON.stringify(body), 'utf-8');
  return { topic, payload };
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('IoT ingest pipeline — integration', () => {
  let db: ReturnType<typeof makeDbMock>;

  beforeAll(() => {
    // Nothing async needed; mocks are module-level.
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // Reset shared state between tests so tests are independent.
    redisStore.clear();
    streamEntries.length = 0;
    mockRedis.set.mockClear();
    mockRedis.xadd.mockClear();
    resetMetrics();

    // Fresh DB mock that recognises KNOWN_DEVICE_EUI
    db = makeDbMock([KNOWN_DEVICE_EUI]);
  });

  // ── Test 1: Happy path ─────────────────────────────────────────────────────

  describe('valid uplink message', () => {
    it('normalizes and enqueues a well-formed ChirpStack uplink', async () => {
      const { topic, payload } = buildUplinkPayload();

      // Step 1: normalize
      const event = normalizeChirpStackEvent(topic, payload);
      expect(event).not.toBeNull();
      expect(event!.device_eui).toBe(KNOWN_DEVICE_EUI);
      expect(event!.latitude).toBeCloseTo(36.16);
      expect(event!.longitude).toBeCloseTo(-86.78);
      expect(event!.battery_mv).toBeGreaterThan(0);
      expect(event!.deduplication_id).toBeTruthy();

      // Step 2: validate and enqueue
      const result = await validateAndEnqueue(
        event!,
        mockRedis as never,
        db as never,
        config,
      );

      expect(result.accepted).toBe(true);
      expect(result.reason).toBeUndefined();

      // Redis XADD should have been called once
      expect(mockRedis.xadd).toHaveBeenCalledOnce();
      const xaddArgs = mockRedis.xadd.mock.calls[0]!;
      expect(xaddArgs[0]).toBe(config.redis.streamKey);

      // Metrics should reflect one accepted event
      expect(getCounter('events_received')).toBe(1);
      expect(getCounter('events_processed')).toBe(1);
      expect(getCounter('events_rejected')).toBe(0);
    });

    it('enqueued stream entry contains expected fields', async () => {
      const { topic, payload } = buildUplinkPayload({ latitude: 36.1627, longitude: -86.7818 });
      const event = normalizeChirpStackEvent(topic, payload)!;
      await validateAndEnqueue(event, mockRedis as never, db as never, config);

      const xaddArgs = mockRedis.xadd.mock.calls[0]!;
      // XADD args: streamKey, MAXLEN, ~, maxLen, *, ...fields
      const fieldsStart = xaddArgs.indexOf('*') + 1;
      const fields: Record<string, string> = {};
      for (let i = fieldsStart; i < xaddArgs.length - 1; i += 2) {
        fields[String(xaddArgs[i])] = String(xaddArgs[i + 1]);
      }

      expect(fields['device_eui']).toBe(KNOWN_DEVICE_EUI);
      expect(fields['latitude']).toBe('36.1627');
      expect(fields['longitude']).toBe('-86.7818');
      expect(fields['deduplication_id']).toBe(event.deduplication_id);
    });
  });

  // ── Test 2: Duplicate rejection ────────────────────────────────────────────

  describe('duplicate dedup ID', () => {
    it('rejects the second message with the same dedup ID', async () => {
      const dedupId = 'fixed-dedup-id-abc123';
      const { topic, payload } = buildUplinkPayload({ deduplicationId: dedupId });

      const event = normalizeChirpStackEvent(topic, payload)!;

      // First call should be accepted
      const first = await validateAndEnqueue(event, mockRedis as never, db as never, config);
      expect(first.accepted).toBe(true);

      // Second call — reset rate-limit key so only dedup triggers rejection
      const rateKey = `rate:${KNOWN_DEVICE_EUI}`;
      redisStore.delete(rateKey);

      const second = await validateAndEnqueue(event, mockRedis as never, db as never, config);
      expect(second.accepted).toBe(false);
      expect(second.reason).toBe('Duplicate event');

      // XADD called only once (for the first message)
      expect(mockRedis.xadd).toHaveBeenCalledOnce();

      // Metrics: 2 received, 1 rejected
      expect(getCounter('events_received')).toBe(2);
      expect(getCounter('events_rejected')).toBe(1);
    });
  });

  // ── Test 3: Malformed payload ──────────────────────────────────────────────

  describe('malformed / invalid payloads', () => {
    it('returns null from normalizeChirpStackEvent for non-JSON payload', () => {
      const topic = `application/app-001/device/${KNOWN_DEVICE_EUI}/event/up`;
      const payload = Buffer.from('not valid json !!!', 'utf-8');
      const event = normalizeChirpStackEvent(topic, payload);
      expect(event).toBeNull();
    });

    it('returns null for a status (non-uplink) topic', () => {
      const topic = `application/app-001/device/${KNOWN_DEVICE_EUI}/event/status`;
      const payload = Buffer.from('{}', 'utf-8');
      const event = normalizeChirpStackEvent(topic, payload);
      expect(event).toBeNull();
    });

    it('returns null when required fields are missing from payload', () => {
      const topic = `application/app-001/device/${KNOWN_DEVICE_EUI}/event/up`;
      // Missing deviceInfo.devEui, deduplicationId, and time
      const payload = Buffer.from(JSON.stringify({ rxInfo: [], txInfo: {} }), 'utf-8');
      const event = normalizeChirpStackEvent(topic, payload);
      expect(event).toBeNull();
    });

    it('validateAndEnqueue rejects an event from an unknown device without throwing', async () => {
      const event: TrackerEvent = {
        device_eui: 'unknown-device-000000',
        timestamp: new Date().toISOString(),
        latitude: 36.16,
        longitude: -86.78,
        altitude: 180,
        accuracy_meters: null,
        rssi: -85,
        snr: 7.5,
        battery_mv: 3700,
        battery_pct: 75,
        motion_detected: false,
        gateway_id: 'gw-aabbccdd',
        gateway_rssi: -85,
        raw_payload: null,
        deduplication_id: 'dedup-unknown-device',
      };

      // DB mock recognises only KNOWN_DEVICE_EUI, so this should be rejected
      let result: Awaited<ReturnType<typeof validateAndEnqueue>> | undefined;
      await expect(async () => {
        result = await validateAndEnqueue(event, mockRedis as never, db as never, config);
      }).not.toThrow();

      expect(result!.accepted).toBe(false);
      expect(result!.reason).toMatch(/unknown device/i);
      expect(mockRedis.xadd).not.toHaveBeenCalled();
    });

    it('validateAndEnqueue rejects an event with invalid coordinates without throwing', async () => {
      const { topic, payload } = buildUplinkPayload();
      const event = normalizeChirpStackEvent(topic, payload)!;

      // Manually corrupt coordinates after normalisation
      const badEvent: TrackerEvent = { ...event, latitude: 91, longitude: -86.78 };

      let result: Awaited<ReturnType<typeof validateAndEnqueue>> | undefined;
      await expect(async () => {
        result = await validateAndEnqueue(badEvent, mockRedis as never, db as never, config);
      }).not.toThrow();

      expect(result!.accepted).toBe(false);
      expect(result!.reason).toMatch(/invalid coordinates/i);
    });

    it('validateAndEnqueue rejects an event with a future timestamp without throwing', async () => {
      const { topic, payload } = buildUplinkPayload();
      const event = normalizeChirpStackEvent(topic, payload)!;

      const badEvent: TrackerEvent = {
        ...event,
        // 60 seconds in the future — exceeds MAX_CLOCK_SKEW_MS (30 s)
        timestamp: new Date(Date.now() + 60_000).toISOString(),
        deduplication_id: `dedup-future-${Date.now()}`,
      };

      let result: Awaited<ReturnType<typeof validateAndEnqueue>> | undefined;
      await expect(async () => {
        result = await validateAndEnqueue(badEvent, mockRedis as never, db as never, config);
      }).not.toThrow();

      expect(result!.accepted).toBe(false);
      expect(result!.reason).toMatch(/future|invalid/i);
    });
  });

  // ── Test 4: Rate limiting ──────────────────────────────────────────────────

  describe('rate limiting', () => {
    it('rejects a second event from the same device within the rate-limit window', async () => {
      // First message — should pass
      const first = buildUplinkPayload({ deduplicationId: 'dedup-rate-1' });
      const eventFirst = normalizeChirpStackEvent(first.topic, first.payload)!;
      const resultFirst = await validateAndEnqueue(
        eventFirst,
        mockRedis as never,
        db as never,
        config,
      );
      expect(resultFirst.accepted).toBe(true);

      // Second message with a different dedup ID — dedup passes, rate-limit fires
      const second = buildUplinkPayload({ deduplicationId: 'dedup-rate-2' });
      const eventSecond = normalizeChirpStackEvent(second.topic, second.payload)!;
      const resultSecond = await validateAndEnqueue(
        eventSecond,
        mockRedis as never,
        db as never,
        config,
      );
      expect(resultSecond.accepted).toBe(false);
      expect(resultSecond.reason).toBe('Rate limited');

      // Only one XADD should have occurred
      expect(mockRedis.xadd).toHaveBeenCalledOnce();

      // Metrics: 2 received, 1 rejected
      expect(getCounter('events_received')).toBe(2);
      expect(getCounter('events_rejected')).toBe(1);
    });

    it('accepts a new event after the rate-limit key expires', async () => {
      // First event passes and sets the rate key
      const { topic, payload } = buildUplinkPayload({ deduplicationId: 'dedup-expire-1' });
      const event = normalizeChirpStackEvent(topic, payload)!;
      await validateAndEnqueue(event, mockRedis as never, db as never, config);

      // Simulate expiry: remove the rate key from the store
      const rateKey = `rate:${KNOWN_DEVICE_EUI}`;
      redisStore.delete(rateKey);

      // New event with distinct dedup ID
      const { topic: t2, payload: p2 } = buildUplinkPayload({ deduplicationId: 'dedup-expire-2' });
      const event2 = normalizeChirpStackEvent(t2, p2)!;
      const result = await validateAndEnqueue(event2, mockRedis as never, db as never, config);

      expect(result.accepted).toBe(true);
      expect(mockRedis.xadd).toHaveBeenCalledTimes(2);
    });
  });
});
