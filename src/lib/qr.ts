const DEFAULT_APP_ORIGIN = "https://id-verifier-black.vercel.app";

function getAppOrigin(): string {
  const configuredOrigin = import.meta.env.VITE_APP_ORIGIN?.trim();
  return configuredOrigin || DEFAULT_APP_ORIGIN;
}

export function buildEmployeeQrValue(token: string): string {
  return `${getAppOrigin()}/?token=${encodeURIComponent(token)}`;
}

export function extractTokenFromQrValue(raw: string): string {
  const value = raw.trim();

  try {
    const parsedUrl = new URL(value);
    return (parsedUrl.searchParams.get("token") ?? parsedUrl.searchParams.get("id") ?? value).trim();
  } catch {
    return value;
  }
}