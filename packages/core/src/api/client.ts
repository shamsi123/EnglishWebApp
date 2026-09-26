import type { Answer } from "../content/scoring.js";
import type { CefrLevel, Lesson, Skill } from "../content/schema.js";

/**
 * Versioned REST client (BRD §8.3 decision 6) shared by the PWA and the Capacitor apps.
 * All calls go through the YARP gateway under `/api/v1`.
 */

export const API_VERSION = "v1";

export type LessonState = "locked" | "unlocked" | "inProgress" | "completed";

export interface CourseMapDto {
  courseId: string;
  levels: Array<{
    level: CefrLevel;
    title: string;
    units: Array<{
      id: string;
      title: string;
      state: LessonState;
      lessons: Array<{ id: string; title: string; state: LessonState }>;
    }>;
  }>;
}

export interface AttemptDto {
  exerciseId: string;
  answer: Answer;
  /** ISO date-time. Only the first attempt per exercise is scored; mistake-review retries follow. */
  answeredAt: string;
  timeTakenMs: number;
}

export interface CompleteLessonRequest {
  /** Client-generated UUID so offline syncs can be retried idempotently (NFR-05). */
  completionId: string;
  lessonVersion: number;
  /** Learner's local calendar day, YYYY-MM-DD (drives daily goals and streaks). */
  learnerLocalDay: string;
  attempts: AttemptDto[];
}

export interface CompletionResultDto {
  completionId: string;
  correctFirstTry: number;
  totalExercises: number;
}

export interface DueCardDto {
  vocabularyId: string;
  dueAt: string;
  repetitions: number;
}

export type LearningGoal = "work" | "travel" | "study" | "exam";

export interface RegisterRequest {
  email: string;
  password: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  /** Required for learners aged 13–17 (FR-05). */
  guardianEmail?: string;
  acceptedTerms: boolean;
}

export interface MeDto {
  id: string;
  email: string;
  emailVerified: boolean;
  guardianConsent: "NotRequired" | "Pending" | "Granted";
  hasPassword: boolean;
  logins: string[];
  roles: string[];
  onboarding: { goal: LearningGoal; dailyMinutes: 5 | 10 | 15 | 20; nativeLanguage: string } | null;
}

export interface DashboardDto {
  streak: number;
  longestStreak: number;
  totalXp: number;
  todayXp: number;
  dailyGoalXp: number;
  lessonsCompleted: number;
  wordsLearned: number;
  reviewsDue: number;
  skills: Record<Skill, number>;
}

/** RFC 7807 problem details as returned by ASP.NET Core. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: (ProblemDetails & { code?: string }) | undefined,
  ) {
    super(problem?.title ?? `Request failed with status ${status}`);
    this.name = "ApiError";
  }

  /** Machine-readable error code from the API, e.g. `account.email_taken`. */
  get code(): string | undefined {
    return this.problem?.code;
  }
}

export interface ApiClientOptions {
  /** Gateway origin, e.g. `https://api.englishpath.app`. Empty string = same origin. */
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  /** Called once on a 401 to get a fresh token (e.g. `AuthSession.refresh`); the request is retried with it. */
  onUnauthorized?: () => Promise<string | null>;
  fetch?: typeof fetch;
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  getCourseMap(): Promise<CourseMapDto> {
    return this.request("GET", "/learning/course-map");
  }

  getLesson(lessonId: string): Promise<Lesson> {
    return this.request("GET", `/learning/lessons/${encodeURIComponent(lessonId)}`);
  }

  /** Server re-grades the attempts and awards XP asynchronously (BRD §8.3 decisions 3–4). */
  completeLesson(lessonId: string, body: CompleteLessonRequest): Promise<CompletionResultDto> {
    return this.request("POST", `/learning/lessons/${encodeURIComponent(lessonId)}/completions`, body);
  }

  /** @param today learner's local day, YYYY-MM-DD */
  getDashboard(today: string): Promise<DashboardDto> {
    return this.request("GET", `/progress/dashboard?today=${encodeURIComponent(today)}`);
  }

  setDailyGoal(minutes: 5 | 10 | 15 | 20): Promise<void> {
    return this.request("PUT", "/progress/daily-goal", { minutes });
  }

  getDueReviews(limit = 20): Promise<DueCardDto[]> {
    return this.request("GET", `/progress/reviews/due?limit=${limit}`);
  }

  /** @param grade SM-2 self-grade 0–5 */
  reviewWord(vocabularyId: string, grade: number): Promise<DueCardDto> {
    return this.request("POST", `/progress/reviews/${encodeURIComponent(vocabularyId)}`, { grade });
  }

  // Identity & onboarding (FR-01–05)

  register(body: RegisterRequest): Promise<{ userId: string; requiresGuardianConsent: boolean }> {
    return this.request("POST", "/identity/accounts", body);
  }

  verifyEmail(userId: string, token: string): Promise<void> {
    return this.request("POST", "/identity/accounts/verify-email", { userId, token });
  }

  resendVerification(): Promise<void> {
    return this.request("POST", "/identity/accounts/resend-verification");
  }

  forgotPassword(email: string): Promise<void> {
    return this.request("POST", "/identity/accounts/forgot-password", { email });
  }

  resetPassword(userId: string, token: string, newPassword: string): Promise<void> {
    return this.request("POST", "/identity/accounts/reset-password", { userId, token, newPassword });
  }

  guardianConsent(userId: string, token: string, granted: boolean): Promise<void> {
    return this.request("POST", "/identity/accounts/guardian-consent", { userId, token, granted });
  }

  getMe(): Promise<MeDto> {
    return this.request("GET", "/identity/me");
  }

  saveOnboarding(body: { goal: LearningGoal; dailyMinutes: 5 | 10 | 15 | 20; nativeLanguage: string }): Promise<void> {
    return this.request("PUT", "/identity/me/onboarding", body);
  }

  /** FR-04 self-service deletion; password accounts must re-enter their password. */
  deleteAccount(password?: string): Promise<void> {
    return this.request("POST", "/identity/me/delete", { password: password ?? null });
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response = await this.send(method, path, body, await this.options.getAccessToken?.());
    if (response.status === 401 && this.options.onUnauthorized) {
      const fresh = await this.options.onUnauthorized();
      if (fresh) response = await this.send(method, path, body, fresh);
    }

    if (!response.ok) {
      let problem: ProblemDetails | undefined;
      try {
        problem = (await response.json()) as ProblemDetails;
      } catch {
        problem = undefined;
      }
      throw new ApiError(response.status, problem);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private send(method: string, path: string, body: unknown, token: string | null | undefined): Promise<Response> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return this.fetchImpl(`${this.options.baseUrl}/api/${API_VERSION}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
}
