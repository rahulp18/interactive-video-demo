import { rating, type ModuleDef } from "./types";

// Journey: Kindness & Friends. Scripts, questions and weights are original; the clip is a stand-in (see clips.ts).

export const INJURED_SWAN: ModuleDef = {
  slug: "injured-swan",
  title: "The Injured Swan",
  sourceStory: "The Injured Swan (Jataka tales)",
  clip: "bbb-webm",
  primary: "compassion",
  secondary: ["friendship", "faith"],
  ageBand: "10-12",
  learningObjective: "I can notice when someone is hurting and choose to care for them gently.",
  script:
    "A young prince finds a swan that cannot fly: its wing is hurt. He picks it up gently, washes the wing and feeds it water. His cousin arrives. 'That swan is mine. I found it first!' " +
    "The two argue and ask the village elders to decide. The elders ask, 'Who has kept the swan safe? Who wants it to live?' They say the swan belongs to the one who cares for it. " +
    "Soon the swan's wing heals and it flies up into the sky. It is free, and everyone watches it go with hope.",
  discussionPrompts: [
    "How did the prince know the swan needed help?",
    "How do you think the swan felt when it was cared for?",
    "Who is someone who might need your kindness this week?",
  ],
  followUp: "Do one small, quiet act of kindness for someone this week (a note, a shared snack, helping with a chore) and notice how it feels.",
  questions: [
    {
      at: 0.1,
      style: "EMOTION",
      question: "The prince finds a swan that cannot fly. Pick the feeling closest to how YOU would feel.",
      options: [
        { tone: "good", text: "💛 Gentle and caring. I want to help.", w: { compassion: 2, friendship: 1 } },
        { tone: "poor", text: "😞 It is hopeless, so I will walk on.", w: { compassion: -2, faith: -1 } },
        { tone: "neutral", text: "🤔 Unsure what to do." },
      ],
    },
    {
      at: 0.3,
      style: "MORAL_CHOICE",
      question: "The prince's cousin says, \"The swan is mine. I found it first!\" What should the prince do?",
      options: [
        { tone: "poor", text: "Grab the swan and run.", w: { compassion: -1, friendship: -1 } },
        { tone: "neutral", text: "Let his cousin take the swan." },
        { tone: "good", text: "Say, \"Let's care for it together until it can fly.\"", w: { compassion: 2, friendship: 1 } },
      ],
    },
    {
      at: 0.5,
      style: "SITUATIONAL",
      question: "You find a bird with a hurt wing in your school yard. What would YOU do?",
      options: [
        { tone: "neutral", text: "Look at it, then leave it for someone else." },
        { tone: "good", text: "Tell a teacher and help care for it gently.", w: { compassion: 2, friendship: 1 } },
        { tone: "poor", text: "Leave it. It will not get better anyway.", w: { compassion: -2, faith: -1 } },
      ],
    },
    {
      at: 0.72,
      style: "PREDICT",
      question: "The elders listen to both cousins. Who do you think the swan belongs to?",
      options: [
        { tone: "good", text: "The one who cares for it and keeps it safe.", w: { compassion: 2, friendship: 1 } },
        { tone: "neutral", text: "The one who found it first." },
        { tone: "poor", text: "The one who is the strongest.", w: { compassion: -1, friendship: -1 } },
      ],
    },
    {
      at: 0.92,
      style: "RATING",
      question: "When someone is hurting, I try to help, and I hope things will get better.",
      options: rating([
        { compassion: -2, friendship: -1 },
        { compassion: -1, faith: -1 },
        { compassion: 1, friendship: 1 },
        { compassion: 2, faith: 1 },
      ]),
    },
  ],
};

