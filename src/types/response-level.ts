export type ResponseLevel = "basic" | "advanced";

export const DEFAULT_RESPONSE_LEVEL: ResponseLevel = "basic";

export function isResponseLevel(value: unknown): value is ResponseLevel {
  return value === "basic" || value === "advanced";
}
