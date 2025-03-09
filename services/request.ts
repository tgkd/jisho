export type AiExample = {
  jp: string;
  en: string;
  expl: string | null | undefined;
};

export function getAiExamples(
  prompt?: string,
  provider: "cf" | "open" = "open"
) {
  return function (signal?: AbortSignal | null) {
    if (!prompt) {
      return Promise.resolve(new Response());
    }
    return fetch(
      `${process.env.EXPO_PUBLIC_BASE_URL}/ask/${provider}?prompt=${prompt}`,
      {
        signal: signal || undefined,
        headers: {
          Authorization: `Basic ${btoa(
            `${process.env.EXPO_PUBLIC_AUTH_USERNAME}:${process.env.EXPO_PUBLIC_AUTH_PASSWORD}`
          )}`,
        },
        credentials: "include",
      }
    );
  };
}
