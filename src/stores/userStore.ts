import { create } from "zustand";

const USER_TTL_MS = 5 * 60 * 1000;

export type User = {
  id: string;
  name: string;
  email?: string;
  updatedAt?: string;
};

export type UpdateUserInput = Partial<Omit<User, "id">>;

type UserCacheEntry = {
  data: User;
  timestamp: number;
};

type UserStoreState = {
  cache: Record<string, UserCacheEntry>;
  getUser: (userId: string) => Promise<User>;
  updateUser: (userId: string, data: UpdateUserInput) => Promise<User>;
  clearCache: () => void;
};

const inFlight = new Map<string, Promise<User>>();

function isFresh(entry?: UserCacheEntry) {
  return Boolean(entry && Date.now() - entry.timestamp < USER_TTL_MS);
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessage = Array.isArray(payload?.errors)
      ? payload.errors[0]?.message
      : null;
    const message =
      payload?.detail ||
      payload?.error ||
      payload?.message ||
      validationMessage ||
      payload?.title ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export const useUserStore = create<UserStoreState>((set, get) => ({
  cache: {},

  async getUser(userId: string) {
    const id = userId.trim();
    if (!id) throw new Error("userId is required");

    const cached = get().cache[id];
    if (isFresh(cached)) {
      return cached!.data;
    }

    const pending = inFlight.get(id);
    if (pending) return pending;

    const task = (async () => {
      try {
        const response = await fetch(`/api/users/${encodeURIComponent(id)}`);
        const user = await parseJson<User>(response);
        set((state) => ({
          cache: {
            ...state.cache,
            [id]: { data: user, timestamp: Date.now() }
          }
        }));
        return user;
      } catch (error) {
        if (cached?.data) return cached.data;
        throw error;
      } finally {
        inFlight.delete(id);
      }
    })();

    inFlight.set(id, task);
    return task;
  },

  async updateUser(userId: string, data: UpdateUserInput) {
    const id = userId.trim();
    if (!id) throw new Error("userId is required");

    const response = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(data)
    });
    const user = await parseJson<User>(response);
    set((state) => ({
      cache: {
        ...state.cache,
        [id]: { data: user, timestamp: Date.now() }
      }
    }));
    return user;
  },

  clearCache() {
    inFlight.clear();
    set({ cache: {} });
  }
}));
