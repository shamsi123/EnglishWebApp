/**
 * Thin, typed client for services/api (BRD §13). Every call is best-effort: with no VITE_API_URL,
 * or when the network/API is unreachable, calls reject and callers fall back to local-only mode —
 * the app must keep working fully offline (FR-40).
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const apiEnabled = BASE.length > 0;

export interface AvatarDto {
  animal: string;
  color: string;
  item: string;
}
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  parentId: string;
}
export interface ChildDto {
  id: string;
  nickname: string;
  ageBand: string;
  avatar: AvatarDto;
  hasPin: boolean;
  dailyLimitMinutes: number;
}
export interface AttemptDto {
  id: string;
  childId: string;
  activityId: string;
  lessonId: string;
  itemId: string;
  isCorrect: boolean;
  score: number | null;
  createdAtUtc: string;
}
export interface QuizItemResultDto {
  itemId: string;
  correct: boolean;
}
export interface QuizSubmitResponse {
  mastered: boolean;
  score: number;
  stars: number;
  missedItems: string[];
  nextNodeId: string | null;
  newRewards: string[];
}
export interface JourneyNodeDto {
  id: string;
  kind: string;
  title: string;
  status: string;
  stars: number;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let tokens: { access: string; refresh: string } | null = null;
/** Called by the store once at startup / on sign-in so requests can carry a bearer token. */
export function setTokens(next: { access: string; refresh: string } | null) {
  tokens = next;
}
/** Lets the store learn about a token refresh performed inside this client. */
export type OnRefresh = (tokens: { access: string; refresh: string }) => void;
let onRefresh: OnRefresh = () => {};
export function setOnRefresh(fn: OnRefresh) {
  onRefresh = fn;
}

async function raw(path: string, init: RequestInit): Promise<Response> {
  if (!apiEnabled) throw new ApiError(0, 'API disabled (no VITE_API_URL)');
  return fetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => res.statusText));
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Authenticated request. On a single 401, refreshes the access token once and retries. */
async function auth<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!tokens) throw new ApiError(401, 'Not signed in');
  const withToken = (t: string) => ({ ...init, headers: { ...init.headers, Authorization: `Bearer ${t}` } });
  let res = await raw(path, withToken(tokens.access));
  if (res.status === 401) {
    const refreshed = await refresh(tokens.refresh);
    tokens = { access: refreshed.accessToken, refresh: refreshed.refreshToken };
    onRefresh(tokens);
    res = await raw(path, withToken(tokens.access));
  }
  return parse<T>(res);
}

export async function register(email: string, password: string, consentGiven: boolean, locale?: string): Promise<AuthResponse> {
  return parse(await raw('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, consentGiven, locale }) }));
}
export async function login(email: string, password: string): Promise<AuthResponse> {
  return parse(await raw('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }));
}
export async function refresh(refreshToken: string): Promise<AuthResponse> {
  return parse(await raw('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }));
}

export interface CreateChildRequest {
  id: string;
  nickname: string;
  ageBand: string;
  avatar: AvatarDto;
  picturePinHash: string | null;
}
export const createChild = (req: CreateChildRequest) => auth<ChildDto>('/children', { method: 'POST', body: JSON.stringify(req) });
export const deleteChild = (id: string) => auth<void>(`/children/${id}`, { method: 'DELETE' });

export const journey = (courseId: string, childId: string) => auth<{ courseId: string; nodes: JourneyNodeDto[] }>(`/courses/${courseId}/journey?childId=${childId}`);

export const submitAttemptsBatch = (attempts: AttemptDto[]) =>
  auth<{ acceptedIds: string[] }>('/attempts/batch', { method: 'POST', body: JSON.stringify({ attempts }) });

export const submitQuiz = (nodeId: string, childId: string, results: QuizItemResultDto[], traceAccuracy: number | null) =>
  auth<QuizSubmitResponse>(`/quizzes/${nodeId}/submit`, { method: 'POST', body: JSON.stringify({ childId, results, traceAccuracy }) });

export const unlock = (childId: string, nodeId: string) => auth<boolean>(`/parent/children/${childId}/unlock/${nodeId}`, { method: 'POST' });

export { ApiError };
