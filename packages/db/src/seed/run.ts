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

// ── Real inventory data from KC dealership ──────────────────────────────
interface RealUnit {
  year: number; brand: string; model: string;
  type: string; length: string; stockNo: string;
  lot: string; extColor: string; intColor: string;
  notes: string; daysOnLot: number; listPrice: number;
  webPrice: number; status: string;
}

function parseType(t: string): string {
  const map: Record<string, string> = {
    A: 'motorhome', B: 'van', C: 'motorhome',
    FTH: 'toy_hauler', FW: 'fifth_wheel', TT: 'travel_trailer', TTH: 'toy_hauler',
  };
  return map[t] ?? 'travel_trailer';
}

function parseLength(len: string): string {
  const m = len.match(/(\d+)/);
  return m ? m[1]! : '28';
}


const REAL_INVENTORY: RealUnit[] = [
  { year: 2025, brand: 'Thor', model: 'Alante SE 27ASE', type: 'A', length: "25'6\"", stockNo: '2466276', lot: 'KC1', extColor: 'Ashbrook', intColor: '', notes: '', daysOnLot: 409, listPrice: 176480, webPrice: 94999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Freedom Traveler A24', type: 'A', length: "26'0\"", stockNo: '2466640', lot: 'KC1', extColor: 'Freedom Traveler', intColor: 'Ashland Gray', notes: '1 Slide', daysOnLot: 112, listPrice: 178090, webPrice: 112999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Freedom Traveler A24', type: 'A', length: "26'0\"", stockNo: '2466720', lot: 'KC1', extColor: 'Freedom Traveler', intColor: 'Ashland Gray', notes: '1 Slide HD-MAX', daysOnLot: 69, listPrice: 166330, webPrice: 112999, status: 'lot_ready' },
  { year: 2026, brand: 'Thor', model: 'Freedom Traveler A26', type: 'A', length: "27'0\"", stockNo: '2542404', lot: 'KC1', extColor: 'Freedom Traveler', intColor: 'Ashland Gray', notes: '1 Slide', daysOnLot: 105, listPrice: 175010, webPrice: 119999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Freedom Traveler A32', type: 'A', length: "33'0\"", stockNo: '2497835', lot: 'KC1', extColor: 'Freedom Traveler', intColor: 'Ashland Gray', notes: '1 Slide HD-MAX', daysOnLot: 193, listPrice: 202840, webPrice: 137995, status: 'available' },
  { year: 2025, brand: 'Thor', model: 'Georgetown 5 Series 31L', type: 'A', length: "34'11\"", stockNo: '2497321', lot: 'KC1', extColor: 'Titanium', intColor: 'Pearl', notes: '2 Slides', daysOnLot: 287, listPrice: 233672, webPrice: 147999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Precept 34G', type: 'A', length: "36'5\"", stockNo: '2577282', lot: 'KC1', extColor: '', intColor: '', notes: '2 Slides', daysOnLot: 137, listPrice: 260855, webPrice: 169999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Precept 36C', type: 'A', length: "38'10\"", stockNo: '2582854', lot: 'KC1', extColor: 'Farmhouse', intColor: '', notes: '3 Slides', daysOnLot: 67, listPrice: 249081, webPrice: 169995, status: 'lot_ready' },
  { year: 2025, brand: 'Thor', model: 'Eddie Bauer 19EB', type: 'B', length: "20'0\"", stockNo: '2394169', lot: 'KC1', extColor: 'Silver', intColor: 'Eddie Bauer', notes: 'No Slide', daysOnLot: 525, listPrice: 197440, webPrice: 123599, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Eddie Bauer 20EB', type: 'B', length: "21'0\"", stockNo: '2452286', lot: 'KC1', extColor: 'Silver', intColor: 'Eddie Bauer', notes: 'No Slide', daysOnLot: 249, listPrice: 174940, webPrice: 111999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Freedom Elite 17D Pop-Top', type: 'B', length: "18'0\"", stockNo: '2542272', lot: 'KC1', extColor: 'Silver', intColor: 'Cambridge', notes: 'No Slide', daysOnLot: 192, listPrice: 141933, webPrice: 84999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Solstice 21B', type: 'B', length: "22'0\"", stockNo: '2523416', lot: 'KC1', extColor: 'Silver', intColor: 'Crown Point', notes: 'No Slide', daysOnLot: 206, listPrice: 222125, webPrice: 149999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Solstice 21T', type: 'B', length: "22'0\"", stockNo: '2535787', lot: 'KC1', extColor: 'Silver', intColor: 'Meridian', notes: 'No Slide', daysOnLot: 58, listPrice: 212383, webPrice: 139999, status: 'lot_ready' },
  { year: 2026, brand: 'Thor', model: 'Swift 20E', type: 'B', length: "20'11\"", stockNo: '2577281', lot: 'KC1', extColor: '', intColor: '', notes: 'No Slide', daysOnLot: 140, listPrice: 187467, webPrice: 119999, status: 'available' },
  { year: 2025, brand: 'Thor', model: 'Swift 20T', type: 'B', length: "20'11\"", stockNo: '2519984', lot: 'KC1', extColor: '', intColor: '', notes: 'No Slide', daysOnLot: 254, listPrice: 184370, webPrice: 103499, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Terrain 19A', type: 'B', length: "19'6\"", stockNo: '2535788', lot: 'KC1', extColor: 'Silver', intColor: 'Timberland', notes: 'No Slide', daysOnLot: 67, listPrice: 246943, webPrice: 179999, status: 'lot_ready' },
  { year: 2026, brand: 'Thor', model: 'Terrain 19Y', type: 'B', length: "19'6\"", stockNo: '2525065', lot: 'KC1', extColor: 'Silver', intColor: 'Serenity', notes: 'No Slide', daysOnLot: 195, listPrice: 266450, webPrice: 179999, status: 'available' },
  { year: 2025, brand: 'Winnebago', model: 'Travato 59G', type: 'B', length: "21'0\"", stockNo: '2353408', lot: 'KC1', extColor: 'Sandstone Pearl', intColor: 'Bleu/Indigo', notes: 'No Slide', daysOnLot: 579, listPrice: 196591, webPrice: 128499, status: 'available' },
  { year: 2025, brand: 'Winnebago', model: 'Travato 59K', type: 'B', length: "21'0\"", stockNo: '2525066', lot: 'KC1', extColor: 'Sandstone Pearl', intColor: 'Canyon/Cardinal', notes: 'No Slide', daysOnLot: 267, listPrice: 192681, webPrice: 118499, status: 'available' },
  { year: 2025, brand: 'Thor', model: 'Chateau 31WV', type: 'C', length: "32'0\"", stockNo: '2242653', lot: 'KC1', extColor: 'Standard', intColor: 'Aspen Gray', notes: '1 Slide', daysOnLot: 451, listPrice: 172525, webPrice: 96749, status: 'available' },
  { year: 2026, brand: 'Dutchmen', model: 'Coleman 19EZF', type: 'C', length: "20'0\"", stockNo: '2468843', lot: 'KC1', extColor: 'Coleman Blue', intColor: 'Mist', notes: 'No Slide', daysOnLot: 175, listPrice: 133390, webPrice: 80999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'College Avenue 2001NS', type: 'C', length: "24'5\"", stockNo: '2582974', lot: 'KC1', extColor: 'Everly', intColor: '', notes: 'No Slide', daysOnLot: 77, listPrice: 120431, webPrice: 93999, status: 'lot_ready' },
  { year: 2026, brand: 'Thor', model: 'College Avenue 2201S', type: 'C', length: "23'10\"", stockNo: '2582978', lot: 'KC1', extColor: 'Everly', intColor: '', notes: '1 Slide', daysOnLot: 73, listPrice: 122306, webPrice: 95999, status: 'lot_ready' },
  { year: 2026, brand: 'Thor', model: 'College Avenue 2801S', type: 'C', length: "29'11\"", stockNo: '2582976', lot: 'KC1', extColor: 'Everly', intColor: '', notes: '1 Slide', daysOnLot: 70, listPrice: 153429, webPrice: 118999, status: 'lot_ready' },
  { year: 2026, brand: 'Thor', model: 'College Avenue 29510K', type: 'C', length: "32'3\"", stockNo: '2582977', lot: 'KC1', extColor: 'Everly', intColor: '', notes: '2 Slides', daysOnLot: 53, listPrice: 163094, webPrice: 125999, status: 'lot_ready' },
  { year: 2026, brand: 'Thor', model: 'College Avenue 3101FB', type: 'C', length: "31'10\"", stockNo: '2582972', lot: 'KC1', extColor: 'Everly', intColor: '', notes: '1 Slide', daysOnLot: 70, listPrice: 161304, webPrice: 124999, status: 'lot_ready' },
  { year: 2026, brand: 'Dynamax', model: 'DX3 32KD', type: 'C', length: "33'10\"", stockNo: '2520271', lot: 'KC1', extColor: 'Milano', intColor: '', notes: '2 Slides', daysOnLot: 87, listPrice: 435098, webPrice: 326399, status: 'available' },
  { year: 2026, brand: 'Dynamax', model: 'DX3 34KD', type: 'C', length: "36'6\"", stockNo: '2520268', lot: 'KC1', extColor: 'Driftwood', intColor: '', notes: '2 Slides', daysOnLot: 141, listPrice: 461691, webPrice: 346268, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Eddie Bauer 19EDF', type: 'C', length: "20'5\"", stockNo: '2521595', lot: 'KC1', extColor: 'Eddie Bauer', intColor: 'Eddie Bauer', notes: 'No Slide', daysOnLot: 147, listPrice: 134590, webPrice: 83999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Eddie Bauer 21EBF', type: 'C', length: "24'0\"", stockNo: '2383291', lot: 'KC1', extColor: 'Eddie Bauer', intColor: 'Eddie Bauer', notes: 'No Slides', daysOnLot: 109, listPrice: 139690, webPrice: 86999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Eddie Bauer 21EBF', type: 'C', length: "24'0\"", stockNo: '2383292', lot: 'KC1', extColor: 'Eddie Bauer', intColor: 'Eddie Bauer', notes: 'No Slide', daysOnLot: 105, listPrice: 130490, webPrice: 86999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Eddie Bauer 22EDF', type: 'C', length: "24'0\"", stockNo: '2469244', lot: 'KC1', extColor: 'Eddie Bauer', intColor: 'Eddie Bauer', notes: '', daysOnLot: 125, listPrice: 144190, webPrice: 91999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Eddie Bauer 22ET', type: 'C', length: "24'0\"", stockNo: '2597814', lot: 'KC1', extColor: 'Eddie Bauer', intColor: 'Warm Flannel', notes: 'No Slide', daysOnLot: 20, listPrice: 179910, webPrice: 125999, status: 'new_arrival' },
  { year: 2026, brand: 'Dynamax', model: 'Europa 31SS', type: 'C', length: "33'5\"", stockNo: '2584151', lot: 'KC1', extColor: 'Mindful Gray', intColor: '', notes: '2 Slides', daysOnLot: 107, listPrice: 369121, webPrice: 276999, status: 'available' },
  { year: 2026, brand: 'Forest River', model: 'Forester 2501TSF', type: 'C', length: "27'0\"", stockNo: '2591317', lot: 'KC1', extColor: 'Riverteak', intColor: '', notes: '2 Slides', daysOnLot: 77, listPrice: 159423, webPrice: 124799, status: 'lot_ready' },
  { year: 2026, brand: 'Forest River', model: 'Forester 2861DSF', type: 'C', length: "30'9\"", stockNo: '2525246', lot: 'KC1', extColor: 'Riverteak', intColor: '', notes: '2 Slides', daysOnLot: 234, listPrice: 163716, webPrice: 129514, status: 'available' },
  { year: 2025, brand: 'Forest River', model: 'Forester LE 2551DSF', type: 'C', length: "29'4\"", stockNo: '2362544', lot: 'KC1', extColor: 'Riverteak', intColor: '', notes: '1 Slide', daysOnLot: 470, listPrice: 146569, webPrice: 94249, status: 'available' },
  { year: 2026, brand: 'Forest River', model: 'Forester LE 3251DSF', type: 'C', length: "32'3\"", stockNo: '2525247', lot: 'KC1', extColor: 'Riverteak', intColor: '', notes: '1 Slide', daysOnLot: 242, listPrice: 145639, webPrice: 104999, status: 'available' },
  { year: 2025, brand: 'Forest River', model: 'Forester MBS 2401B', type: 'C', length: "24'5\"", stockNo: '2423720', lot: 'KC1', extColor: 'Riverteak', intColor: '', notes: '1 Slide', daysOnLot: 457, listPrice: 187906, webPrice: 104999, status: 'available' },
  { year: 2025, brand: 'Forest River', model: 'Forester TS 2381AF', type: 'C', length: "25'11\"", stockNo: '2459460', lot: 'KC1', extColor: 'Admiral Riverteak', intColor: '', notes: 'No Slide', daysOnLot: 485, listPrice: 157963, webPrice: 98249, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Freedom Elite 22HZF', type: 'C', length: "24'0\"", stockNo: '2469176', lot: 'KC1', extColor: 'Freedom Traveler', intColor: 'Estate Gray', notes: '1 Slide HD-MAX', daysOnLot: 200, listPrice: 141640, webPrice: 87999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Freedom Elite 28HZF', type: 'C', length: "30'0\"", stockNo: '2497931', lot: 'KC1', extColor: 'Freedom Traveler', intColor: 'Estate Gray', notes: 'No Slide HD-MAX', daysOnLot: 191, listPrice: 148540, webPrice: 93999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Gemini 24KB', type: 'C', length: "26'0\"", stockNo: '2481353', lot: 'KC1', extColor: 'Gemini', intColor: 'Snow Leopard', notes: '1 Slide', daysOnLot: 142, listPrice: 186483, webPrice: 127999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Greyhawk 27U', type: 'C', length: "29'10\"", stockNo: '2591544', lot: 'KC1', extColor: 'Farmhouse', intColor: '', notes: '2 Slides', daysOnLot: 35, listPrice: 212118, webPrice: 144999, status: 'new_arrival' },
  { year: 2026, brand: 'Jayco', model: 'Greyhawk 29MV', type: 'C', length: "32'7\"", stockNo: '2570685', lot: 'KC1', extColor: '', intColor: '', notes: '2 Slides', daysOnLot: 140, listPrice: 197135, webPrice: 129999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Greyhawk 29MV', type: 'C', length: "32'7\"", stockNo: '2582789', lot: 'KC1', extColor: 'Farmhouse', intColor: '', notes: '1 Slide', daysOnLot: 81, listPrice: 212393, webPrice: 129999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Greyhawk 30Z', type: 'C', length: "32'7\"", stockNo: '2582832', lot: 'KC1', extColor: 'Spring Oakridge', intColor: '', notes: '1 Slide', daysOnLot: 50, listPrice: 214000, webPrice: 139999, status: 'lot_ready' },
  { year: 2026, brand: 'Jayco', model: 'Greyhawk 30Z', type: 'C', length: "32'7\"", stockNo: '2582834', lot: 'KC1', extColor: 'Oakridge', intColor: '', notes: '2 Slides', daysOnLot: 63, listPrice: 213600, webPrice: 129999, status: 'lot_ready' },
  { year: 2025, brand: 'Jayco', model: 'Greyhawk 31F', type: 'C', length: "32'0\"", stockNo: '2496061', lot: 'KC1', extColor: 'Farmhouse', intColor: '', notes: '', daysOnLot: 252, listPrice: 211340, webPrice: 124999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Greyhawk XL 32U Desert Edition', type: 'C', length: "34'2\"", stockNo: '2602996', lot: 'KC1', extColor: 'Stillwater', intColor: '', notes: '2 Slides', daysOnLot: 18, listPrice: 336611, webPrice: 224999, status: 'new_arrival' },
  { year: 2026, brand: 'Jayco', model: 'Melbourne 24R', type: 'C', length: "25'0\"", stockNo: '2570684', lot: 'KC1', extColor: 'Ashbrook', intColor: '', notes: '1 Slide', daysOnLot: 120, listPrice: 181130, webPrice: 119999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Redhawk 24B', type: 'C', length: "26'8\"", stockNo: '2582803', lot: 'KC1', extColor: 'Ashbrook', intColor: '', notes: '1 Slide', daysOnLot: 72, listPrice: 178731, webPrice: 114995, status: 'lot_ready' },
  { year: 2026, brand: 'Jayco', model: 'Redhawk 29XK', type: 'C', length: "32'7\"", stockNo: '2498017', lot: 'KC1', extColor: '', intColor: '', notes: '1 Slide', daysOnLot: 192, listPrice: 182413, webPrice: 119999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Redhawk 31F', type: 'C', length: "32'6\"", stockNo: '2523418', lot: 'KC1', extColor: 'Ashbrook', intColor: '', notes: '1 Slide', daysOnLot: 212, listPrice: 181490, webPrice: 119999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Redhawk SE 22AF', type: 'C', length: "24'9\"", stockNo: '2496062', lot: 'KC1', extColor: 'Ashbrook', intColor: '', notes: '1 Slide', daysOnLot: 206, listPrice: 132155, webPrice: 79999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Seneca 37K', type: 'C', length: "39'4\"", stockNo: '2582768', lot: 'KC1', extColor: 'Brookside', intColor: '', notes: '2 Slides', daysOnLot: 88, listPrice: 365161, webPrice: 274999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Seneca Prestige 37M', type: 'C', length: "39'0\"", stockNo: '2498020', lot: 'KC1', extColor: 'Dark Knight', intColor: 'Field Stone', notes: '3 Slides', daysOnLot: 253, listPrice: 431413, webPrice: 309999, status: 'available' },
  // Fifth Wheel Toy Haulers
  { year: 2026, brand: 'Heartland', model: 'Nightfall 270NF', type: 'FTH', length: "32'3\"", stockNo: '2609030', lot: 'KC1', extColor: 'Dusk', intColor: '', notes: 'No Slide', daysOnLot: 24, listPrice: 75408, webPrice: 56999, status: 'new_arrival' },
  { year: 2026, brand: 'Jayco', model: 'Seismic 395', type: 'FTH', length: "47'3\"", stockNo: '2607016', lot: 'KC1', extColor: '', intColor: '', notes: '3 Slides', daysOnLot: 70, listPrice: 145649, webPrice: 109995, status: 'lot_ready' },
  { year: 2025, brand: 'Jayco', model: 'Seismic 399', type: 'FTH', length: "45'9\"", stockNo: '2443645', lot: 'KC1', extColor: '', intColor: '', notes: '3 Slides', daysOnLot: 466, listPrice: 135412, webPrice: 81749, status: 'available' },
  { year: 2025, brand: 'Jayco', model: 'Seismic 399', type: 'FTH', length: "45'9\"", stockNo: '2443737', lot: 'KC1', extColor: '', intColor: '', notes: '3 Slides', daysOnLot: 408, listPrice: 134969, webPrice: 82249, status: 'available' },
  { year: 2026, brand: 'Cherokee', model: 'Wolf Pack 350PACK15', type: 'FTH', length: "45'0\"", stockNo: '2553947', lot: 'KC1', extColor: 'Coffee Bean', intColor: '', notes: '1 Slide', daysOnLot: 120, listPrice: 105163, webPrice: 64499, status: 'available' },
  { year: 2026, brand: 'Cherokee', model: 'Wolf Pack 350PACK15', type: 'FTH', length: "45'0\"", stockNo: '2553948', lot: 'KC1', extColor: 'Coffee Bean', intColor: '', notes: '1 Slide', daysOnLot: 126, listPrice: 106149, webPrice: 65499, status: 'available' },
  { year: 2025, brand: 'Cherokee', model: 'Wolf Pack 365PACK15.5', type: 'FTH', length: "44'0\"", stockNo: '2508589', lot: 'KC1', extColor: 'Coffee Bean', intColor: '', notes: '1 Slide', daysOnLot: 261, listPrice: 108266, webPrice: 62999, status: 'available' },
  { year: 2026, brand: 'Cherokee', model: 'Wolf Pack 411STAY', type: 'FTH', length: "45'0\"", stockNo: '2592297', lot: 'KC1', extColor: 'Cappuccino', intColor: '', notes: '3 Slides', daysOnLot: 57, listPrice: 127147, webPrice: 84499, status: 'lot_ready' },
  // Fifth Wheels
  { year: 2026, brand: 'Keystone', model: 'Arcadia Select 21SRK', type: 'FW', length: "26'4\"", stockNo: '2616697', lot: 'KC1', extColor: 'Select', intColor: '', notes: '1 Slide', daysOnLot: 22, listPrice: 58117, webPrice: 39999, status: 'new_arrival' },
  { year: 2025, brand: 'Keystone', model: 'Arcadia Select 27SBH', type: 'FW', length: "32'3\"", stockNo: '2493345', lot: 'KC1', extColor: 'Select', intColor: '', notes: '1 Slide', daysOnLot: 287, listPrice: 52009, webPrice: 36499, status: 'available' },
  { year: 2026, brand: 'Keystone', model: 'Arcadia Super Lite 260SLCL', type: 'FW', length: "30'10\"", stockNo: '2616694', lot: 'KC1', extColor: 'Dovetail', intColor: '', notes: '2 Slides', daysOnLot: 45, listPrice: 85372, webPrice: 56999, status: 'lot_ready' },
  { year: 2026, brand: 'Keystone', model: 'Arcadia Super Lite 308SLBH', type: 'FW', length: "34'8\"", stockNo: '2616695', lot: 'KC1', extColor: 'Lodge', intColor: '', notes: '2 Slides', daysOnLot: 25, listPrice: 83744, webPrice: 55499, status: 'new_arrival' },
  { year: 2025, brand: 'Cherokee', model: 'Arctic Wolf 27SGS', type: 'FW', length: "29'11\"", stockNo: '2482799', lot: 'KC1', extColor: 'Teagan/Onyx', intColor: '', notes: '2 Slides', daysOnLot: 430, listPrice: 85402, webPrice: 41499, status: 'available' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Elite 32BAM', type: 'FW', length: "36'4\"", stockNo: '2593146', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: '3 Slides', daysOnLot: 24, listPrice: 100742, webPrice: 59999, status: 'new_arrival' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Elite 36AK', type: 'FW', length: "43'3\"", stockNo: '2618588', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: '3 Slides', daysOnLot: 24, listPrice: 113336, webPrice: 69999, status: 'new_arrival' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Elite 36RF', type: 'FW', length: "42'9\"", stockNo: '2561220', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: '4 Slides', daysOnLot: 99, listPrice: 77542, webPrice: 67999, status: 'available' },
  { year: 2026, brand: 'Dutchmen', model: 'Coleman Legacy 2400REX', type: 'FW', length: "29'0\"", stockNo: '2604313', lot: 'KC1', extColor: 'Stone', intColor: '', notes: '1 Slide', daysOnLot: 29, listPrice: 67990, webPrice: 42999, status: 'new_arrival' },
  { year: 2026, brand: 'KZ', model: 'Durango 302RLT', type: 'FW', length: "35'2\"", stockNo: '2615554', lot: 'KC1', extColor: 'Pebble', intColor: '', notes: '3 Slides', daysOnLot: 73, listPrice: 122428, webPrice: 83999, status: 'lot_ready' },
  { year: 2025, brand: 'KZ', model: 'Durango Gold 310RLQ', type: 'FW', length: "34'11\"", stockNo: '2486828', lot: 'KC1', extColor: 'Birch', intColor: '', notes: '4 Slides', daysOnLot: 401, listPrice: 143156, webPrice: 81249, status: 'available' },
  { year: 2025, brand: 'KZ', model: 'Durango Gold 388FLS', type: 'FW', length: "42'11\"", stockNo: '2400617', lot: 'KC1', extColor: 'Mink', intColor: '', notes: '5 Slides', daysOnLot: 430, listPrice: 167671, webPrice: 97749, status: 'available' },
  { year: 2025, brand: 'KZ', model: 'Durango Gold 391RKF', type: 'FW', length: "42'5\"", stockNo: '2493347', lot: 'KC1', extColor: 'Mink', intColor: '', notes: '5 Slides', daysOnLot: 262, listPrice: 154910, webPrice: 92499, status: 'available' },
  { year: 2026, brand: 'KZ', model: 'Durango HT 232MLD', type: 'FW', length: "29'6\"", stockNo: '2615558', lot: 'KC1', extColor: 'Pebble', intColor: '', notes: '2 Slides', daysOnLot: 73, listPrice: 88150, webPrice: 58499, status: 'lot_ready' },
  { year: 2025, brand: 'KZ', model: 'Durango HT 240RKD', type: 'FW', length: "31'8\"", stockNo: '2493348', lot: 'KC1', extColor: 'Mink', intColor: '', notes: '2 Slides', daysOnLot: 347, listPrice: 88617, webPrice: 52999, status: 'available' },
  { year: 2025, brand: 'Jayco', model: 'Eagle 317RLOK', type: 'FW', length: "36'8\"", stockNo: '2499249', lot: 'KC1', extColor: '', intColor: '', notes: '2 Slides', daysOnLot: 276, listPrice: 106430, webPrice: 61999, status: 'available' },
  { year: 2025, brand: 'Jayco', model: 'Eagle 321RSTS', type: 'FW', length: "36'8\"", stockNo: '2499229', lot: 'KC1', extColor: '', intColor: '', notes: '3 Slides', daysOnLot: 281, listPrice: 103743, webPrice: 64999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Eagle 335LSTS', type: 'FW', length: "38'5\"", stockNo: '2615559', lot: 'KC1', extColor: '', intColor: '', notes: '3 Slides', daysOnLot: 28, listPrice: 110137, webPrice: 73499, status: 'new_arrival' },
  { year: 2026, brand: 'Jayco', model: 'Eagle 355MBQS', type: 'FW', length: "42'1\"", stockNo: '2590483', lot: 'KC1', extColor: '', intColor: '', notes: '4 Slides', daysOnLot: 105, listPrice: 115092, webPrice: 79999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Eagle 355MBQS', type: 'FW', length: "42'1\"", stockNo: '2615562', lot: 'KC1', extColor: '', intColor: '', notes: '4 Slides', daysOnLot: 44, listPrice: 117393, webPrice: 79499, status: 'lot_ready' },
  { year: 2025, brand: 'Jayco', model: 'Eagle 360DBOK', type: 'FW', length: "43'4\"", stockNo: '2475530', lot: 'KC1', extColor: '', intColor: '', notes: '3 Slides', daysOnLot: 413, listPrice: 113945, webPrice: 66999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Eagle HT 26REC', type: 'FW', length: "29'3\"", stockNo: '2615565', lot: 'KC1', extColor: '', intColor: '', notes: '1 Slide', daysOnLot: 22, listPrice: 75569, webPrice: 48499, status: 'new_arrival' },
  { year: 2025, brand: 'Jayco', model: 'Eagle HT 27MLC', type: 'FW', length: "32'9\"", stockNo: '2475522', lot: 'KC1', extColor: '', intColor: '', notes: '1 Slide', daysOnLot: 400, listPrice: 78582, webPrice: 46499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Eagle HT 28CRT', type: 'FW', length: "32'10\"", stockNo: '2607020', lot: 'KC1', extColor: '', intColor: '', notes: '3 Slides', daysOnLot: 73, listPrice: 90975, webPrice: 63999, status: 'lot_ready' },
  { year: 2026, brand: 'Jayco', model: 'Eagle HT 29DDB', type: 'FW', length: "34'6\"", stockNo: '2568639', lot: 'KC1', extColor: 'Cali Linen', intColor: '', notes: '1 Slide', daysOnLot: 134, listPrice: 84287, webPrice: 54999, status: 'available' },
  { year: 2025, brand: 'Jayco', model: 'Eagle HT 31QCD', type: 'FW', length: "36'6\"", stockNo: '2499315', lot: 'KC1', extColor: '', intColor: '', notes: '2 Slides', daysOnLot: 291, listPrice: 84877, webPrice: 53499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Eagle SLE 24MLE', type: 'FW', length: "29'3\"", stockNo: '2615570', lot: 'KC1', extColor: '', intColor: '', notes: '2 Slides', daysOnLot: 28, listPrice: 61963, webPrice: 40999, status: 'new_arrival' },
  { year: 2026, brand: 'Jayco', model: 'Eagle SLE 28BHU', type: 'FW', length: "34'6\"", stockNo: '2499344', lot: 'KC1', extColor: '', intColor: '', notes: '1 Slide', daysOnLot: 231, listPrice: 63877, webPrice: 42499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Eagle SLE 28BHU', type: 'FW', length: "34'6\"", stockNo: '2595460', lot: 'KC1', extColor: '', intColor: '', notes: '1 Slide', daysOnLot: 59, listPrice: 66966, webPrice: 45999, status: 'lot_ready' },
  { year: 2026, brand: 'Jayco', model: 'Eagle SLE 30RLT', type: 'FW', length: "34'0\"", stockNo: '2608877', lot: 'KC1', extColor: '', intColor: '', notes: '3 Slides', daysOnLot: 36, listPrice: 73274, webPrice: 49999, status: 'new_arrival' },
  { year: 2025, brand: 'Thor', model: 'Eddie Bauer Signature 2500RK', type: 'FW', length: "28'9\"", stockNo: '2377386', lot: 'KC1', extColor: 'Meadow', intColor: 'Nature', notes: '2 Slides', daysOnLot: 564, listPrice: 64569, webPrice: 39499, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Eddie Bauer Summit 3210RL', type: 'FW', length: "37'4\"", stockNo: '2609674', lot: 'KC1', extColor: 'Pacific', intColor: '', notes: '3 Slides', daysOnLot: 22, listPrice: 123196, webPrice: 71999, status: 'new_arrival' },
  { year: 2025, brand: 'Jayco', model: 'North Point 382FLRB', type: 'FW', length: "43'10\"", stockNo: '2499418', lot: 'KC1', extColor: '', intColor: '', notes: '4 Slides', daysOnLot: 274, listPrice: 154845, webPrice: 95249, status: 'available' },
  { year: 2025, brand: 'Jayco', model: 'North Point 390CKDS', type: 'FW', length: "43'10\"", stockNo: '2400586', lot: 'KC1', extColor: 'Modern Farm', intColor: '', notes: '2 Slides', daysOnLot: 562, listPrice: 156058, webPrice: 90249, status: 'available' },
  { year: 2025, brand: 'Jayco', model: 'North Point 390CKDS', type: 'FW', length: "43'10\"", stockNo: '2444068', lot: 'KC1', extColor: '', intColor: '', notes: '4 Slides', daysOnLot: 413, listPrice: 156036, webPrice: 94249, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'North Point 395DSDB', type: 'FW', length: "44'9\"", stockNo: '2615584', lot: 'KC1', extColor: '', intColor: '', notes: '4 Slides', daysOnLot: 23, listPrice: 160710, webPrice: 109999, status: 'new_arrival' },
  { year: 2026, brand: 'Jayco', model: 'Pinnacle 32RLTS', type: 'FW', length: "36'0\"", stockNo: '2615588', lot: 'KC1', extColor: 'Midnight Gold', intColor: '', notes: '3 Slides Full Body Paint', daysOnLot: 22, listPrice: 168992, webPrice: 114999, status: 'new_arrival' },
  { year: 2026, brand: 'Jayco', model: 'Pinnacle 38PBRK', type: 'FW', length: "43'10\"", stockNo: '2580016', lot: 'KC1', extColor: '', intColor: '', notes: '3 Slides', daysOnLot: 113, listPrice: 162377, webPrice: 118499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Pinnacle 38SSWS', type: 'FW', length: "43'2\"", stockNo: '2580037', lot: 'KC1', extColor: '', intColor: '', notes: '3 Slides', daysOnLot: 112, listPrice: 166145, webPrice: 121495, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Pinnacle 39FLOK', type: 'FW', length: "44'6\"", stockNo: '2615586', lot: 'KC1', extColor: 'Silver Metallic', intColor: '', notes: '5 Slides Full Body Paint', daysOnLot: 21, listPrice: 183565, webPrice: 134999, status: 'new_arrival' },
  { year: 2025, brand: 'Heartland', model: 'Ridgeway 35BH', type: 'FW', length: "39'4\"", stockNo: '2486820', lot: 'KC1', extColor: 'Copper Linen', intColor: '', notes: '3 Slides', daysOnLot: 385, listPrice: 100333, webPrice: 59999, status: 'available' },
  { year: 2025, brand: 'Forest River', model: 'Sabre 33RLP', type: 'FW', length: "39'11\"", stockNo: '2493389', lot: 'KC1', extColor: 'Coffee Cream', intColor: '', notes: '', daysOnLot: 289, listPrice: 111794, webPrice: 61499, status: 'available' },
  { year: 2026, brand: 'Forest River', model: 'Sabre 36FLX', type: 'FW', length: "41'1\"", stockNo: '2595019', lot: 'KC1', extColor: 'Coffee Cream', intColor: '', notes: '4 Slides', daysOnLot: 66, listPrice: 105795, webPrice: 65499, status: 'lot_ready' },
  { year: 2026, brand: 'Forest River', model: 'Sabre 37PLH', type: 'FW', length: "42'4\"", stockNo: '2508572', lot: 'KC1', extColor: 'Coffee Cream', intColor: '', notes: '5 Slides', daysOnLot: 196, listPrice: 116796, webPrice: 73499, status: 'available' },
  { year: 2026, brand: 'Forest River', model: 'Wildwood Heritage Glen 369BL', type: 'FW', length: "43'0\"", stockNo: '2572951', lot: 'KC1', extColor: 'Dune', intColor: '', notes: '4 Slides', daysOnLot: 143, listPrice: 109223, webPrice: 70999, status: 'available' },
  { year: 2026, brand: 'Forest River', model: 'Wildwood Heritage Glen 376FAM', type: 'FW', length: "42'7\"", stockNo: '2608759', lot: 'KC1', extColor: 'Dune', intColor: '', notes: '4 Slides', daysOnLot: 64, listPrice: 113206, webPrice: 75499, status: 'lot_ready' },
  { year: 2026, brand: 'Forest River', model: 'Wildwood Heritage Glen 378FL', type: 'FW', length: "42'10\"", stockNo: '2572955', lot: 'KC1', extColor: 'Dune', intColor: '', notes: '2 Slides', daysOnLot: 123, listPrice: 112927, webPrice: 73999, status: 'available' },
  // Travel Trailers (selecting representative subset - full list would be 100+)
  { year: 2025, brand: 'Jayco', model: 'Alta 2800KBH', type: 'TT', length: "33'8\"", stockNo: '2508586', lot: 'KC1', extColor: 'Ansonia Stone', intColor: '', notes: '1 Slide', daysOnLot: 297, listPrice: 68319, webPrice: 38499, status: 'available' },
  { year: 2025, brand: 'Jayco', model: 'Alta 2810KIK', type: 'TT', length: "33'8\"", stockNo: '2511995', lot: 'KC1', extColor: 'Ansonia Stone', intColor: '', notes: '2 Slides', daysOnLot: 246, listPrice: 70850, webPrice: 39999, status: 'available' },
  { year: 2026, brand: 'Keystone', model: 'Bullet Classic 18RBC', type: 'TT', length: "22'8\"", stockNo: '2589704', lot: 'KC1', extColor: 'Tranquil Taupe', intColor: '', notes: '1 Slide', daysOnLot: 133, listPrice: 37221, webPrice: 33999, status: 'available' },
  { year: 2026, brand: 'Keystone', model: 'Bullet Classic 18RBC', type: 'TT', length: "22'8\"", stockNo: '2589706', lot: 'KC1', extColor: 'Tranquil Taupe', intColor: '', notes: '1 Slide', daysOnLot: 133, listPrice: 37221, webPrice: 33999, status: 'available' },
  { year: 2026, brand: 'Keystone', model: 'Bullet Classic 21BHC', type: 'TT', length: "25'0\"", stockNo: '2555891', lot: 'KC1', extColor: 'Tranquil Taupe', intColor: '', notes: 'No Slide', daysOnLot: 49, listPrice: 36710, webPrice: 33999, status: 'lot_ready' },
  { year: 2026, brand: 'Keystone', model: 'Bullet Classic 21RKC', type: 'TT', length: "25'5\"", stockNo: '2589802', lot: 'KC1', extColor: 'Tranquil Taupe', intColor: '', notes: '1 Slide', daysOnLot: 133, listPrice: 40885, webPrice: 31999, status: 'available' },
  { year: 2026, brand: 'Keystone', model: 'Bullet Classic 26BHC', type: 'TT', length: "30'4\"", stockNo: '2610678', lot: 'KC1', extColor: 'Tranquil Taupe', intColor: '', notes: '1 Slide', daysOnLot: 31, listPrice: 44931, webPrice: 36999, status: 'new_arrival' },
  { year: 2026, brand: 'Keystone', model: 'Bullet Crossfire 2290BH', type: 'TT', length: "26'10\"", stockNo: '2568404', lot: 'KC1', extColor: 'Tranquil Taupe', intColor: '', notes: '1 Slide', daysOnLot: 119, listPrice: 49900, webPrice: 35999, status: 'available' },
  { year: 2026, brand: 'Keystone', model: 'Bullet Crossfire 2530RD', type: 'TT', length: "29'10\"", stockNo: '2568405', lot: 'KC1', extColor: 'White Tranquil', intColor: '', notes: '1 Slide', daysOnLot: 193, listPrice: 52200, webPrice: 37499, status: 'available' },
  { year: 2026, brand: 'Keystone', model: 'Bullet Premium 310RES', type: 'TT', length: "35'11\"", stockNo: '2568403', lot: 'KC1', extColor: 'Tranquil Taupe', intColor: '', notes: '', daysOnLot: 107, listPrice: 71865, webPrice: 54999, status: 'available' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Reserve 17LS', type: 'TT', length: "23'10\"", stockNo: '2588224', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: '1 Slide', daysOnLot: 77, listPrice: 42122, webPrice: 26999, status: 'lot_ready' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Reserve 20LJ', type: 'TT', length: "25'9\"", stockNo: '2569490', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: 'No Slide', daysOnLot: 141, listPrice: 27705, webPrice: 26999, status: 'available' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Reserve 25MW', type: 'TT', length: "29'8\"", stockNo: '2569441', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: '', daysOnLot: 135, listPrice: 35007, webPrice: 25999, status: 'available' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Reserve 26CJ', type: 'TT', length: "32'9\"", stockNo: '2569296', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: '1 Slide', daysOnLot: 126, listPrice: 51220, webPrice: 31999, status: 'available' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Reserve 26RM', type: 'TT', length: "33'1\"", stockNo: '2538307', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: '1 Slide', daysOnLot: 204, listPrice: 39846, webPrice: 34499, status: 'available' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Reserve 27MR', type: 'TT', length: "34'8\"", stockNo: '2546822', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: '2 Slides', daysOnLot: 171, listPrice: 40834, webPrice: 35499, status: 'available' },
  { year: 2025, brand: 'Starcraft', model: 'Campsite Reserve 39GB', type: 'TT', length: "40'7\"", stockNo: '2459008', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: '1 Slide', daysOnLot: 399, listPrice: 64356, webPrice: 37999, status: 'available' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Ultra 19KB', type: 'TT', length: "22'4\"", stockNo: '2610130', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: 'No Slide', daysOnLot: 51, listPrice: 49775, webPrice: 31999, status: 'lot_ready' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Ultra 21DF', type: 'TT', length: "25'10\"", stockNo: '2538414', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: '', daysOnLot: 197, listPrice: 37640, webPrice: 33999, status: 'available' },
  { year: 2026, brand: 'Starcraft', model: 'Campsite Ultra 26BW', type: 'TT', length: "30'3\"", stockNo: '2538338', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: '2 Slides', daysOnLot: 207, listPrice: 45018, webPrice: 38499, status: 'available' },
  { year: 2026, brand: 'Dutchmen', model: 'Coleman 13B', type: 'TT', length: "15'11\"", stockNo: '2506323', lot: 'KC1', extColor: 'Stone', intColor: '', notes: 'No Slide', daysOnLot: 149, listPrice: 16956, webPrice: 10399, status: 'available' },
  { year: 2026, brand: 'Dutchmen', model: 'Coleman 13B', type: 'TT', length: "15'11\"", stockNo: '2506324', lot: 'KC1', extColor: 'Stone', intColor: '', notes: 'No Slide', daysOnLot: 150, listPrice: 16956, webPrice: 10399, status: 'available' },
  { year: 2026, brand: 'Dutchmen', model: 'Coleman 13B', type: 'TT', length: "15'11\"", stockNo: '2506326', lot: 'KC1', extColor: 'Stone', intColor: '', notes: 'No Slide', daysOnLot: 149, listPrice: 16956, webPrice: 10399, status: 'available' },
  { year: 2025, brand: 'Dutchmen', model: 'Coleman 17R', type: 'TT', length: "21'5\"", stockNo: '2320069', lot: 'KC1', extColor: 'Stone', intColor: '', notes: 'No Slide', daysOnLot: 534, listPrice: 15993, webPrice: 12499, status: 'available' },
  { year: 2026, brand: 'Dutchmen', model: 'Coleman 23B', type: 'TT', length: "27'6\"", stockNo: '2577941', lot: 'KC1', extColor: 'Stone', intColor: '', notes: 'No Slide', daysOnLot: 52, listPrice: 29774, webPrice: 24999, status: 'lot_ready' },
  { year: 2026, brand: 'Dutchmen', model: 'Coleman 25R', type: 'TT', length: "29'11\"", stockNo: '2478581', lot: 'KC1', extColor: 'Stone', intColor: '', notes: '1 Slide', daysOnLot: 212, listPrice: 38090, webPrice: 27499, status: 'available' },
  { year: 2025, brand: 'Dutchmen', model: 'Coleman Lantern 25REX', type: 'TT', length: "29'11\"", stockNo: '2425334', lot: 'KC1', extColor: 'Stone', intColor: '', notes: '1 Slide', daysOnLot: 512, listPrice: 38536, webPrice: 27999, status: 'available' },
  { year: 2026, brand: 'Dutchmen', model: 'Coleman Lantern 32BHS', type: 'TT', length: "36'11\"", stockNo: '2456762', lot: 'KC1', extColor: 'Stone', intColor: '', notes: '1 Slide', daysOnLot: 172, listPrice: 54464, webPrice: 33999, status: 'available' },
  { year: 2025, brand: 'Dutchmen', model: 'Coleman Legacy 2900BH', type: 'TT', length: "33'11\"", stockNo: '2507440', lot: 'KC1', extColor: 'Stone', intColor: '', notes: '1 Slide', daysOnLot: 254, listPrice: 46498, webPrice: 31999, status: 'available' },
  { year: 2026, brand: 'Dutchmen', model: 'Coleman Light 21RX', type: 'TT', length: "25'5\"", stockNo: '2566811', lot: 'KC1', extColor: 'Stone', intColor: '', notes: '1 Slide', daysOnLot: 116, listPrice: 37978, webPrice: 27999, status: 'available' },
  { year: 2025, brand: 'Dutchmen', model: 'Coleman Light 26BX', type: 'TT', length: "30'4\"", stockNo: '2477727', lot: 'KC1', extColor: 'Stone', intColor: '', notes: '1 Slide', daysOnLot: 333, listPrice: 34170, webPrice: 26499, status: 'available' },
  { year: 2026, brand: 'Dutchmen', model: 'Coleman Light 29BX', type: 'TT', length: "33'6\"", stockNo: '2456691', lot: 'KC1', extColor: 'Stone', intColor: '', notes: '2 Slides', daysOnLot: 214, listPrice: 47938, webPrice: 34999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Eagle HT 230MLCS', type: 'TT', length: "27'7\"", stockNo: '2519979', lot: 'KC1', extColor: 'Cali Linen', intColor: '', notes: '1 Slide', daysOnLot: 199, listPrice: 69014, webPrice: 45999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Eagle HT 294CKBS', type: 'TT', length: "37'11\"", stockNo: '2519980', lot: 'KC1', extColor: 'Cali Linen', intColor: '', notes: '3 Slides', daysOnLot: 171, listPrice: 86901, webPrice: 58999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Eagle HT 320MKTS', type: 'TT', length: "36'8\"", stockNo: '2590442', lot: 'KC1', extColor: '', intColor: '', notes: '2 Slides', daysOnLot: 101, listPrice: 81338, webPrice: 56999, status: 'available' },
  { year: 2025, brand: 'Thor', model: 'Eddie Bauer 17RB-C', type: 'TT', length: "20'10\"", stockNo: '2520634', lot: 'KC1', extColor: 'Meadow', intColor: '', notes: 'No Slide', daysOnLot: 255, listPrice: 19230, webPrice: 12999, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Eddie Bauer 2510RL-L', type: 'TT', length: "29'10\"", stockNo: '2536867', lot: 'KC1', extColor: 'Meadow', intColor: '', notes: '1 Slide', daysOnLot: 233, listPrice: 43816, webPrice: 31499, status: 'available' },
  { year: 2026, brand: 'Thor', model: 'Eddie Bauer 2600RK-L', type: 'TT', length: "32'3\"", stockNo: '2536816', lot: 'KC1', extColor: 'Meadow', intColor: '', notes: '1 Slide', daysOnLot: 226, listPrice: 50581, webPrice: 33899, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Feather 21MML', type: 'TT', length: "25'5\"", stockNo: '2545967', lot: 'KC1', extColor: 'Dune Gray', intColor: '', notes: '1 Slide', daysOnLot: 211, listPrice: 55597, webPrice: 36499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Feather 24FK', type: 'TT', length: "26'6\"", stockNo: '2558368', lot: 'KC1', extColor: 'Dune Gray', intColor: '', notes: '2 Slides', daysOnLot: 122, listPrice: 61367, webPrice: 40999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Feather 25RB', type: 'TT', length: "30'1\"", stockNo: '2595634', lot: 'KC1', extColor: '', intColor: '', notes: '1 Slide', daysOnLot: 45, listPrice: 61799, webPrice: 44999, status: 'lot_ready' },
  { year: 2026, brand: 'Jayco', model: 'Jay Feather 27BH', type: 'TT', length: "32'3\"", stockNo: '2606924', lot: 'KC1', extColor: '', intColor: '', notes: '1 Slide', daysOnLot: 73, listPrice: 67421, webPrice: 44999, status: 'lot_ready' },
  { year: 2026, brand: 'Jayco', model: 'Jay Feather 28RB', type: 'TT', length: "33'1\"", stockNo: '2568641', lot: 'KC1', extColor: 'Dune Gray', intColor: '', notes: '1 Slide', daysOnLot: 151, listPrice: 67127, webPrice: 45499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Feather 29BHB', type: 'TT', length: "34'0\"", stockNo: '2615101', lot: 'KC1', extColor: '', intColor: '', notes: '1 Slide', daysOnLot: 25, listPrice: 68055, webPrice: 47999, status: 'new_arrival' },
  { year: 2026, brand: 'Jayco', model: 'Jay Feather Air 15MRB', type: 'TT', length: "20'2\"", stockNo: '2554305', lot: 'KC1', extColor: 'Dune Gray', intColor: '', notes: 'No Slide', daysOnLot: 163, listPrice: 45096, webPrice: 28499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Feather Air 19MBS', type: 'TT', length: "23'1\"", stockNo: '2558366', lot: 'KC1', extColor: 'Dune Gray', intColor: '', notes: '1 Slide', daysOnLot: 156, listPrice: 52288, webPrice: 33999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Feather Air SL 15TBSL', type: 'TT', length: "17'6\"", stockNo: '2595854', lot: 'KC1', extColor: '', intColor: '', notes: 'No Slide', daysOnLot: 53, listPrice: 27968, webPrice: 21999, status: 'lot_ready' },
  { year: 2026, brand: 'Jayco', model: 'Jay Feather SL 26BHSL', type: 'TT', length: "30'5\"", stockNo: '2615580', lot: 'KC1', extColor: '', intColor: '', notes: '1 Slide', daysOnLot: 31, listPrice: 47150, webPrice: 38999, status: 'new_arrival' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 160LKW', type: 'TT', length: "21'7\"", stockNo: '2577233', lot: 'KC1', extColor: '', intColor: '', notes: '1 Slide', daysOnLot: 56, listPrice: 35683, webPrice: 24999, status: 'lot_ready' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 175BHW', type: 'TT', length: "22'3\"", stockNo: '2545801', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: 'No Slide', daysOnLot: 164, listPrice: 32648, webPrice: 19999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 175FQW', type: 'TT', length: "22'1\"", stockNo: '2562572', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: 'No Slide', daysOnLot: 147, listPrice: 32648, webPrice: 20999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 197MBW', type: 'TT', length: "23'7\"", stockNo: '2554175', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: '1 Slide', daysOnLot: 134, listPrice: 37148, webPrice: 21999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 200MKSW', type: 'TT', length: "24'7\"", stockNo: '2545909', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: '1 Slide', daysOnLot: 171, listPrice: 42120, webPrice: 28499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 210QBW', type: 'TT', length: "25'8\"", stockNo: '2562578', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: 'No Slide', daysOnLot: 119, listPrice: 38422, webPrice: 25499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 211MBW', type: 'TT', length: "24'6\"", stockNo: '2545957', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: 'No Slide', daysOnLot: 194, listPrice: 37470, webPrice: 24999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 225MLSW', type: 'TT', length: "27'1\"", stockNo: '2545972', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: '1 Slide', daysOnLot: 144, listPrice: 45120, webPrice: 29999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 260BHW', type: 'TT', length: "29'5\"", stockNo: '2554179', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: 'No Slide', daysOnLot: 162, listPrice: 36929, webPrice: 24499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 261BHSW', type: 'TT', length: "30'4\"", stockNo: '2558306', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: '1 Slide', daysOnLot: 150, listPrice: 44779, webPrice: 29999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 262RLSW', type: 'TT', length: "31'1\"", stockNo: '2562585', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: '1 Slide', daysOnLot: 136, listPrice: 44779, webPrice: 32499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 263BHSW', type: 'TT', length: "32'7\"", stockNo: '2558307', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: '1 Slide', daysOnLot: 137, listPrice: 46320, webPrice: 29999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 265BHSW', type: 'TT', length: "30'10\"", stockNo: '2554181', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: '1 Slide', daysOnLot: 157, listPrice: 45420, webPrice: 31499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 265MWSW', type: 'TT', length: "29'10\"", stockNo: '2615582', lot: 'KC1', extColor: '', intColor: '', notes: '1 Slide', daysOnLot: 25, listPrice: 46049, webPrice: 36999, status: 'new_arrival' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 287BHSW', type: 'TT', length: "34'4\"", stockNo: '2546135', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: '1 Slide', daysOnLot: 193, listPrice: 48113, webPrice: 33499, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 295TBS', type: 'TT', length: "36'10\"", stockNo: '2558400', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: '1 Slide', daysOnLot: 150, listPrice: 49201, webPrice: 34999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX 334RTS', type: 'TT', length: "37'10\"", stockNo: '2590474', lot: 'KC1', extColor: '', intColor: '', notes: '3 Slides', daysOnLot: 107, listPrice: 61733, webPrice: 45999, status: 'available' },
  { year: 2026, brand: 'Jayco', model: 'Jay Flight SLX Sport 250BHW', type: 'TT', length: "27'7\"", stockNo: '2554335', lot: 'KC1', extColor: 'Country Linen', intColor: '', notes: 'No Slide', daysOnLot: 150, listPrice: 33583, webPrice: 21499, status: 'available' },
  { year: 2024, brand: 'Heartland', model: 'Mallard M33S', type: 'TT', length: "39'5\"", stockNo: '2364316', lot: 'KC1', extColor: 'Multicolor Cascade', intColor: '', notes: '3 Slides', daysOnLot: 683, listPrice: 68848, webPrice: 41499, status: 'available' },
  { year: 2026, brand: 'Forest River', model: 'Wildwood Heritage Glen 261FKRB', type: 'TT', length: "31'9\"", stockNo: '2572959', lot: 'KC1', extColor: 'Dune', intColor: '', notes: '2 Slides', daysOnLot: 142, listPrice: 59660, webPrice: 42999, status: 'available' },
  { year: 2026, brand: 'Forest River', model: 'Wildwood Heritage Glen 265BSRB', type: 'TT', length: "33'2\"", stockNo: '2572962', lot: 'KC1', extColor: 'Dune', intColor: '', notes: '2 Slides', daysOnLot: 114, listPrice: 60064, webPrice: 43499, status: 'available' },
  { year: 2026, brand: 'Forest River', model: 'Wildwood Heritage Glen 27RKHL', type: 'TT', length: "34'0\"", stockNo: '2572964', lot: 'KC1', extColor: 'Dune', intColor: '', notes: '1 Slide', daysOnLot: 136, listPrice: 55347, webPrice: 39499, status: 'available' },
  { year: 2026, brand: 'Forest River', model: 'Wildwood Heritage Glen 308RL', type: 'TT', length: "37'11\"", stockNo: '2572956', lot: 'KC1', extColor: 'Dune', intColor: '', notes: '3 Slides', daysOnLot: 140, listPrice: 68347, webPrice: 49999, status: 'available' },
  { year: 2026, brand: 'Forest River', model: 'Wildwood Heritage Glen 310BHI', type: 'TT', length: "38'1\"", stockNo: '2572958', lot: 'KC1', extColor: 'Dune', intColor: '', notes: '3 Slides', daysOnLot: 136, listPrice: 70153, webPrice: 51499, status: 'available' },
  { year: 2026, brand: 'Forest River', model: 'Wildwood Heritage Glen 314BUD', type: 'TT', length: "38'9\"", stockNo: '2572961', lot: 'KC1', extColor: 'Dune', intColor: '', notes: '2 Slides', daysOnLot: 116, listPrice: 67602, webPrice: 59999, status: 'available' },
  // Toy Hauler Travel Trailers
  { year: 2026, brand: 'Starcraft', model: 'Campsite Reserve 19KR', type: 'TTH', length: "26'0\"", stockNo: '2561346', lot: 'KC1', extColor: 'Serengeti', intColor: '', notes: 'No Slide', daysOnLot: 137, listPrice: 34690, webPrice: 31999, status: 'available' },
  { year: 2026, brand: 'Heartland', model: 'Nightfall 20N', type: 'TTH', length: "26'5\"", stockNo: '2568402', lot: 'KC1', extColor: 'Dusk', intColor: '', notes: 'No Slide', daysOnLot: 87, listPrice: 48180, webPrice: 35999, status: 'available' },
  { year: 2025, brand: 'Heartland', model: 'Nightfall Ultra 21N', type: 'TTH', length: "27'5\"", stockNo: '2408997', lot: 'KC1', extColor: 'Dusk', intColor: '', notes: '1 Slide', daysOnLot: 492, listPrice: 56768, webPrice: 34999, status: 'available' },
  { year: 2026, brand: 'Cherokee', model: 'Wolf Pack 25-14', type: 'TTH', length: "26'4\"", stockNo: '2595038', lot: 'KC1', extColor: 'Coffee Bean', intColor: '', notes: 'No Slide', daysOnLot: 80, listPrice: 57587, webPrice: 39999, status: 'available' },
];

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

    const seedPassword = process.env['SEED_PASSWORD'] ?? 'Password1!';
    const passwordHash = bcrypt.hashSync(seedPassword, 10);
    const makes = Object.keys(MAKES_MODELS);

    // ── 1. Dealership Group ─────────────────────────────────────────────
    const [group] = await db
      .insert(dealershipGroups)
      .values({ name: 'KC RV Group' })
      .returning();

    console.log('  \u2713 1 dealership group (KC RV Group)');

    // ── 2. Dealerships ──────────────────────────────────────────────────
    const [sunshineDealer, mountainDealer] = await db
      .insert(dealerships)
      .values([
        {
          groupId: group!.id,
          name: 'KC RV Supercenter',
          address: '8000 NW Prairie View Rd',
          city: 'Kansas City',
          state: 'MO',
          zip: '64151',
          timezone: 'America/Chicago',
          subscriptionTier: 'professional',
          subscriptionStatus: 'active',
          settings: { enableSms: true, defaultMapZoom: 17 },
        },
        {
          groupId: group!.id,
          name: 'KC RV Outlet',
          address: '13101 W 87th St Pkwy',
          city: 'Lenexa',
          state: 'KS',
          zip: '66215',
          timezone: 'America/Chicago',
          subscriptionTier: 'starter',
          subscriptionStatus: 'active',
          settings: { enableSms: false, defaultMapZoom: 16 },
        },
      ])
      .returning();

    const sunId = sunshineDealer!.id;
    const mvId = mountainDealer!.id;

    console.log('  \u2713 2 dealerships (KC RV Supercenter, KC RV Outlet)');

    // ── 3. Lots ─────────────────────────────────────────────────────────
    const [sunMainLot, sunOverflowLot, mvMainLot] = await db
      .insert(lots)
      .values([
        {
          dealershipId: sunId,
          name: 'KC1 Main Lot',
          address: '8000 NW Prairie View Rd, Kansas City, MO 64151',
          totalSpots: 200,
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
          name: 'KC1 Overflow Lot',
          address: '8020 NW Prairie View Rd, Kansas City, MO 64151',
          totalSpots: 80,
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
          name: 'Lenexa Lot',
          address: '13101 W 87th St Pkwy, Lenexa, KS 66215',
          totalSpots: 60,
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

    console.log('  \u2713 3 lots (KC1 Main: 200 spots, KC1 Overflow: 80 spots, Lenexa: 60 spots)');

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

    // KC1 Main Lot: rows A-T x 10 (200 spots)
    for (let rowIdx = 0; rowIdx < 20; rowIdx++) {
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

    // KC1 Overflow Lot: rows A-H x 10 (80 spots)
    for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
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

    // Lenexa Lot: rows A-F x 10 (60 spots)
    for (let rowIdx = 0; rowIdx < 6; rowIdx++) {
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
        // KC RV Supercenter users
        { dealershipId: sunId, email: 'owner@kcrv.com', passwordHash, name: 'Sarah Mitchell', role: 'owner' },
        { dealershipId: sunId, email: 'manager@kcrv.com', passwordHash, name: 'James Rodriguez', role: 'manager' },
        { dealershipId: sunId, email: 'sales@kcrv.com', passwordHash, name: 'Emily Chen', role: 'sales' },
        { dealershipId: sunId, email: 'service@kcrv.com', passwordHash, name: 'Mike Thompson', role: 'service' },
        { dealershipId: sunId, email: 'porter@kcrv.com', passwordHash, name: 'David Garcia', role: 'porter' },
        { dealershipId: sunId, email: 'viewer@kcrv.com', passwordHash, name: 'Linda Park', role: 'viewer' },
        // KC RV Outlet users
        { dealershipId: mvId, email: 'owner@kcrvoutlet.com', passwordHash, name: 'Tom Bradley', role: 'owner' },
        { dealershipId: mvId, email: 'manager@kcrvoutlet.com', passwordHash, name: 'Rachel Kim', role: 'manager' },
        { dealershipId: mvId, email: 'sales@kcrvoutlet.com', passwordHash, name: 'Alex Turner', role: 'sales' },
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

    console.log('  \u2713 9 users (6 KC RV Supercenter + 3 KC RV Outlet)');

    // ── 6. Units — Real Inventory Data ──────────────────────────────────
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
      arrivedAt: Date;
    }> = [];

    // KC RV Supercenter — real inventory (main lot first 160, overflow rest)
    const kcUnits = REAL_INVENTORY;
    for (let i = 0; i < kcUnits.length; i++) {
      const rv = kcUnits[i]!;
      const isOverflow = i >= 160;
      const lotId = isOverflow ? sunOverflowLot!.id : sunMainLot!.id;
      const rowIndex = isOverflow
        ? Math.floor((i - 160) / 10)
        : Math.floor(i / 10);
      const spotIndex = (i % 10) + 1;
      const rowLabel = String.fromCharCode(65 + rowIndex);

      unitValues.push({
        dealershipId: sunId,
        lotId,
        stockNumber: rv.stockNo,
        vin: randomVin(),
        year: rv.year >= 2000 ? rv.year : 2000 + rv.year,
        make: rv.brand,
        model: rv.model,
        floorplan: rv.model.split(' ').pop() ?? '',
        unitType: parseType(rv.type),
        lengthFt: parseLength(rv.length),
        msrp: rv.listPrice.toString(),
        status: rv.status,
        currentZone: isOverflow ? 'overflow' : 'main',
        currentRow: rowLabel,
        currentSpot: spotIndex,
        arrivedAt: daysAgo(rv.daysOnLot),
      });
    }

    // KC RV Outlet — 20 random units for the second location
    for (let i = 0; i < 20; i++) {
      const make = randomPick(makes);
      const models = MAKES_MODELS[make]!;
      const model = randomPick(models);
      const rowIndex = Math.floor(i / 10);
      const spotIndex = (i % 10) + 1;
      const rowLabel = String.fromCharCode(65 + rowIndex);

      unitValues.push({
        dealershipId: mvId,
        lotId: mvMainLot!.id,
        stockNumber: `OUT${String(10000 + i + 1).padStart(5, '0')}`,
        vin: randomVin(),
        year: randomInt(2024, 2026),
        make,
        model,
        floorplan: randomPick(FLOORPLANS),
        unitType: randomPick(UNIT_TYPES),
        lengthFt: randomInt(18, 45).toString(),
        msrp: randomInt(22000, 185000).toString(),
        status: MV_STATUSES[i % MV_STATUSES.length]!,
        currentZone: 'main',
        currentRow: rowLabel,
        currentSpot: spotIndex,
        arrivedAt: daysAgo(randomInt(10, 300)),
      });
    }

    const insertedUnits = await db.insert(units).values(unitValues).returning();
    const sunUnits = insertedUnits.slice(0, kcUnits.length);
    const mvUnits = insertedUnits.slice(kcUnits.length);

    console.log(`  \u2713 ${insertedUnits.length} units (${kcUnits.length} KC RV Supercenter + ${mvUnits.length} KC RV Outlet)`);

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

    // 180 KC RV trackers
    for (let i = 0; i < 180; i++) {
      const hexSuffix = (i + 1).toString(16).toUpperCase().padStart(4, '0');
      const batteryPct = randomInt(15, 100);

      trackerValues.push({
        dealershipId: sunId,
        deviceEui: `A84041${hexSuffix}`,
        label: `KC-Tracker-${i + 1}`,
        firmwareVersion: `1.${randomInt(0, 3)}.${randomInt(0, 9)}`,
        status: i < 150 ? 'assigned' : 'unassigned',
        batteryPct,
        batteryMv: 2400 + batteryPct * 12,
        lastSeenAt: new Date(Date.now() - randomInt(0, 86400000)),
        lastLatitude: (27.960 + Math.random() * 0.002).toFixed(6),
        lastLongitude: (-82.510 + Math.random() * 0.004).toFixed(6),
        signalRssi: -1 * randomInt(40, 120),
      });
    }

    // 25 KC RV Outlet trackers
    for (let i = 0; i < 25; i++) {
      const hexSuffix = (180 + i + 1).toString(16).toUpperCase().padStart(4, '0');
      const batteryPct = randomInt(15, 100);

      trackerValues.push({
        dealershipId: mvId,
        deviceEui: `A84041${hexSuffix}`,
        label: `OUT-Tracker-${i + 1}`,
        firmwareVersion: `1.${randomInt(0, 3)}.${randomInt(0, 9)}`,
        status: i < 15 ? 'assigned' : 'unassigned',
        batteryPct,
        batteryMv: 2400 + batteryPct * 12,
        lastSeenAt: new Date(Date.now() - randomInt(0, 86400000)),
        lastLatitude: (38.960 + Math.random() * 0.002).toFixed(6),
        lastLongitude: (-94.790 + Math.random() * 0.002).toFixed(6),
        signalRssi: -1 * randomInt(40, 120),
      });
    }

    const insertedTrackers = await db.insert(trackers).values(trackerValues).returning();
    const sunTrackers = insertedTrackers.slice(0, 180);
    const mvTrackers = insertedTrackers.slice(180);

    console.log(`  \u2713 ${insertedTrackers.length} trackers (180 KC RV + 25 Outlet)`);

    // ── 8. Tracker Assignments ──────────────────────────────────────────
    const assignmentValues: Array<{
      trackerId: string;
      unitId: string;
      assignedBy: string;
    }> = [];

    // First 150 KC trackers -> first 150 KC units
    const kcAssignCount = Math.min(150, sunUnits.length);
    for (let i = 0; i < kcAssignCount; i++) {
      assignmentValues.push({
        trackerId: sunTrackers[i]!.id,
        unitId: sunUnits[i]!.id,
        assignedBy: sunOwner.id,
      });
    }

    // First 15 Outlet trackers -> first 15 Outlet units
    const outAssignCount = Math.min(15, mvUnits.length);
    for (let i = 0; i < outAssignCount; i++) {
      assignmentValues.push({
        trackerId: mvTrackers[i]!.id,
        unitId: mvUnits[i]!.id,
        assignedBy: mvOwner.id,
      });
    }

    await db.insert(trackerAssignments).values(assignmentValues);

    console.log(`  \u2713 ${assignmentValues.length} tracker assignments`);

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
    const demoApiKey = `rvtrax_demo_${crypto.randomBytes(12).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(demoApiKey).digest('hex');

    await db.insert(apiKeys).values({
      dealershipId: sunId,
      name: 'Mobile App Integration',
      keyHash,
      keyPrefix: demoApiKey.slice(0, 10),
      scopes: 'read,write',
      rateLimitPerMin: 500,
    });

    console.log('  \u2713 1 API key');

    // ── 25. Webhook Endpoint ────────────────────────────────────────────
    const webhookSecret = `whsec_${crypto.randomBytes(16).toString('hex')}`;

    await db.insert(webhookEndpoints).values({
      dealershipId: sunId,
      url: 'https://hooks.example.com/rvtrax',
      secret: webhookSecret,
      events: 'unit.created,unit.status_changed,geofence.breach',
      status: 'active',
    });

    console.log('  \u2713 1 webhook endpoint');

    // ── 26. DMS Integration ─────────────────────────────────────────────
    await db.insert(dmsIntegrations).values({
      dealershipId: sunId,
      provider: 'lightspeed',
      config: JSON.stringify({ apiUrl: 'https://dms-api.example.com', dealerCode: 'DEMO01' }),
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
    console.log('  Email:    owner@kcrv.com');
    console.log(`  Password: ${seedPassword}`);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
