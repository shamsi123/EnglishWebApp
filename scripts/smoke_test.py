#!/usr/bin/env python3
"""End-to-end smoke test against a running local stack (see README "Getting started").

Exercises sign-up, sign-in, token refresh, onboarding, the CMS workflow, lesson completion with
event-driven progress, and account deletion with data erasure — all through the gateway.
Uses only the standard library. Usage: python3 scripts/smoke_test.py [gateway_url]
"""
import datetime
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

GW = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000"
ADMIN = ("admin@englishpath.local", "local-admin-password")  # seeded in Development
CLIENT_ID = "englishpath-web"
failures = 0


def http(method, path, token=None, body=None, form=None):
    headers = {}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    if form is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        data = urllib.parse.urlencode(form).encode()
    req = urllib.request.Request(GW + path, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, json.loads(raw) if raw else None


def check(name, condition, detail=""):
    global failures
    print(("PASS " if condition else "FAIL ") + name + ("" if condition else f"  -> {detail}"))
    failures += 0 if condition else 1


def login(email, password):
    return http("POST", "/connect/token", form={
        "grant_type": "password", "client_id": CLIENT_ID, "username": email, "password": password,
        "scope": "openid email roles offline_access api"})


def main():
    status, admin = login(*ADMIN)
    check("admin signs in", status == 200, admin)
    admin_token = admin["access_token"]

    # Learner sign-up and sign-in (FR-01).
    email = f"learner-{uuid.uuid4().hex[:8]}@example.com"
    password = "correct horse battery"
    status, reg = http("POST", "/api/v1/identity/accounts/", body={
        "email": email, "password": password, "dateOfBirth": "2000-05-01", "acceptedTerms": True})
    check("adult registers", status == 200 and reg["requiresGuardianConsent"] is False, reg)
    status, dup = http("POST", "/api/v1/identity/accounts/", body={
        "email": email, "password": password, "dateOfBirth": "2000-05-01", "acceptedTerms": True})
    check("duplicate email rejected", status == 409, dup)
    status, weak = http("POST", "/api/v1/identity/accounts/", body={
        "email": "x" + email, "password": "short", "dateOfBirth": "2000-05-01", "acceptedTerms": True})
    check("short password rejected", status == 400 and weak["code"] == "account.password", weak)

    # Age rules (FR-05).
    young = (datetime.date.today() - datetime.timedelta(days=365 * 10)).isoformat()
    minor = (datetime.date.today() - datetime.timedelta(days=365 * 15)).isoformat()
    status, r = http("POST", "/api/v1/identity/accounts/", body={
        "email": "kid" + email, "password": password, "dateOfBirth": young, "acceptedTerms": True})
    check("under-13 rejected", status == 400 and r["code"] == "account.too_young", r)
    status, r = http("POST", "/api/v1/identity/accounts/", body={
        "email": "teen" + email, "password": password, "dateOfBirth": minor, "acceptedTerms": True})
    check("minor needs guardian email", status == 400 and r["code"] == "account.guardian_required", r)
    status, r = http("POST", "/api/v1/identity/accounts/", body={
        "email": "teen" + email, "password": password, "dateOfBirth": minor,
        "guardianEmail": "parent@example.com", "acceptedTerms": True})
    check("minor registers pending consent", status == 200 and r["requiresGuardianConsent"], r)
    status, r = login("teen" + email, password)
    check("minor blocked until guardian consents", status == 400 and r.get("error_uri", "").endswith("guardian_consent_required"), r)

    status, tokens = login(email, password)
    check("learner signs in", status == 200 and "refresh_token" in tokens, tokens)
    status, bad = login(email, "wrong password!!")
    check("wrong password rejected", status == 400 and bad["error"] == "invalid_grant", bad)

    status, refreshed = http("POST", "/connect/token", form={
        "grant_type": "refresh_token", "client_id": CLIENT_ID, "refresh_token": tokens["refresh_token"]})
    check("refresh token rotates", status == 200 and refreshed["refresh_token"] != tokens["refresh_token"], refreshed)
    learner = refreshed["access_token"]

    status, me = http("GET", "/api/v1/identity/me/", learner)
    check("profile", status == 200 and me["email"] == email and me["onboarding"] is None, me)

    # Onboarding (FR-02) sets the daily goal in Progress via an event.
    status, r = http("PUT", "/api/v1/identity/me/onboarding", learner, {"goal": "work", "dailyMinutes": 5, "nativeLanguage": "ml"})
    check("onboarding saved", status == 204, r)

    # CMS: author, review, publish (FR-80, FR-82) as the seeded super admin.
    audio = {"assetId": "a1", "url": "https://cdn.example.com/a.m4a", "text": "Good morning"}
    ex = lambda i, **kw: {"id": f"e{i}", "prompt": "p", "explanation": "x", "skills": ["vocabulary"], **kw}
    content = {
        "objective": "I can say hello.", "intro": {"concept": "c", "example": "e"},
        "vocabulary": [{"id": "v-hello", "word": "hello", "example": "Hello!"}],
        "exercises": [ex(1, type="listenSelect", audio=audio, options=["a", "b"], correctIndex=0, skills=["listening"])]
        + [ex(i, type="multipleChoice", options=["a", "b"], correctIndex=1) for i in range(2, 9)],
    }
    check("learner cannot author", http("POST", "/api/v1/learning/admin/units", learner, {"level": "PreA1", "order": 0, "title": "x"})[0] == 403)
    status, unit = http("POST", "/api/v1/learning/admin/units", admin_token, {"level": "PreA1", "order": 99, "title": "Smoke test"})
    status, lesson = http("POST", "/api/v1/learning/admin/lessons", admin_token, {"unitId": unit, "order": 0, "title": "Smoke", "content": content})
    check("lesson created", status == 200, lesson)
    check("submitted", http("POST", f"/api/v1/learning/admin/lessons/{lesson}/submit", admin_token)[0] == 204)
    check("published", http("POST", f"/api/v1/learning/admin/lessons/{lesson}/publish", admin_token)[0] == 204)

    # Learner completes it; Progress awards XP asynchronously.
    status, bundle = http("GET", f"/api/v1/learning/lessons/{lesson}", learner)
    check("lesson bundle", status == 200 and len(bundle["exercises"]) == 8, bundle)
    now = datetime.datetime.now(datetime.timezone.utc)
    attempts = [{"exerciseId": "e1", "answer": {"type": "listenSelect", "selectedIndex": 0}, "answeredAt": now.isoformat(), "timeTakenMs": 1000}]
    attempts += [{"exerciseId": f"e{i}", "answer": {"type": "multipleChoice", "selectedIndex": 1}, "answeredAt": now.isoformat(), "timeTakenMs": 900} for i in range(2, 9)]
    body = {"completionId": str(uuid.uuid4()), "lessonVersion": bundle["version"], "learnerLocalDay": now.date().isoformat(), "attempts": attempts}
    status, done = http("POST", f"/api/v1/learning/lessons/{lesson}/completions", learner, body)
    check("lesson completed", status == 200 and done["correctFirstTry"] == 8, done)

    dash = None
    for _ in range(30):
        status, dash = http("GET", f"/api/v1/progress/dashboard?today={now.date().isoformat()}", learner)
        if dash and dash["lessonsCompleted"] == 1 and dash["dailyGoalXp"] == 10:
            break
        time.sleep(1)
    check("XP, goal from onboarding and streak", dash["totalXp"] == 23 and dash["dailyGoalXp"] == 10 and dash["streak"] == 1, dash)
    check("word bank populated", dash["wordsLearned"] == 1, dash)

    # Deletion (FR-04) erases data in other services (NFR-08).
    status, r = http("POST", "/api/v1/identity/me/delete", learner, {"password": "nope"})
    check("delete requires password", status == 403, r)
    check("account deleted", http("POST", "/api/v1/identity/me/delete", learner, {"password": password})[0] == 204)
    check("deleted user cannot sign in", login(email, password)[0] == 400)
    status, r = http("POST", "/connect/token", form={
        "grant_type": "refresh_token", "client_id": CLIENT_ID, "refresh_token": refreshed["refresh_token"]})
    check("deleted user's refresh token rejected", status == 400, r)
    for _ in range(30):
        # The access token stays valid for up to 15 minutes, which lets us observe the erasure.
        status, dash = http("GET", f"/api/v1/progress/dashboard?today={now.date().isoformat()}", learner)
        if dash["lessonsCompleted"] == 0:
            break
        time.sleep(1)
    check("progress erased", dash["lessonsCompleted"] == 0 and dash["wordsLearned"] == 0, dash)
    state = None
    for _ in range(30):
        _, course = http("GET", "/api/v1/learning/course-map", learner)
        state = next(l["state"] for lv in course["levels"] for u in lv["units"] for l in u["lessons"] if l["id"] == lesson)
        if state != "completed":
            break
        time.sleep(1)
    check("lesson history erased", state != "completed", state)

    print(f"\n{'All checks passed' if failures == 0 else f'{failures} check(s) failed'}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
