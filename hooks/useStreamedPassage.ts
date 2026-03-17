import { experimental_streamedQuery as streamedQuery } from "@tanstack/query-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { useSubscription } from "@/providers/SubscriptionContext";
import { streamRemoteReadingPassage } from "@/services/ai-streams";

export function useStreamedPassage(level: string | undefined, sessionId: number) {
  const subscription = useSubscription();
  const queryClient = useQueryClient();
  const prevFetchStatusRef = useRef<string>("idle");
  const onCompleteRef = useRef<((fullText: string) => void) | null>(null);
  const refetchRef = useRef<() => void>(() => {});

  const query = useQuery({
    queryKey: ["ai-reading-passage", sessionId] as const,
    enabled: false,
    queryFn: streamedQuery<string, string>({
      streamFn: ({ signal }: { signal: AbortSignal }) => {
        if (!subscription.isPremium) {
          subscription.showPaywall();
          throw new Error("Subscription required for AI reading passages");
        }
        return streamRemoteReadingPassage(level!, signal);
      },
      reducer: (prev: string, chunk: string) => prev + chunk,
      initialValue: "",
    }),
    staleTime: Infinity,
    gcTime: 0,
  });

  refetchRef.current = () => query.refetch();

  // Fire onComplete callback when stream finishes
  useEffect(() => {
    if (
      prevFetchStatusRef.current === "fetching" &&
      query.fetchStatus === "idle" &&
      query.isSuccess &&
      query.data
    ) {
      onCompleteRef.current?.(query.data);
    }
    prevFetchStatusRef.current = query.fetchStatus;
  }, [query.fetchStatus, query.isSuccess, query.data]);

  const generate = useCallback(
    (onComplete?: (fullText: string) => void) => {
      onCompleteRef.current = onComplete ?? null;
      queryClient.resetQueries({ queryKey: ["ai-reading-passage", sessionId] });
      refetchRef.current();
    },
    [queryClient, sessionId]
  );

  const cancel = useCallback(() => {
    queryClient.cancelQueries({
      queryKey: ["ai-reading-passage", sessionId],
    });
  }, [queryClient, sessionId]);

  return {
    data: query.data ?? "",
    isStreaming: query.fetchStatus === "fetching",
    isLoading: query.isPending && query.fetchStatus === "fetching",
    error: query.error,
    generate,
    cancel,
  };
}
