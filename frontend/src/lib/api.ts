import type { Share, CreateShareResult, Credentials } from "./types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || "Request failed");
  }
  return data as T;
}

export const api = {
  health: () => request<{ cloudflared: boolean }>("/api/health"),

  selectFolder: () =>
    request<{ folderPath: string | null }>("/api/select-folder", {
      method: "POST",
    }),

  listShares: () => request<Share[]>("/api/shares"),

  createShare: (folderPath: string, expiresInHours: number) =>
    request<CreateShareResult>("/api/shares", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ folderPath, expiresInHours }),
    }),

  stopShare: (id: string) =>
    request<{ stopped: boolean }>(`/api/shares/${id}`, { method: "DELETE" }),

  credentials: (id: string) =>
    request<Credentials>(`/api/shares/${encodeURIComponent(id)}/credentials`),
};
