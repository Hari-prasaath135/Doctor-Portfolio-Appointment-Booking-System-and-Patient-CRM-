const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base =
    configuredApiBase ||
    (process.env.NODE_ENV === "development" ? "http://localhost:5000/api/v1" : "");

  if (!base) {
    throw new Error(
      "The API is not configured. Set NEXT_PUBLIC_API_BASE_URL to your backend API base URL."
    );
  }

  return `${base}${normalizedPath}`;
}
