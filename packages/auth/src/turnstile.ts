export async function verifyTurnstile(
  token: string,
  secret: string,
  hostname: string,
  action: string,
): Promise<boolean> {
  if (!secret || !token) return false;
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) return false;
  const result: unknown = await response.json();
  return Boolean(
    result &&
      typeof result === "object" &&
      "success" in result &&
      result.success === true &&
      "hostname" in result &&
      result.hostname === hostname &&
      "action" in result &&
      result.action === action,
  );
}
