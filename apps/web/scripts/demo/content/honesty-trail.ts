import { rating, type ModuleDef } from "./types";

// Journey: Honesty Trail. Scripts, questions and weights are original; the clip is a stand-in (see clips.ts).

export const HONEST_WOODCUTTER: ModuleDef = {
  slug: "honest-woodcutter",
  title: "The Honest Woodcutter",
  sourceStory: "The Honest Woodcutter (Aesop's Fables / Indian folk tale)",
  clip: "bbb-mp4",
  primary: "honesty",
  secondary: ["compassion", "courage"],
  ageBand: "10-12",
  learningObjective: "I can tell the truth even when a lie would be easier or would give me something.",
  script:
    "A poor woodcutter's axe slips into the river. He sits on the bank, sad: it is the only axe he has. A kind river fairy rises up and holds out a golden axe. 'Is this yours?' " +
    "'No,' says the woodcutter. She shows a silver axe. 'No,' he says again. Then she shows his old iron axe. 'Yes, that one is mine!' The fairy smiles and gives him all three axes. " +
    "His neighbour hears about it and tries to trick the fairy, but she can tell what is true, and he goes home with nothing.",
  discussionPrompts: [
    "Why do you think the woodcutter told the truth about the iron axe?",
    "Have you ever been tempted to say something that was not true? What happened?",
    "How does it feel when someone tells you the truth, even if it is hard to hear?",
  ],
  followUp: "Play 'Two Truths': at dinner, each person shares one true thing about their day that they were a little shy to say.",
  questions: [
    {
      at: 0.12,
      style: "EMOTION",
      question: "The fairy holds out a shiny golden axe. The woodcutter knows it is not his. How would YOU feel?",
      options: [
        { tone: "poor", text: "🤩 Excited. I would want to take it!", w: { honesty: -2, compassion: -1 } },
        { tone: "neutral", text: "😶 Confused. I am not sure what to do." },
        { tone: "good", text: "😌 Tempted, but sure it is not mine.", w: { honesty: 2, compassion: 1 } },
      ],
    },
    {
      at: 0.32,
      style: "SITUATIONAL",
      question: "You break a classroom window by accident, and nobody saw it happen. What would YOU do?",
      options: [
        { tone: "good", text: "Tell the teacher what happened.", w: { honesty: 2, compassion: 1 } },
        { tone: "neutral", text: "Wait and see if someone asks." },
        { tone: "poor", text: "Say nothing and hope nobody finds out.", w: { honesty: -2, courage: -1 } },
      ],
    },
    {
      at: 0.52,
      style: "MORAL_CHOICE",
      question: "The fairy asks, \"Is this golden axe yours?\" What should the woodcutter say?",
      options: [
        { tone: "neutral", text: "\"I am not sure.\"" },
        { tone: "poor", text: "\"Yes, it is mine.\"", w: { honesty: -2, courage: -1 } },
        { tone: "good", text: "\"No. My axe is the old iron one.\"", w: { honesty: 2, compassion: 1 } },
      ],
    },
    {
      at: 0.74,
      style: "PREDICT",
      question: "The neighbour hears the story and tries to trick the fairy. What do you think will happen?",
      options: [
        { tone: "good", text: "The fairy can tell what is true, and the neighbour gets nothing.", w: { honesty: 2, compassion: 1 } },
        { tone: "poor", text: "The neighbour gets rich, so tricks work.", w: { honesty: -1, compassion: -1 } },
        { tone: "neutral", text: "Nothing. The fairy has gone away." },
      ],
    },
    {
      at: 0.92,
      style: "RATING",
      question: "I tell the truth even when I might get into trouble.",
      options: rating([
        { honesty: -2, compassion: -1 },
        { honesty: -1, courage: -1 },
        { honesty: 1, compassion: 1 },
        { honesty: 2, courage: 1 },
      ]),
    },
  ],
};

