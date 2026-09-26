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
  /** Client-generated id so offline batches can be retried idempotently (NFR-05). */
  clientAttemptId: string;
  lessonId: string;
  lessonVersion: number;
  exerciseId: string;
  answer: unknown;
  answeredAt: string;
  timeTakenMs: number;
}

export interface SubmitAttemptsResultDto {
  accepted: string[];
  rejected: Array<{ clientAttemptId: string; reason: string }>;
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
    readonly problem: ProblemDetails | undefined,
  ) {
    super(problem?.title ?? `Request failed with status ${status}`);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  /** Gateway origin, e.g. `https://api.englishpath.app`. Empty string = same origin. */
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
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

  submitAttempts(attempts: AttemptDto[]): Promise<SubmitAttemptsResultDto> {
    return this.request("POST", "/learning/attempts", { attempts });
  }

  getDashboard(): Promise<DashboardDto> {
    return this.request("GET", "/progress/dashboard");
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = await this.options.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await this.fetchImpl(`${this.options.baseUrl}/api/${API_VERSION}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

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
}
