/**
 * Client side of the Identity token server (FR-01, NFR-06). The access token (15 min) is kept
 * in memory only; the rotating refresh token is persisted through a pluggable storage so the
 * Capacitor apps can use the device's secure storage instead of web storage.
 */

export const EXTERNAL_GRANT_TYPE = "urn:englishpath:params:oauth:grant-type:external_id_token";
const SCOPES = "openid email roles offline_access api";
/** Refresh this long before expiry so requests never race an expiring token. */
const EXPIRY_MARGIN_MS = 60_000;

export interface RefreshTokenStorage {
  get(): string | null | Promise<string | null>;
  set(token: string | null): void | Promise<void>;
}

/** An OAuth error from the token endpoint. `code` is our machine-readable reason, e.g. `registration_required`. */
export class OAuthError extends Error {
  constructor(
    readonly error: string,
    description: string | undefined,
    readonly code: string | undefined,
  ) {
    super(description ?? error);
    this.name = "OAuthError";
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface AuthSessionOptions {
  baseUrl: string;
  clientId: string;
  storage: RefreshTokenStorage;
  fetch?: typeof fetch;
  now?: () => number;
}

export type ExternalProvider = "google" | "apple";

export class AuthSession {
  private accessToken: string | null = null;
  private expiresAt = 0;
  private refreshing: Promise<string | null> | null = null;
  private listeners = new Set<(signedIn: boolean) => void>();
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly options: AuthSessionOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? Date.now;
  }

  get isSignedIn(): boolean {
    return this.accessToken !== null;
  }

  /** Notified when the learner signs in or out (including when a refresh token is rejected). */
  subscribe(listener: (signedIn: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  signInWithPassword(email: string, password: string): Promise<void> {
    return this.grant({ grant_type: "password", username: email, password });
  }

  /**
   * Exchanges a Google/Apple ID token. On first sign-in this rejects with code
   * `registration_required`; retry with `dateOfBirth` (and `guardianEmail` for minors).
   */
  signInWithProvider(
    provider: ExternalProvider,
    idToken: string,
    extra: { dateOfBirth?: string; guardianEmail?: string } = {},
  ): Promise<void> {
    return this.grant({
      grant_type: EXTERNAL_GRANT_TYPE,
      provider,
      id_token: idToken,
      ...(extra.dateOfBirth ? { date_of_birth: extra.dateOfBirth } : {}),
      ...(extra.guardianEmail ? { guardian_email: extra.guardianEmail } : {}),
    });
  }

  /** Restores a session from a stored refresh token (app start). Resolves to whether it succeeded. */
  async restore(): Promise<boolean> {
    return (await this.refresh()) !== null;
  }

  /** A valid access token, refreshing first if needed; null when signed out. */
  async getAccessToken(): Promise<string | null> {
    if (this.accessToken && this.now() < this.expiresAt - EXPIRY_MARGIN_MS) return this.accessToken;
    return this.refresh();
  }

  /** Refreshes once even when called concurrently. Resolves to null if the session is gone. */
  refresh(): Promise<string | null> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  async signOut(): Promise<void> {
    const refreshToken = await this.options.storage.get();
    await this.clear();
    if (refreshToken) {
      // Best effort: the token is already forgotten locally.
      await this.post("/connect/revoke", { token: refreshToken, token_type_hint: "refresh_token", client_id: this.options.clientId }).catch(() => undefined);
    }
  }

  private async doRefresh(): Promise<string | null> {
    const refreshToken = await this.options.storage.get();
    if (!refreshToken) {
      if (this.accessToken) await this.clear();
      return null;
    }
    try {
      await this.grant({ grant_type: "refresh_token", refresh_token: refreshToken });
      return this.accessToken;
    } catch (error) {
      // A rejected refresh token means the session ended (expired, reset, deleted); network errors don't.
      if (error instanceof OAuthError) {
        await this.clear();
        return null;
      }
      throw error;
    }
  }

  private async grant(params: Record<string, string>): Promise<void> {
    const response = await this.post("/connect/token", { ...params, client_id: this.options.clientId, scope: SCOPES });
    const body = (await response.json().catch(() => ({}))) as Partial<TokenResponse> & {
      error?: string;
      error_description?: string;
      error_uri?: string;
    };
    if (!response.ok || !body.access_token) {
      const code = body.error_uri?.startsWith("https://englishpath.app/errors/")
        ? body.error_uri.slice("https://englishpath.app/errors/".length)
        : undefined;
      throw new OAuthError(body.error ?? "server_error", body.error_description, code);
    }

    const wasSignedIn = this.isSignedIn;
    this.accessToken = body.access_token;
    this.expiresAt = this.now() + (body.expires_in ?? 900) * 1000;
    if (body.refresh_token) await this.options.storage.set(body.refresh_token);
    if (!wasSignedIn) this.emit(true);
  }

  private post(path: string, form: Record<string, string>): Promise<Response> {
    return this.fetchImpl(`${this.options.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(form).toString(),
    });
  }

  private async clear(): Promise<void> {
    const wasSignedIn = this.isSignedIn;
    this.accessToken = null;
    this.expiresAt = 0;
    await this.options.storage.set(null);
    if (wasSignedIn) this.emit(false);
  }

  private emit(signedIn: boolean) {
    for (const listener of this.listeners) listener(signedIn);
  }
}
