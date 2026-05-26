export function buildEmployeeQrValue(token: string): string {
  return `${window.location.origin}/?token=${encodeURIComponent(token)}`;
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