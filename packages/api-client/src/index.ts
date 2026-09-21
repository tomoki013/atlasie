export class ApiClient {
  constructor(
    readonly base: string,
    readonly token: () => Promise<string>,
  ) {}
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.base}/v1${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await this.token()}`,
        ...init.headers,
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
export type RemoteVisit = import("./schema").components["schemas"]["Visit"];
