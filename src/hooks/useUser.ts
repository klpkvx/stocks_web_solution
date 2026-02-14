import { useCallback, useEffect, useState } from "react";
import { useUserStore, type UpdateUserInput, type User } from "@/stores/userStore";

export function useUser(userId: string) {
  const id = userId.trim();
  const cachedUser = useUserStore((state) =>
    id ? state.cache[id]?.data : undefined
  );
  const getUser = useUserStore((state) => state.getUser);
  const updateUserAction = useUserStore((state) => state.updateUser);

  const [user, setUser] = useState<User | undefined>(cachedUser);
  const [loading, setLoading] = useState<boolean>(Boolean(id && !cachedUser));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getUser(id);
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setLoading(false);
    }
  }, [getUser, id]);

  const updateUser = useCallback(
    async (payload: UpdateUserInput) => {
      if (!id) throw new Error("userId is required");
      setLoading(true);
      setError(null);
      try {
        const data = await updateUserAction(id, payload);
        setUser(data);
        return data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update user";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [id, updateUserAction]
  );

  useEffect(() => {
    setUser(cachedUser);
    if (id) {
      void refresh();
    }
  }, [cachedUser, id, refresh]);

  return {
    user,
    loading,
    error,
    refresh,
    updateUser
  };
}

