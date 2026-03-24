import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin,
  Radio,
  BarChart3,
  Shield,
  Zap,
  ChevronRight,
  Check,
  Satellite,
  Layers,
  Wrench,
  Globe,
  Activity,
  ClipboardCheck,
  Car,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img src="/icons/icon.svg" alt="RV Trax" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-[#E8D5B5]">RV</span>
              <span className="text-[#C4943D]"> Trax</span>
            </span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm text-slate-600 transition-colors hover:text-slate-900"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-slate-600 transition-colors hover:text-slate-900"
            >
              How It Works
            </a>
            <a
              href="#screenshots"
              className="text-sm text-slate-600 transition-colors hover:text-slate-900"
            >
              Screenshots
            </a>
            <a
              href="#pricing"
              className="text-sm text-slate-600 transition-colors hover:text-slate-900"
            >
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-[#C4943D] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8a6126]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#fdf8f0]/50 to-white" />
        <div className="absolute top-0 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#C4943D]/15 blur-3xl" />

        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#C4943D]/30 bg-[#fdf8f0] px-4 py-1.5 text-sm text-[#8a6126]">
            <Satellite className="h-3.5 w-3.5" />
            LoRaWAN-powered GPS tracking
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Know where every unit is. <span className="text-[#C4943D]">Every second.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 lg:text-xl">
            Real-time GPS lot management built for RV dealerships. Track inventory, monitor devices,
            optimize staging, and eliminate lot walks — all from one dashboard.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg bg-[#C4943D] px-6 py-3 text-base font-medium text-white shadow-lg shadow-[#C4943D]/25 transition-all hover:bg-[#8a6126] hover:shadow-xl hover:shadow-[#C4943D]/30"
            >
              Start Free Trial
              <ChevronRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-6 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              See How It Works
            </a>
          </div>

          {/* Hero screenshot */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-2xl shadow-[#1a120b]/10">
              <Image
                src="/screenshots/02-dashboard.png"
                alt="RV Trax Dashboard — real-time lot overview with inventory metrics, tracker health, and interactive map"
                width={1920}
                height={1080}
                className="w-full"
                priority
              />
            </div>
            {/* Glow effect */}
            <div className="absolute -inset-4 -z-10 rounded-2xl bg-gradient-to-r from-[#C4943D]/20 via-[#fdf8f0] to-[#C4943D]/20 opacity-60 blur-2xl" />
          </div>
        </div>
      </section>

      {/* ── Metrics bar ────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 text-center md:grid-cols-4">
          {[
            { value: '10x', label: 'Cheaper than cellular GPS' },
            { value: '30s', label: 'Position update interval' },
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '5min', label: 'Average setup time' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-[#C4943D]">{stat.value}</div>
              <div className="mt-1 text-sm text-slate-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to manage your lot
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Purpose-built for RV dealerships. From GPS tracking to service management, RV Trax
              replaces spreadsheets, radios, and lot walks.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: MapPin,
                title: 'Real-Time GPS Tracking',
                description:
                  'See every unit on an interactive map. LoRaWAN trackers provide precise positions every 30 seconds at a fraction of cellular GPS cost.',
              },
              {
                icon: Shield,
                title: 'Geofencing & Alerts',
                description:
                  'Define lot boundaries, restricted zones, and custom geofences. Get instant alerts when units move unexpectedly — day or night.',
              },
              {
                icon: Layers,
                title: 'Staging & Lot Optimization',
                description:
                  'Plan your lot layout with drag-and-drop staging. Assign units to specific spots and track moves from arrival to delivery.',
              },
              {
                icon: BarChart3,
                title: 'Analytics & Reporting',
                description:
                  'Inventory aging, lot utilization, movement patterns — see the metrics that matter. Schedule automated reports to your inbox.',
              },
              {
                icon: Wrench,
                title: 'Service & Work Orders',
                description:
                  'Manage PDI, service, and maintenance tasks. Track recalls, assign work orders, and keep your service bay running smoothly.',
              },
              {
                icon: Globe,
                title: 'Open API & Integrations',
                description:
                  'Connect to your DMS, build custom integrations, and automate workflows. Webhooks, API keys, and full developer documentation.',
              },
              {
                icon: ClipboardCheck,
                title: 'Floor Plan Audits',
                description:
                  'Monthly inventory verification for floor plan lenders. Verify, mark missing, or flag mislocated units with a guided walkthrough.',
              },
              {
                icon: Activity,
                title: 'Staff Activity Tracking',
                description:
                  'See who did what and when. Timeline feed with efficiency stats, action breakdowns, and top performer leaderboards.',
              },
              {
                icon: Car,
                title: 'Test Drive Management',
                description:
                  'Track test drives with live timers, customer details, and distance logging. Full history for every unit.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-slate-200 p-6 transition-all hover:border-[#C4943D]/30 hover:shadow-lg hover:shadow-[#fdf8f0]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fdf8f0] text-[#C4943D] transition-colors group-hover:bg-[#C4943D] group-hover:text-white">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Up and running in minutes
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              No complex installations. No IT department needed. RV Trax works out of the box with
              simple LoRaWAN hardware.
            </p>
          </div>

          <div className="mt-16 grid gap-12 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Install Gateways',
                description:
                  'Place LoRaWAN gateways around your lot. Each gateway covers up to 2 miles and connects via WiFi or Ethernet.',
                icon: Radio,
              },
              {
                step: '02',
                title: 'Attach Trackers',
                description:
                  'Stick weatherproof GPS trackers on your units. Battery lasts up to 3 years — no charging, no wiring.',
                icon: Satellite,
              },
              {
                step: '03',
                title: 'Track Everything',
                description:
                  'Open the dashboard and see your entire lot in real time. Set up alerts, plan staging, and run your lot from anywhere.',
                icon: Zap,
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C4943D] text-white shadow-lg shadow-[#C4943D]/25">
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="mt-4 text-xs font-bold uppercase tracking-widest text-[#C4943D]">
                  Step {item.step}
                </div>
                <h3 className="mt-2 text-xl font-semibold">
                  {item.step === '03' ? item.title : item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Screenshots ────────────────────────────────────────────────────── */}
      <section id="screenshots" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">See it in action</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Every screen designed for speed and clarity. From the dashboard to device management,
              every feature is one click away.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2">
            {[
              {
                src: '/screenshots/02-dashboard.png',
                alt: 'Dashboard with real-time metrics, tracker health, and lot map preview',
                label: 'Dashboard Overview',
              },
              {
                src: '/screenshots/04-trackers.png',
                alt: 'GPS tracker management with battery levels, signal strength, and firmware status',
                label: 'Tracker Management',
              },
              {
                src: '/screenshots/05-alerts.png',
                alt: 'Alert center with severity levels, acknowledgment, and notification history',
                label: 'Alerts & Notifications',
              },
              {
                src: '/screenshots/06-analytics.png',
                alt: 'Analytics dashboard with inventory aging, utilization charts, and movement patterns',
                label: 'Analytics & Reports',
              },
              {
                src: '/screenshots/07-staging.png',
                alt: 'Drag-and-drop staging planner for lot optimization',
                label: 'Lot Staging',
              },
              {
                src: '/screenshots/08-service.png',
                alt: 'Service management with work orders, recalls, and maintenance tracking',
                label: 'Service & Work Orders',
              },
            ].map((screenshot) => (
              <div key={screenshot.label} className="group">
                <div className="overflow-hidden rounded-xl border border-slate-200 transition-all group-hover:border-[#C4943D]/30 group-hover:shadow-lg">
                  <Image
                    src={screenshot.src}
                    alt={screenshot.alt}
                    width={1200}
                    height={675}
                    className="w-full transition-transform group-hover:scale-[1.02]"
                  />
                </div>
                <p className="mt-3 text-center text-sm font-medium text-slate-700">
                  {screenshot.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Multi-Tenant Callout ────────────────────────────────────────────── */}
      <section className="bg-[#1a120b] py-24 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Built for multi-location dealers
              </h2>
              <p className="mt-4 text-lg text-[#D4C4A8]">
                Manage multiple lots from a single dashboard. Dealership groups, role-based access,
                and inter-lot transfers — all with complete data isolation between locations.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  'Dealership group management with shared reporting',
                  'Role-based access: Owner, Manager, Sales, Service, Porter',
                  'Inter-lot unit transfers with full audit trail',
                  'Per-location billing and feature configuration',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#D4A456]" />
                    <span className="text-[#D4C4A8]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-xl border border-[#3d2b1f] shadow-2xl">
              <Image
                src="/screenshots/10-settings.png"
                alt="Multi-location settings with dealership group management"
                width={1200}
                height={675}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Start free, scale as you grow. No hidden fees, no long-term contracts.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-3">
            {[
              {
                name: 'Starter',
                price: '$49',
                period: '/month',
                description: 'For single-lot dealerships getting started with tracking.',
                features: [
                  'Up to 50 units',
                  '5 GPS trackers',
                  '1 gateway',
                  'Email alerts',
                  'Basic analytics',
                  'Community support',
                ],
                cta: 'Start Free Trial',
                highlighted: false,
              },
              {
                name: 'Professional',
                price: '$149',
                period: '/month',
                description: 'For growing dealerships that need full lot management.',
                features: [
                  'Up to 500 units',
                  'Unlimited trackers',
                  'Up to 5 gateways',
                  'SMS + email + push alerts',
                  'Advanced analytics & reports',
                  'Staging & lot optimization',
                  'Work order management',
                  'API access & webhooks',
                  'Priority support',
                ],
                cta: 'Start Free Trial',
                highlighted: true,
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                period: '',
                description: 'For multi-location groups with advanced needs.',
                features: [
                  'Unlimited everything',
                  'Dealership group management',
                  'DMS integration',
                  'White-label options',
                  'Custom geofences',
                  'Compliance reporting',
                  'Dedicated support',
                  'On-premise deployment',
                  'SLA guarantee',
                ],
                cta: 'Contact Sales',
                highlighted: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl border p-8 ${
                  plan.highlighted
                    ? 'border-[#C4943D] shadow-xl shadow-[#C4943D]/10'
                    : 'border-slate-200'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#C4943D] px-3 py-0.5 text-xs font-medium text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-[#9a8876]">{plan.period}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{plan.description}</p>
                <Link
                  href="/login"
                  className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                    plan.highlighted
                      ? 'bg-[#C4943D] text-white hover:bg-[#8a6126]'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {plan.cta}
                </Link>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C4943D]" />
                      <span className="text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Developer Section ──────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700">
            <Globe className="h-3.5 w-3.5" />
            Developer-friendly
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
            Build on top of RV Trax
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Full REST API, webhook events, and DMS connectors. Integrate with your existing systems
            or build custom workflows.
          </p>
          <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-xl border border-slate-300 bg-[#1a120b] p-6 text-left">
            <pre className="text-sm leading-relaxed text-[#D4C4A8]">
              <code>{`curl -X GET https://api.rvtrax.com/v1/units \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json"

{
  "data": [
    {
      "id": "unit_abc123",
      "stockNumber": "RV-2026-001",
      "status": "available",
      "position": {
        "lat": 33.4484,
        "lng": -112.0740
      }
    }
  ],
  "pagination": { "total": 47, "hasMore": true }
}`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="bg-[#C4943D] py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Stop losing units. Start tracking them.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#E8D5B5]">
            Join dealerships that have eliminated lot walks, reduced theft risk, and streamlined
            their operations with RV Trax.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg bg-white px-8 py-3 text-base font-semibold text-[#C4943D] shadow-lg transition-all hover:bg-[#fdf8f0] hover:shadow-xl"
            >
              Start Free Trial
              <ChevronRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:sales@rvtrax.com"
              className="rounded-lg border border-[#D4A456] px-8 py-3 text-base font-medium text-white transition-colors hover:bg-[#8a6126]"
            >
              Contact Sales
            </a>
          </div>
          <p className="mt-6 text-sm text-[#D4C4A8]">14-day free trial. No credit card required.</p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <img src="/icons/icon.svg" alt="RV Trax" className="h-7 w-7 rounded-lg" />
                <span className="text-base font-bold">
                  <span className="text-[#E8D5B5]">RV</span>
                  <span className="text-[#C4943D]"> Trax</span>
                </span>
              </div>
              <p className="mt-3 text-sm text-[#9a8876]">
                Real-time GPS lot management for RV dealerships.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Product</h4>
              <ul className="mt-3 space-y-2 text-sm text-[#9a8876]">
                <li>
                  <a href="#features" className="hover:text-slate-900">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-slate-900">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#screenshots" className="hover:text-slate-900">
                    Screenshots
                  </a>
                </li>
                <li>
                  <Link href="/login" className="hover:text-slate-900">
                    Sign In
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Developers</h4>
              <ul className="mt-3 space-y-2 text-sm text-[#9a8876]">
                <li>
                  <a href="#" className="hover:text-slate-900">
                    API Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-900">
                    Webhooks
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-900">
                    Status Page
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Company</h4>
              <ul className="mt-3 space-y-2 text-sm text-[#9a8876]">
                <li>
                  <a href="mailto:support@rvtrax.com" className="hover:text-slate-900">
                    Support
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-900">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-900">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-200 pt-8 text-center text-sm text-[#B5A48A]">
            &copy; {new Date().getFullYear()} RV Trax. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
