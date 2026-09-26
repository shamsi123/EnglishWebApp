#!/usr/bin/env python3
"""Seeds a small starter course and placement item bank into a local stack, for development.

Creates two Pre-A1 units (the first ends in a checkpoint quiz), one A1 and one A2 unit, and five
placement questions per level. Uses the seeded Development admin. Standard library only.
Usage: python3 scripts/seed_dev_content.py [gateway_url]
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

GW = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000"


def http(method, path, token=None, body=None, form=None):
    headers, data = {}, None
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
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} failed: {e.code} {e.read().decode()}")


def tts(text):
    # Placeholder audio; the web player falls back to speech synthesis using the transcript.
    slug = "".join(c if c.isalnum() else "-" for c in text.lower())
    return {"assetId": slug, "url": f"https://cdn.englishpath.invalid/audio/{slug}.m4a", "text": text}


def mc(eid, prompt, options, correct, explanation, skill="vocabulary"):
    return {"id": eid, "type": "multipleChoice", "prompt": prompt, "options": options, "correctIndex": correct,
            "explanation": explanation, "skills": [skill]}


def listen(eid, text, options, explanation):
    return {"id": eid, "type": "listenSelect", "prompt": "What do you hear?", "audio": tts(text), "options": options,
            "correctIndex": options.index(text), "explanation": explanation, "skills": ["listening"]}


def fill(eid, sentence, answers, explanation, skill="grammar"):
    return {"id": eid, "type": "fillBlank", "prompt": "Complete the sentence.", "sentence": sentence,
            "acceptedAnswers": answers, "explanation": explanation, "skills": [skill]}


def lesson(objective, concept, example, vocabulary, exercises):
    return {"objective": objective, "intro": {"concept": concept, "example": example},
            "vocabulary": vocabulary, "exercises": exercises}


def word(vid, w, ipa, example, translation=None):
    entry = {"id": vid, "word": w, "ipa": ipa, "example": example}
    if translation:
        entry["translation"] = translation
    return entry


GREETINGS = lesson(
    "I can say hello and goodbye.", "We say hello when we meet and goodbye when we leave.", "Hello! — Goodbye!",
    [word("v-hello", "hello", "/həˈləʊ/", "Hello, Tom!"), word("v-goodbye", "goodbye", "/ɡʊdˈbaɪ/", "Goodbye, see you later.")],
    [mc("g1", "You meet a friend. What do you say?", ["Hello!", "Goodbye!"], 0, "We say 'Hello!' when we meet."),
     listen("g2", "Good morning", ["Good morning", "Good night"], "The speaker says 'Good morning'."),
     mc("g3", "You leave work. What do you say?", ["Hello!", "Goodbye!"], 1, "We say 'Goodbye!' when we leave."),
     fill("g4", "Good ___! (at 9 a.m.)", ["morning"], "At 9 a.m. we say 'Good morning'.", "vocabulary"),
     mc("g5", "Which is a greeting?", ["Hi!", "Table"], 0, "'Hi!' is an informal hello."),
     mc("g6", "Reply to 'How are you?'", ["I'm fine, thanks.", "I'm Tom."], 0, "We answer with how we feel."),
     listen("g7", "See you tomorrow", ["See you tomorrow", "See you today"], "The speaker says 'See you tomorrow'."),
     mc("g8", "What do you say at night before bed?", ["Good night", "Good morning"], 0, "'Good night' is for the end of the day.")])

INTRODUCTIONS = lesson(
    "I can say my name.", "Use 'I am' or 'I'm' with your name.", "I'm Sara. Nice to meet you.",
    [word("v-name", "name", "/neɪm/", "My name is Ravi."), word("v-meet", "meet", "/miːt/", "Nice to meet you.")],
    [fill("i1", "I ___ Sara.", ["am", "'m"], "With 'I' we use 'am'."),
     mc("i2", "Choose the correct sentence.", ["My name is Ravi.", "My name are Ravi."], 0, "'Name' is singular, so we use 'is'.", "grammar"),
     listen("i3", "Nice to meet you", ["Nice to meet you", "Nice to see you"], "The speaker says 'Nice to meet you'."),
     mc("i4", "Someone says 'I'm Tom.' You say:", ["Nice to meet you, Tom.", "Goodbye, Tom."], 0, "We reply to an introduction politely."),
     fill("i5", "What ___ your name?", ["is", "'s"], "We ask 'What is your name?'."),
     mc("i6", "Which word means what people call you?", ["name", "meet"], 0, "Your name is what people call you."),
     mc("i7", "'I'm' is short for…", ["I am", "I is"], 0, "'I'm' = 'I am'.", "grammar"),
     listen("i8", "My name is Aisha", ["My name is Aisha", "Her name is Aisha"], "The speaker says 'My name is Aisha'.")])

CHECKPOINT = lesson(
    "I can greet people and introduce myself.", "Checkpoint: greetings and introductions. You need 70% to unlock the next unit.",
    "Hello! I'm Sara. Nice to meet you.", [],
    [mc("c1", "You meet your teacher at 8 a.m.", ["Good morning!", "Good night!"], 0, "Before 12 we say 'Good morning'."),
     fill("c2", "I ___ Joseph.", ["am", "'m"], "With 'I' we use 'am'."),
     listen("c3", "Goodbye", ["Goodbye", "Hello"], "The speaker says 'Goodbye'."),
     mc("c4", "Reply to 'Nice to meet you.'", ["Nice to meet you too.", "Good night."], 0, "We return the greeting."),
     mc("c5", "Choose the correct question.", ["What is your name?", "What are your name?"], 0, "'Name' is singular.", "grammar"),
     fill("c6", "See you ___! (the next day)", ["tomorrow"], "The next day is 'tomorrow'.", "vocabulary"),
     listen("c7", "I'm fine, thanks", ["I'm fine, thanks", "I'm five, thanks"], "The speaker says 'I'm fine, thanks'."),
     mc("c8", "Which is informal?", ["Hi!", "Good afternoon."], 0, "'Hi!' is informal."),
     mc("c9", "You leave a shop. You say:", ["Bye!", "Hello!"], 0, "We say 'Bye!' when leaving."),
     mc("c10", "'Good evening' is for…", ["after 5 p.m.", "before 12"], 0, "Evening is after about 5 p.m.")])

NUMBERS = lesson(
    "I can count to ten.", "Numbers help us say how many.", "I have two brothers.",
    [word("v-one", "one", "/wʌn/", "I have one cat."), word("v-two", "two", "/tuː/", "Two coffees, please."),
     word("v-three", "three", "/θriː/", "Three apples.")],
    [listen(f"n{i}", t, opts, f"The speaker says '{t}'.") if i % 3 == 1 else
     mc(f"n{i}", f"What number is {d}?", opts, opts.index(t), f"{d} is '{t}'.")
     for i, (d, t, opts) in enumerate([(1, "one", ["one", "two"]), (2, "two", ["two", "ten"]), (3, "three", ["three", "tree"]),
                                        (4, "four", ["four", "for"]), (5, "five", ["five", "fine"]), (6, "six", ["six", "sit"]),
                                        (7, "seven", ["seven", "eleven"]), (8, "eight", ["eight", "ate"])], start=1)])

DAILY = lesson(
    "I can talk about my daily routine.", "Use the present simple for things you do every day.", "I get up at 7. She works in a shop.",
    [word("v-work", "work", "/wɜːk/", "I work in a hospital."), word("v-every-day", "every day", "/ˈevri deɪ/", "I study every day.")],
    [fill("d1", "She ___ in a bank. (work)", ["works"], "With he/she/it we add -s."),
     mc("d2", "Choose the correct sentence.", ["He gets up at 7.", "He get up at 7."], 0, "He/she/it + verb-s.", "grammar"),
     listen("d3", "I go to work by bus", ["I go to work by bus", "I go to work by car"], "The speaker goes by bus."),
     fill("d4", "I ___ breakfast at 8. (have)", ["have"], "With 'I' there is no -s."),
     mc("d5", "Which word means 'on all days'?", ["every day", "yesterday"], 0, "'Every day' = on all days."),
     mc("d6", "Where does a teacher work?", ["at a school", "at a bus"], 0, "Teachers work at schools.", "reading"),
     fill("d7", "They ___ TV in the evening. (watch)", ["watch"], "With 'they' there is no -s."),
     listen("d8", "What time do you finish work", ["What time do you finish work", "What time do you start work"], "The speaker asks about finishing.")])

SHOPPING = lesson(
    "I can buy things in a shop.", "Use 'How much…?' to ask prices and 'I'd like…' to ask for things.", "How much is this? — It's 10 dirhams.",
    [word("v-price", "price", "/praɪs/", "What's the price?"), word("v-cheap", "cheap", "/tʃiːp/", "This shirt is cheap.")],
    [mc("s1", "Ask the price:", ["How much is it?", "How many is it?"], 0, "We use 'How much' for prices.", "grammar"),
     listen("s2", "I'd like a coffee, please", ["I'd like a coffee, please", "I like coffee"], "The speaker orders a coffee."),
     fill("s3", "These shoes ___ very expensive.", ["are", "'re"], "Plural 'shoes' takes 'are'."),
     mc("s4", "The opposite of 'expensive' is…", ["cheap", "big"], 0, "'Cheap' costs little."),
     mc("s5", "Yesterday I ___ a new phone.", ["bought", "buy"], 0, "The past of 'buy' is 'bought'.", "grammar"),
     fill("s6", "Can I pay ___ card?", ["by"], "We pay 'by card' or 'in cash'."),
     listen("s7", "That's twenty dirhams", ["That's twenty dirhams", "That's twelve dirhams"], "The price is twenty."),
     mc("s8", "Where do you buy medicine?", ["at a pharmacy", "at a bakery"], 0, "Medicine is sold at a pharmacy.", "reading")])

# Placement questions: one per skill and level, plus a second grammar item.
PLACEMENT = {
    "PreA1": [mc("p0-1", "Which is a greeting?", ["Hello", "Chair"], 0, "x", "vocabulary"),
              listen("p0-2", "Good morning", ["Good morning", "Good night"], "x"),
              mc("p0-3", "Read: 'I am Ali.' What is his name?", ["Ali", "Sam"], 0, "x", "reading"),
              fill("p0-4", "I ___ a student.", ["am", "'m"], "x"),
              mc("p0-5", "What number comes after two?", ["three", "one"], 0, "x", "vocabulary")],
    "A1": [fill("p1-1", "She ___ in a bank. (work)", ["works"], "x"),
           mc("p1-2", "Where do you buy bread?", ["bakery", "library"], 0, "x", "vocabulary"),
           listen("p1-3", "I get up at seven", ["I get up at seven", "I get up at eleven"], "x"),
           mc("p1-4", "Read: 'Tom has two sisters and no brothers.' How many brothers?", ["none", "two"], 0, "x", "reading"),
           mc("p1-5", "___ you like coffee?", ["Do", "Does"], 0, "x", "grammar")],
    "A2": [mc("p2-1", "Yesterday I ___ to the market.", ["went", "go"], 0, "x", "grammar"),
           mc("p2-2", "The opposite of 'expensive' is…", ["cheap", "heavy"], 0, "x", "vocabulary"),
           listen("p2-3", "Turn left at the bank", ["Turn left at the bank", "Turn right at the bank"], "x"),
           mc("p2-4", "Read: 'The shop opens at 9 but closes early on Fridays.' When is it open late?", ["not on Fridays", "only on Fridays"], 0, "x", "reading"),
           fill("p2-5", "I have lived here ___ 2019.", ["since"], "x")],
}


def main():
    token = http("POST", "/connect/token", form={
        "grant_type": "password", "client_id": "englishpath-web", "username": "admin@englishpath.local",
        "password": "local-admin-password", "scope": "openid roles api"})["access_token"]

    def publish(unit, order, title, content, kind="Lesson"):
        lid = http("POST", "/api/v1/learning/admin/lessons", token, {"unitId": unit, "order": order, "title": title, "content": content, "kind": kind})
        http("POST", f"/api/v1/learning/admin/lessons/{lid}/submit", token)
        http("POST", f"/api/v1/learning/admin/lessons/{lid}/publish", token)
        print(f"  published {kind.lower()}: {title}")

    course = [
        ("PreA1", 0, "Hello!", [("Greetings", GREETINGS), ("Introductions", INTRODUCTIONS)], ("Checkpoint: Hello!", CHECKPOINT)),
        ("PreA1", 1, "Numbers", [("One to ten", NUMBERS)], None),
        ("A1", 0, "My day", [("Daily routines", DAILY)], None),
        ("A2", 0, "Shopping", [("At the shops", SHOPPING)], None),
    ]
    for level, order, title, lessons, checkpoint in course:
        unit = http("POST", "/api/v1/learning/admin/units", token, {"level": level, "order": order, "title": title})
        print(f"unit {level} {title}")
        for i, (lesson_title, content) in enumerate(lessons):
            publish(unit, i, lesson_title, content)
        if checkpoint:
            publish(unit, 99, checkpoint[0], checkpoint[1], "Checkpoint")

    for level, items in PLACEMENT.items():
        for item in items:
            http("POST", "/api/v1/learning/admin/placement-items", token, {"level": level, "exercise": item})
        print(f"placement items {level}: {len(items)}")


if __name__ == "__main__":
    main()
