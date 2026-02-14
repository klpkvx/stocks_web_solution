export type ActivityEvent = {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  meta?: Record<string, any>;
};

export function createActivityEvent(
  type: string,
  message: string,
  meta?: Record<string, any>
): ActivityEvent {
  return {
    id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    message,
    timestamp: new Date().toISOString(),
    meta
  };
}

export function countRecentActivity(events: ActivityEvent[], windowMs: number) {
  const cutoff = Date.now() - windowMs;
  return events.filter((event) => Date.parse(event.timestamp) >= cutoff).length;
}

export function getRecentActivity(events: ActivityEvent[], windowMs: number) {
  const cutoff = Date.now() - windowMs;
  return events.filter((event) => Date.parse(event.timestamp) >= cutoff);
}
