import { Lesson } from "@englishpath/core";
import { DEMO_LESSON_ID } from "./ids";

export { DEMO_LESSON_ID };

/**
 * Pre-A1 demo lesson used when the API is unavailable (local UI development, FR-03 guest
 * preview). Audio URLs are placeholders; the player falls back to the browser's speech
 * synthesis using each asset's transcript.
 */
const audio = (id: string, text: string) => ({ assetId: id, url: `https://cdn.englishpath.invalid/audio/${id}.m4a`, text });

export const demoLesson: Lesson = Lesson.parse({
  id: DEMO_LESSON_ID,
  unitId: "prea1-u1",
  version: 1,
  title: "Hello!",
  objective: "I can say hello and goodbye.",
  grammarPoint: "Greetings and 'I am'",
  intro: {
    concept: "We say hello when we meet someone and goodbye when we leave.",
    example: "Hello! I am Sara. — Goodbye! See you tomorrow.",
  },
  vocabulary: [
    { id: "v-hello", word: "hello", ipa: "/həˈləʊ/", example: "Hello, Tom!" },
    { id: "v-goodbye", word: "goodbye", ipa: "/ɡʊdˈbaɪ/", example: "Goodbye, see you later." },
    { id: "v-morning", word: "morning", ipa: "/ˈmɔːnɪŋ/", example: "Good morning!" },
  ],
  exercises: [
    {
      id: "ex1", type: "multipleChoice", prompt: "You meet a friend. What do you say?",
      options: ["Hello!", "Goodbye!", "Good night!"], correctIndex: 0,
      explanation: "We say 'Hello!' when we meet someone.", skills: ["vocabulary"],
    },
    {
      id: "ex2", type: "listenSelect", prompt: "What do you hear?", audio: audio("good-morning", "Good morning"),
      options: ["Good evening", "Good morning", "Good night"], correctIndex: 1,
      explanation: "The speaker says 'Good morning'. We use it before 12 o'clock.", skills: ["listening"],
    },
    {
      id: "ex3", type: "fillBlank", prompt: "Complete the sentence.", sentence: "Hello! I ___ Sara.",
      acceptedAnswers: ["am", "'m"], explanation: "With 'I' we use 'am': I am Sara.", skills: ["grammar"],
    },
    {
      id: "ex4", type: "matchPairs", prompt: "Match the greeting to the time.",
      pairs: [["Good morning", "08:00"], ["Good afternoon", "15:00"], ["Good evening", "19:00"]],
      explanation: "Morning is before 12, afternoon is 12–5, evening is after 5.", skills: ["vocabulary"],
    },
    {
      id: "ex5", type: "reorderWords", prompt: "Put the words in order.", words: ["See", "you", "tomorrow"],
      explanation: "'See you tomorrow' is a friendly way to say goodbye.", skills: ["grammar"],
    },
    {
      id: "ex6", type: "dictation", prompt: "Type what you hear.", audio: audio("goodbye", "Goodbye"),
      acceptedAnswers: ["Goodbye", "Good bye", "Good-bye"], explanation: "The word is 'goodbye'.", skills: ["listening", "writing"],
    },
    {
      id: "ex7", type: "multipleChoice", prompt: "You leave work. What do you say?",
      options: ["Good morning!", "Hello!", "Goodbye!"], correctIndex: 2,
      explanation: "We say 'Goodbye!' when we leave.", skills: ["vocabulary"],
    },
    {
      id: "ex8", type: "fillBlank", prompt: "Complete the greeting.", sentence: "Good ___! (at 9 a.m.)",
      acceptedAnswers: ["morning"], explanation: "At 9 a.m. we say 'Good morning'.", skills: ["vocabulary"],
    },
  ],
});
