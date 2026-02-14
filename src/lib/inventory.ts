export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  threshold: number;
  unit: string;
  lastRestock?: string;
  lastAlert?: string;
  lastUpdated?: string;
};

export type InventoryAlert = {
  id: string;
  itemId: string;
  name: string;
  sku: string;
  stock: number;
  threshold: number;
  timestamp: string;
  status: "pending" | "resolved";
  resolvedAt?: string;
};

export type InventoryEvent = {
  id: string;
  itemId: string;
  type: "alert" | "restock" | "threshold" | "consume";
  value: number;
  timestamp: string;
};

const ANCHOR = new Date("2024-06-01T00:00:00.000Z");
const DAY = 86400000;

function isoDaysAgo(days: number) {
  return new Date(ANCHOR.getTime() - days * DAY).toISOString();
}

export const DEFAULT_INVENTORY: InventoryItem[] = [
  {
    id: "inv-espresso",
    name: "Espresso Beans",
    sku: "BEAN-ESP-01",
    stock: 34,
    threshold: 20,
    unit: "bags",
    lastRestock: isoDaysAgo(3),
    lastUpdated: ANCHOR.toISOString()
  },
  {
    id: "inv-matcha",
    name: "Matcha Powder",
    sku: "MAT-POW-02",
    stock: 9,
    threshold: 12,
    unit: "tins",
    lastRestock: isoDaysAgo(6),
    lastUpdated: ANCHOR.toISOString()
  },
  {
    id: "inv-oat",
    name: "Oat Milk",
    sku: "OAT-MLK-04",
    stock: 18,
    threshold: 15,
    unit: "cartons",
    lastRestock: isoDaysAgo(2),
    lastUpdated: ANCHOR.toISOString()
  },
  {
    id: "inv-cups",
    name: "Paper Cups 12oz",
    sku: "CUP-12-10",
    stock: 120,
    threshold: 80,
    unit: "sleeves",
    lastRestock: isoDaysAgo(10),
    lastUpdated: ANCHOR.toISOString()
  }
];

export function computeAlertConversionRate(items: InventoryItem[]) {
  const withAlerts = items.filter((item) => item.lastAlert);
  if (!withAlerts.length) return 0;
  const resolved = withAlerts.filter((item) => {
    if (!item.lastAlert || !item.lastRestock) return false;
    return Date.parse(item.lastRestock) > Date.parse(item.lastAlert);
  });
  return resolved.length / withAlerts.length;
}

export function computeAverageRecoveryHours(items: InventoryItem[]) {
  const samples = items
    .map((item) => {
      if (!item.lastAlert || !item.lastRestock) return null;
      const alertTime = Date.parse(item.lastAlert);
      const restockTime = Date.parse(item.lastRestock);
      if (!Number.isFinite(alertTime) || !Number.isFinite(restockTime)) return null;
      if (restockTime <= alertTime) return null;
      return (restockTime - alertTime) / 3600000;
    })
    .filter((value): value is number => value !== null);
  if (!samples.length) return 0;
  return samples.reduce((acc, value) => acc + value, 0) / samples.length;
}

export function countThresholdAdjustments(events: InventoryEvent[], windowMs: number) {
  const cutoff = Date.now() - windowMs;
  return events.filter(
    (event) => event.type === "threshold" && Date.parse(event.timestamp) >= cutoff
  ).length;
}

export function pendingAlerts(items: InventoryItem[]) {
  return items.filter((item) => item.stock <= item.threshold);
}
