/**
 * Starter JSON for each of the 7 MVP exercise types (FR-22), inserted by the lesson editor's
 * "Insert exercise" toolbar so authors don't have to memorise the shape by hand.
 */

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

const audioPlaceholder = () => ({
  assetId: "replace-with-media-id",
  url: "https://cdn.example.com/replace-with-audio-url.m4a",
  text: "Replace with the exact words spoken",
});

const imagePlaceholder = () => ({
  assetId: "replace-with-media-id",
  url: "https://cdn.example.com/replace-with-image-url.webp",
  text: "Describe the image for screen readers",
});

export const EXERCISE_TEMPLATES: Record<string, { label: string; make: () => Record<string, unknown> }> = {
  multipleChoice: {
    label: "Multiple choice",
    make: () => ({
      id: newId("mc"),
      type: "multipleChoice",
      prompt: "Choose the correct answer.",
      options: ["Option A", "Option B"],
      correctIndex: 0,
      explanation: "Explain why the correct option is right.",
      skills: ["vocabulary"],
    }),
  },
  listenSelect: {
    label: "Listen & select",
    make: () => ({
      id: newId("ls"),
      type: "listenSelect",
      prompt: "What do you hear?",
      audio: audioPlaceholder(),
      options: ["Option A", "Option B"],
      correctIndex: 0,
      explanation: "Explain the correct answer.",
      skills: ["listening"],
    }),
  },
  imageWord: {
    label: "Image & word",
    make: () => ({
      id: newId("iw"),
      type: "imageWord",
      prompt: "Which word matches the picture?",
      choices: [
        { word: "apple", image: imagePlaceholder() },
        { word: "pear", image: imagePlaceholder() },
      ],
      correctIndex: 0,
      explanation: "Explain the correct answer.",
      skills: ["vocabulary"],
    }),
  },
  fillBlank: {
    label: "Fill in the blank",
    make: () => ({
      id: newId("fb"),
      type: "fillBlank",
      prompt: "Complete the sentence.",
      sentence: "She ___ to work every day.",
      acceptedAnswers: ["goes"],
      explanation: "Explain the grammar rule.",
      skills: ["grammar"],
    }),
  },
  dictation: {
    label: "Dictation",
    make: () => ({
      id: newId("dc"),
      type: "dictation",
      prompt: "Type what you hear.",
      audio: audioPlaceholder(),
      acceptedAnswers: ["the exact words"],
      explanation: "Explain the correct answer.",
      skills: ["listening", "writing"],
    }),
  },
  matchPairs: {
    label: "Match pairs",
    make: () => ({
      id: newId("mp"),
      type: "matchPairs",
      prompt: "Match the pairs.",
      pairs: [
        ["cat", "gato"],
        ["dog", "perro"],
      ],
      explanation: "Explain the pairing.",
      skills: ["vocabulary"],
    }),
  },
  reorderWords: {
    label: "Reorder words",
    make: () => ({
      id: newId("rw"),
      type: "reorderWords",
      prompt: "Put the words in order.",
      words: ["I", "am", "happy"],
      explanation: "Explain the correct word order.",
      skills: ["grammar"],
    }),
  },
};

export const EMPTY_LESSON_CONTENT = {
  objective: "I can ...",
  intro: { concept: "Explain the concept in simple words.", example: "Give an example sentence." },
  vocabulary: [],
  exercises: [],
};
