'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Gateway } from '@rv-trax/shared';
import { Card } from '@/components/ui/Card';

interface GatewayHealthChartProps {
  gateways: Gateway[];
}

// Generate placeholder 24h data since real data comes from a separate endpoint
const COLORS = [
  '#338dfc',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];

function generatePlaceholderData(gateways: Gateway[]) {
  const now = new Date();
  const hours: { time: string; [key: string]: number | string }[] = [];

  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourLabel = time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
    });

    const point: { time: string; [key: string]: number | string } = {
      time: hourLabel,
    };

    gateways.forEach((gw) => {
      const key = gw.label || gw.device_eui.slice(-6);
      // Placeholder: show 0 packets for all gateways until real data is wired
      point[key] = 0;
    });

    hours.push(point);
  }

  return hours;
}

export function GatewayHealthChart({ gateways }: GatewayHealthChartProps) {
  const chartData = useMemo(
    () => generatePlaceholderData(gateways),
    [gateways]
  );

  const gatewayKeys = useMemo(
    () =>
      gateways.map((gw) => gw.label || gw.device_eui.slice(-6)),
    [gateways]
  );

  if (gateways.length === 0) return null;

  return (
    <Card className="p-4">
      <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
        Packet Throughput (Last 24h)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {gatewayKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-xs text-[var(--color-text-tertiary)]">
        Real-time packet throughput data will populate once gateways begin reporting.
      </p>
    </Card>
  );
}
