import { API_VERSION } from "@englishpath/core";
import { auth } from "../../shared/auth";

/**
 * CMS API calls (FR-80–85, FR-92). Kept out of packages/core so the learner bundle never carries
 * admin-only code (NFR-02); this module is only loaded when /admin is visited.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type LessonKind = "Lesson" | "Checkpoint";
export type DraftStatus = "Draft" | "InReview" | "Published";
export type CefrLevel = "PreA1" | "A1" | "A2" | "B1" | "B2";

export const CEFR_LEVELS: CefrLevel[] = ["PreA1", "A1", "A2", "B1", "B2"];

export interface OutlineLesson {
  id: string;
  order: number;
  title: string;
  kind: LessonKind;
  status: DraftStatus;
  publishedVersion: number | null;
  updatedAt: string;
}

export interface OutlineUnit {
  id: string;
  level: CefrLevel;
  order: number;
  title: string;
  lessons: OutlineLesson[];
}

export interface LessonVersionInfo {
  version: number;
  publishedAt: string;
  publishedBy: string;
  rolledBackFrom: number | null;
}

export interface AuthoringLesson {
  id: string;
  unitId: string;
  order: number;
  title: string;
  kind: LessonKind;
  status: DraftStatus;
  publishedVersion: number | null;
  draft: unknown;
  draftProblems: string[];
  versions: LessonVersionInfo[];
}

export interface AuditEntry {
  at: string;
  actorId: string;
  action: string;
  target: string | null;
}

export interface MediaAsset {
  id: string;
  kind: "image" | "audio";
  url: string;
  contentType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalFileName: string;
  uploadedAt: string;
}

export interface PlacementItem {
  id: string;
  level: CefrLevel;
  skill: string;
  isActive: boolean;
  exercise: unknown;
}

export interface ContentPackage {
  formatVersion: number;
  units: Array<{ level: CefrLevel; order: number; title: string; lessons: Array<{ order: number; title: string; kind: LessonKind; content: unknown }> }>;
  placementItems: Array<{ level: CefrLevel; exercise: unknown }>;
}

class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const send = async (token: string | null) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(`${BASE_URL}/api/${API_VERSION}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  };

  let response = await send(await auth.getAccessToken());
  if (response.status === 401) {
    const fresh = await auth.refresh();
    if (fresh) response = await send(fresh);
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => undefined);
    throw new AdminApiError(response.status, problem?.title ?? `Request failed with status ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

async function upload(path: string, file: File): Promise<MediaAsset> {
  const form = new FormData();
  form.append("file", file);
  const send = async (token: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${BASE_URL}/api/${API_VERSION}${path}`, { method: "POST", headers, body: form });
  };

  let response = await send(await auth.getAccessToken());
  if (response.status === 401) {
    const fresh = await auth.refresh();
    if (fresh) response = await send(fresh);
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => undefined);
    throw new AdminApiError(response.status, problem?.title ?? `Upload failed with status ${response.status}`);
  }
  return response.json();
}

export const adminApi = {
  getOutline: () => request<OutlineUnit[]>("GET", "/learning/admin/outline"),

  createUnit: (level: CefrLevel, order: number, title: string) =>
    request<string>("POST", "/learning/admin/units", { level, order, title }),

  createLesson: (unitId: string, order: number, title: string, content: unknown, kind: LessonKind = "Lesson") =>
    request<string>("POST", "/learning/admin/lessons", { unitId, order, title, content, kind }),

  getLesson: (lessonId: string) => request<AuthoringLesson>("GET", `/learning/admin/lessons/${lessonId}`),

  updateLessonDraft: (lessonId: string, title: string, content: unknown) =>
    request<void>("PUT", `/learning/admin/lessons/${lessonId}`, { title, content }),

  submitForReview: (lessonId: string) => request<void>("POST", `/learning/admin/lessons/${lessonId}/submit`),

  requestChanges: (lessonId: string) => request<void>("POST", `/learning/admin/lessons/${lessonId}/request-changes`),

  publish: (lessonId: string) => request<void>("POST", `/learning/admin/lessons/${lessonId}/publish`),

  rollback: (lessonId: string, version: number) => request<void>("POST", `/learning/admin/lessons/${lessonId}/rollback`, { version }),

  getAudit: (target?: string, limit = 50) =>
    request<AuditEntry[]>("GET", `/learning/admin/audit?limit=${limit}${target ? `&target=${encodeURIComponent(target)}` : ""}`),

  listMedia: (kind?: "Image" | "Audio") => request<MediaAsset[]>("GET", `/learning/admin/media${kind ? `?kind=${kind}` : ""}`),

  uploadMedia: (file: File) => upload("/learning/admin/media", file),

  listPlacementItems: (level?: CefrLevel) =>
    request<PlacementItem[]>("GET", `/learning/admin/placement-items${level ? `?level=${level}` : ""}`),

  createPlacementItem: (level: CefrLevel, exercise: unknown) =>
    request<string>("POST", "/learning/admin/placement-items", { level, exercise }),

  retirePlacementItem: (itemId: string) => request<void>("DELETE", `/learning/admin/placement-items/${itemId}`),

  exportContent: () => request<ContentPackage>("GET", "/learning/admin/export"),

  importContent: (pkg: ContentPackage) =>
    request<{ unitsCreated: number; lessonsCreated: number; placementItemsCreated: number }>("POST", "/learning/admin/import", pkg),
};

export { AdminApiError };