export const BOY_WHO_CRIED_WOLF: ModuleDef = {
  slug: "boy-who-cried-wolf",
  title: "The Boy Who Cried Wolf",
  sourceStory: "The Boy Who Cried Wolf (Aesop's Fables)",
  clip: "bbb-webm",
  primary: "responsibility",
  secondary: ["compassion", "honesty"],
  ageBand: "8-9",
  learningObjective: "I can do my job carefully, and I know that my words and actions affect other people.",
  script:
    "A shepherd boy watches the village sheep on the hill. It is a long, quiet day and he is bored. 'Wolf! Wolf!' he shouts as a joke, and the villagers run up the hill, tired and out of breath. " +
    "There is no wolf. The boy laughs. He does it again the next day. Then one evening a real wolf comes. He shouts and shouts, but nobody comes. The sheep scatter. " +
    "The boy walks down the hill and says sorry to the villagers, and begins the slow work of earning their trust again.",
  discussionPrompts: [
    "What was the boy's job? What happened when he did not do it carefully?",
    "How did the villagers feel when they ran up the hill? How do you know?",
    "How can we win back someone's trust after we make a mistake?",
  ],
  followUp: "Make a 'promise jar': each person writes one small promise on a slip, does it, and drops the slip in the jar when it is done.",
  questions: [
    {
      at: 0.1,
      style: "MORAL_CHOICE",
      question: "The shepherd boy is bored while watching the sheep. What should he do?",
      options: [
        { tone: "poor", text: "Shout \"Wolf!\" to make the villagers run.", w: { responsibility: -2, honesty: -1 } },
        { tone: "neutral", text: "Count the sheep and sing a song." },
        { tone: "good", text: "Watch the sheep carefully. It is his job.", w: { responsibility: 2, compassion: 1 } },
      ],
    },
    {
      at: 0.28,
      style: "EMOTION",
      question: "The villagers climb the hill and find no wolf. They are tired. How should the boy feel?",
      options: [
        { tone: "neutral", text: "😐 Nothing much." },
        { tone: "good", text: "😔 Sorry. I want to say sorry and do better.", w: { responsibility: 2, compassion: 1 } },
        { tone: "poor", text: "😄 Happy. It was funny.", w: { responsibility: -2, honesty: -1 } },
      ],
    },
    {
      at: 0.5,
      style: "SITUATIONAL",
      question: "You promised to feed your pet every day, but today you want to watch TV. What would YOU do?",
      options: [
        { tone: "poor", text: "Ask someone else to do it.", w: { responsibility: -2, compassion: -1 } },
        { tone: "neutral", text: "Feed it later, after my show." },
        { tone: "good", text: "Feed my pet first, then watch TV.", w: { responsibility: 2, compassion: 1 } },
      ],
    },
    {
      at: 0.72,
      style: "PREDICT",
      question: "A real wolf comes and the boy shouts for help. What will the villagers do?",
      options: [
        { tone: "neutral", text: "They will hurry to help." },
        { tone: "good", text: "They may not believe him. Trust is hard to win back.", w: { responsibility: 2, compassion: 1 } },
        { tone: "poor", text: "They will always come, whatever he does.", w: { responsibility: -1, honesty: -1 } },
      ],
    },
    {
      at: 0.92,
      style: "RATING",
      question: "When I say I will do something, I do it.",
      options: rating([{ responsibility: -2, compassion: -1 }, { responsibility: -1 }, { responsibility: 1 }, { responsibility: 2, compassion: 1 }]),
    },
  ],
};

export const PIGEONS_AND_THE_NET: ModuleDef = {
  slug: "pigeons-and-the-net",
  title: "The Pigeons and the Net",
  sourceStory: "The Pigeons and the Net (Panchatantra)",
  clip: "bbb-mp4",
  primary: "loyalty",
  secondary: ["compassion", "friendship"],
  ageBand: "10-12",
  learningObjective: "I can stay with my friends and family when things get hard, and be glad of their help.",
  script:
    "A flock of pigeons lands to eat grain scattered on the ground, and a net falls over them. They flap and cannot get out. Some want to fly off alone. " +
    "The leader says, 'If we all fly up at the same moment, the net will come with us.' They rise together, carrying the net, all the way to their friend Mouse. " +
    "Mouse gnaws every rope, starting with the leader's, and not stopping until the last pigeon is free.",
  discussionPrompts: [
    "Why was the flock stronger together than each pigeon alone?",
    "What would it have been like to be a pigeon who wanted to fly away alone?",
    "Who stays with you when things are hard? How could you stay with them?",
  ],
  followUp: "Write a short thank-you card to a friend or family member who has stayed with you through something hard, and give it to them.",
  questions: [
    {
      at: 0.12,
      style: "MORAL_CHOICE",
      question: "The pigeons are stuck in a net. The leader says, \"Let's fly up together.\" Some pigeons want to fly away alone. What should a pigeon do?",
      options: [
        { tone: "neutral", text: "Wait and see what the others do." },
        { tone: "good", text: "Stay with the flock and fly up together.", w: { loyalty: 2, compassion: 1 } },
        { tone: "poor", text: "Fly away alone if I can.", w: { loyalty: -2, friendship: -1 } },
      ],
    },
    {
      at: 0.3,
      style: "EMOTION",
      question: "The net is heavy and the pigeons are scared. Pick the feeling closest to yours if you were one of them.",
      options: [
        { tone: "poor", text: "😠 Cross with the others for being slow.", w: { loyalty: -2, compassion: -1 } },
        { tone: "neutral", text: "😟 Scared and quiet." },
        { tone: "good", text: "🤗 Scared, but glad to have my flock.", w: { loyalty: 2, friendship: 1 } },
      ],
    },
    {
      at: 0.5,
      style: "PREDICT",
      question: "What will happen when all the pigeons flap their wings at the same time?",
      options: [
        { tone: "good", text: "Together they are strong enough to lift the net.", w: { loyalty: 2, compassion: 1 } },
        { tone: "poor", text: "One strong pigeon will lift it. The rest do not matter.", w: { loyalty: -1, friendship: -1 } },
        { tone: "neutral", text: "Maybe they will lift it a little." },
      ],
    },
    {
      at: 0.72,
      style: "SITUATIONAL",
      question: "A friend in your class makes a mistake and some kids laugh. What would YOU do?",
      options: [
        { tone: "poor", text: "Laugh along so they do not tease me.", w: { loyalty: -2, compassion: -1 } },
        { tone: "good", text: "Stay next to my friend and help.", w: { loyalty: 2, friendship: 1 } },
        { tone: "neutral", text: "Stay quiet and walk away." },
      ],
    },
    {
      at: 0.9,
      style: "RATING",
      question: "I stay with my friends and family when things get hard.",
      options: rating([
        { loyalty: -2, compassion: -1 },
        { loyalty: -1, friendship: -1 },
        { loyalty: 1, compassion: 1 },
        { loyalty: 2, friendship: 1 },
      ]),
    },
  ],
};
