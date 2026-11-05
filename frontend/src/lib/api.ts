export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = unknown>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: method || (body ? "POST" : "GET"),
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.message || "Request failed", res.status);
  return data;
}
