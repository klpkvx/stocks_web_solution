import { QueryClient } from "@tanstack/react-query";

function is4xx(error: unknown) {
  const message = String((error as any)?.message || "");
  return /\b4\d\d\b/.test(message);
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry(failureCount, error) {
          if (is4xx(error)) return false;
          return failureCount < 2;
        },
        retryDelay(attempt) {
          return Math.min(4000, 300 * 2 ** attempt);
        }
      },
      mutations: {
        retry(failureCount, error) {
          if (is4xx(error)) return false;
          return failureCount < 1;
        }
      }
    }
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }
  return browserQueryClient;
}

