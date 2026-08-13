export type Trip = {
  id: string;
  name: string;
  createdAt: string;
};

export type TripMutationResult = { success: boolean; message?: string; trip?: Trip };

export function normalizeTripName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

export function validateTripName(name: string): TripMutationResult & { name?: string } {
  const normalized = normalizeTripName(name);
  if (!normalized) return { success: false, message: 'Enter a trip name.' };
  if (normalized.length > 32) return { success: false, message: 'Keep trip names under 32 characters.' };
  return { success: true, name: normalized };
}

export function sanitizeTrips(list: unknown): Trip[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const trips: Trip[] = [];
  list.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const record = item as Partial<Trip>;
    if (typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.createdAt !== 'string') return;
    const name = normalizeTripName(record.name);
    if (!name || seen.has(record.id)) return;
    seen.add(record.id);
    trips.push({ id: record.id, name, createdAt: record.createdAt });
  });
  return trips.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function findTripById(trips: Trip[], tripId?: string | null) {
  if (!tripId) return undefined;
  return trips.find((trip) => trip.id === tripId);
}

export function mergeTrips(local: Trip[], imported: Trip[]) {
  const byId = new Map<string, Trip>();
  local.forEach((trip) => byId.set(trip.id, trip));
  imported.forEach((trip) => {
    if (!byId.has(trip.id)) byId.set(trip.id, trip);
  });
  return Array.from(byId.values()).sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function createTripId() {
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
