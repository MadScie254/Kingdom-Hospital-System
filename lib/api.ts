export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method || "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json", "x-requested-with": "kh" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json?.error || "The request failed. Check your connection and try again.");
  return json as T;
}