export const DOVE_AND_THE_ANT: ModuleDef = {
  slug: "dove-and-the-ant",
  title: "The Dove and the Ant",
  sourceStory: "The Dove and the Ant (Aesop's Fables)",
  clip: "bbb-mp4",
  primary: "friendship",
  secondary: ["compassion", "loyalty"],
  ageBand: "8-9",
  learningObjective: "I can be a good friend by noticing when others need help and helping them.",
  script:
    "A little ant slips into a stream and cannot climb out. A dove, sitting in a tree, sees her. She drops a leaf into the water, and the ant climbs on and floats safely to the bank. " +
    "Days later the ant sees a hunter spreading a net beneath the dove's tree. The ant bites his foot. 'Ouch!' he cries and the dove hears, and flies up and away. The two friends are safe.",
  discussionPrompts: [
    "How did Dove help Ant? How did Ant help Dove?",
    "Can a small friend help a big friend? How?",
    "How can you tell when a friend needs help?",
  ],
  followUp: "Each day this week, do one small thing for a friend: a smile, a shared pencil, or a kind word. Keep a tally.",
  questions: [
    {
      at: 0.1,
      style: "EMOTION",
      question: "Ant falls into the stream and cannot climb out. Dove is watching from a tree. Pick the feeling that is closest to how YOU would feel.",
      options: [
        { tone: "neutral", text: "😐 Surprised. I am just watching." },
        { tone: "good", text: "🥺 Worried. I want to help Ant.", w: { friendship: 2, compassion: 1 } },
        { tone: "poor", text: "😏 Amused. It looks funny.", w: { friendship: -1, compassion: -1 } },
      ],
    },
    {
      at: 0.3,
      style: "MORAL_CHOICE",
      question: "Days later, Ant sees a hunter spreading a net under Dove's tree. What should Ant do?",
      options: [
        { tone: "poor", text: "Hide. This is not Ant's problem.", w: { friendship: -2, loyalty: -1 } },
        { tone: "good", text: "Bite the hunter's foot so that Dove can fly away.", w: { friendship: 2, compassion: 1 } },
        { tone: "neutral", text: "Run to find help." },
      ],
    },
    {
      at: 0.5,
      style: "SITUATIONAL",
      question: "Your friend is sitting alone at lunch, and you were going to sit with a new group. What would YOU do?",
      options: [
        { tone: "good", text: "Sit with my friend and invite them to join us.", w: { friendship: 2, compassion: 1 } },
        { tone: "neutral", text: "Say hi, then sit with the group." },
        { tone: "poor", text: "Sit with the group and say nothing.", w: { friendship: -2, loyalty: -1 } },
      ],
    },
    {
      at: 0.72,
      style: "PREDICT",
      question: "After Ant and Dove have helped each other, what will happen to their friendship?",
      options: [
        { tone: "neutral", text: "Nothing will change." },
        { tone: "poor", text: "They will say \"we are even\" and stop being friends.", w: { friendship: -1, loyalty: -1 } },
        { tone: "good", text: "It will grow stronger, because each helped when it counted.", w: { friendship: 2, compassion: 1 } },
      ],
    },
    {
      at: 0.92,
      style: "RATING",
      question: "I notice when a friend needs help, and I help.",
      options: rating([{ friendship: -2, compassion: -1 }, { friendship: -1 }, { friendship: 1 }, { friendship: 2, compassion: 1 }]),
    },
  ],
};

// In progress for the live demo: the demo student has started this module and answered the first questions.
export const LITTLE_MANGO_SEED: ModuleDef = {
  slug: "little-mango-seed",
  title: "The Little Mango Seed",
  sourceStory: "The Little Mango Seed (Indian folk tale)",
  clip: "bbb-webm",
  primary: "faith",
  secondary: ["perseverance", "compassion"],
  ageBand: "8-9",
  learningObjective: "I can hope, say thank you for what the world gives me, and care for living things.",
  script:
    "It is a dry year and the fields are cracked. A girl plants a mango seed beside her house. 'It will never grow!' say the neighbours. She waters it every day from a small clay pot " +
    "and says, 'I will look after you, little seed.' Weeks pass. One evening, clouds roll in, and the rain finally falls. The girl thanks the rain, the soil and the sun. " +
    "Years later the tree is tall and full of mangoes, and she shares them with the whole village.",
  discussionPrompts: [
    "What helped the girl keep hoping while the land was dry?",
    "What are some things in the world that you feel thankful for?",
    "How can we show care for the plants and animals around us?",
  ],
  followUp: "Plant a seed or a small plant together, water it every day, and each evening say one thing you are thankful for.",
  questions: [
    {
      at: 0.12,
      style: "EMOTION",
      question: "The land is dry, but a girl plants a mango seed anyway. Pick the feeling closest to hers.",
      options: [
        { tone: "good", text: "🌱 Hopeful. Something good may grow.", w: { faith: 2, perseverance: 1 } },
        { tone: "neutral", text: "😐 Not sure." },
        { tone: "poor", text: "😞 It will never grow.", w: { faith: -2, compassion: -1 } },
      ],
    },
    {
      at: 0.3,
      style: "MORAL_CHOICE",
      question: "The neighbours laugh and say, \"It will never grow!\" What should the girl do?",
      options: [
        { tone: "neutral", text: "Water it only sometimes." },
        { tone: "poor", text: "Dig it up so they stop talking.", w: { faith: -2, perseverance: -1 } },
        { tone: "good", text: "Keep caring for the seed, and stay hopeful.", w: { faith: 2, perseverance: 1 } },
      ],
    },
    {
      at: 0.5,
      style: "SITUATIONAL",
      question: "At last the rain comes. What would YOU do?",
      options: [
        { tone: "good", text: "Say thank you to the rain, the soil and the sun.", w: { faith: 2, compassion: 1 } },
        { tone: "poor", text: "Not notice it. It is just rain.", w: { faith: -1, compassion: -1 } },
        { tone: "neutral", text: "Run inside." },
      ],
    },
    {
      at: 0.72,
      style: "PREDICT",
      question: "Years later the tree is full of mangoes. What will the girl do?",
      options: [
        { tone: "neutral", text: "Sell them at the market." },
        { tone: "poor", text: "Forget how it all began.", w: { faith: -1, perseverance: -1 } },
        { tone: "good", text: "Share the fruit with her neighbours and thank the tree.", w: { faith: 2, compassion: 1 } },
      ],
    },
    {
      at: 0.92,
      style: "RATING",
      question: "I feel thankful for the world around me, and I hope good things will come.",
      options: rating([
        { faith: -2, compassion: -1 },
        { faith: -1, perseverance: -1 },
        { faith: 1 },
        { faith: 2, perseverance: 1 },
      ]),
    },
  ],
};
