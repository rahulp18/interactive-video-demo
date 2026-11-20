import { rating, type ModuleDef } from "./types";

// Journey: Perseverance Path. Scripts, questions and weights are original; the clip is a stand-in (see clips.ts).

export const TORTOISE_AND_THE_HARE: ModuleDef = {
  slug: "tortoise-and-the-hare",
  title: "The Tortoise and the Hare",
  sourceStory: "The Tortoise and the Hare (Aesop's Fables)",
  clip: "bbb-mp4",
  primary: "perseverance",
  secondary: ["self-discipline", "work"],
  ageBand: "8-9",
  learningObjective: "I can keep going step by step, even when something is hard and others are faster.",
  script:
    "Hare laughs at slow Tortoise. 'Let's race!' he says. Tortoise says yes. At the start Hare zooms away. Tortoise walks, one slow step after another. " +
    "Hare is so far ahead that he lies down under a tree for a nap. Tortoise passes him, quietly. When Hare wakes up, Tortoise is almost at the finish line.",
  discussionPrompts: [
    "When was something hard for you? What helped you keep going?",
    "Why do you think Hare stopped trying so hard?",
    "What is something you would like to get better at, one small step at a time?",
  ],
  followUp: "Pick one small thing to practise for five minutes a day this week (a song, a drawing, reading aloud). Colour in a box each day you try.",
  questions: [
    {
      at: 0.12,
      style: "EMOTION",
      question: "Everyone laughs at Tortoise before the race. Pick the face that is closest to how YOU would feel.",
      options: [
        { tone: "good", text: "😤 Determined. I will do my best.", w: { perseverance: 2, "self-discipline": 1 } },
        { tone: "neutral", text: "😐 Not sure. I will wait and see." },
        { tone: "poor", text: "😞 So sad that I want to go home.", w: { perseverance: -2, "self-discipline": -1 } },
      ],
    },
    {
      at: 0.32,
      style: "MORAL_CHOICE",
      question: "Hare is far ahead and Tortoise is very tired. What should Tortoise do?",
      options: [
        { tone: "poor", text: "Stop. The race is already lost.", w: { perseverance: -2, "self-discipline": -1 } },
        { tone: "good", text: "Keep walking, one slow step at a time.", w: { perseverance: 2, work: 1 } },
        { tone: "neutral", text: "Rest a little, then decide." },
      ],
    },
    {
      at: 0.52,
      style: "SITUATIONAL",
      question: "You are doing a big puzzle and it is very hard. What would YOU do?",
      options: [
        { tone: "neutral", text: "Ask someone else to finish it." },
        { tone: "good", text: "Keep trying, and take small breaks.", w: { perseverance: 2, work: 1 } },
        { tone: "poor", text: "Put it back in the box and do something easy.", w: { perseverance: -1, work: -1 } },
      ],
    },
    {
      at: 0.74,
      style: "PREDICT",
      question: "Hare is sleeping under a tree. Tortoise is still walking. What do you think will happen?",
      options: [
        { tone: "poor", text: "Fast runners always win, so Hare will win.", w: { perseverance: -1, work: -1 } },
        { tone: "neutral", text: "It could go either way." },
        { tone: "good", text: "Slow and steady Tortoise will get there first.", w: { perseverance: 2, "self-discipline": 1 } },
      ],
    },
    {
      at: 0.92,
      style: "RATING",
      question: "When something is hard, I keep trying until I finish.",
      options: rating([
        { perseverance: -2, "self-discipline": -1 },
        { perseverance: -1 },
        { perseverance: 1 },
        { perseverance: 2, "self-discipline": 1 },
      ]),
    },
  ],
};

export const ANT_AND_THE_GRASSHOPPER: ModuleDef = {
  slug: "ant-and-the-grasshopper",
  title: "The Ant and the Grasshopper",
  sourceStory: "The Ant and the Grasshopper (Aesop's Fables)",
  clip: "bbb-webm",
  primary: "work",
  secondary: ["compassion", "perseverance"],
  ageBand: "8-9",
  learningObjective: "I can do my share of the work, and I can help others when they are in need.",
  script:
    "All summer Ant carries seeds and leaves home. Grasshopper sings and plays and says, 'Come and play!' Ant says, 'I must get ready for winter.' " +
    "Winter comes. It is cold. Grasshopper has no food and knocks on Ant's door. This time Ant shares, and Grasshopper promises to help next year.",
  discussionPrompts: [
    "What is a job you do at home or school? How do you feel when it is done?",
    "How did Ant help Grasshopper? What did Grasshopper learn?",
    "When is it good to play, and when is it time to work?",
  ],
  followUp: "Choose one family job (setting the table, watering plants) and do it every day this week, without being asked.",
  questions: [
    {
      at: 0.1,
      style: "EMOTION",
      question: "All summer Ant works hard while Grasshopper plays. If you were Ant, how would you feel?",
      options: [
        { tone: "good", text: "😊 Proud. My work will help me later.", w: { work: 2, compassion: 1 } },
        { tone: "neutral", text: "😐 A little tired, but okay." },
        { tone: "poor", text: "😒 Cross. It is not fair to me!", w: { work: -1, perseverance: -1 } },
      ],
    },
    {
      at: 0.3,
      style: "MORAL_CHOICE",
      question: "Winter comes. Grasshopper is cold and hungry and knocks on Ant's door. What should Ant do?",
      options: [
        { tone: "neutral", text: "Say sorry and close the door." },
        { tone: "poor", text: "Laugh and say, \"You should have worked!\"", w: { compassion: -2, work: -1 } },
        { tone: "good", text: "Share some food, and ask Grasshopper to help gather more.", w: { compassion: 2, work: 1 } },
      ],
    },
    {
      at: 0.5,
      style: "SITUATIONAL",
      question: "Your class is cleaning the school garden. You are tired and your friends are still working. What would YOU do?",
      options: [
        { tone: "poor", text: "Sit down and wait until it is over.", w: { work: -2, perseverance: -1 } },
        { tone: "neutral", text: "Do a little more, then take a break." },
        { tone: "good", text: "Keep helping, and cheer the others on.", w: { work: 2, compassion: 1 } },
      ],
    },
    {
      at: 0.7,
      style: "PREDICT",
      question: "Ant shared the food. What will Grasshopper do when spring comes?",
      options: [
        { tone: "neutral", text: "Go back to playing, like before." },
        { tone: "good", text: "Help Ant gather food, and still sing for everyone.", w: { work: 2, compassion: 1 } },
        { tone: "poor", text: "Wait and hope that someone shares again.", w: { work: -1, perseverance: -1 } },
      ],
    },
    {
      at: 0.9,
      style: "RATING",
      question: "I do my share of the work, even when it is not fun.",
      options: rating([{ work: -2, compassion: -1 }, { work: -1 }, { work: 1 }, { work: 2, compassion: 1 }]),
    },
  ],
};

// Open for the live demo: the demo student has not started this module (its level is already unlocked).
export const BRAVE_LITTLE_PARROT: ModuleDef = {
  slug: "brave-little-parrot",
  title: "The Brave Little Parrot",
  sourceStory: "The Brave Little Parrot (Jataka tales)",
  clip: "bbb-mp4",
  primary: "courage",
  secondary: ["perseverance", "compassion"],
  ageBand: "10-12",
  learningObjective: "I can do the right thing even when I feel scared, and my small act can inspire others.",
  script:
    "Smoke drifts over the forest and the animals run to the river, worried. A tiny parrot dips her wings in the water and flies back to drop the drops on the trees. " +
    "'It is too little!' say the others. 'Every drop helps,' says Parrot, and she flies again and again. Seeing her, the others begin to help. Soon the rain clouds gather and the forest is safe.",
  discussionPrompts: [
    "Parrot was very small. Why did she still try?",
    "When did you do something even though you felt afraid?",
    "How can one brave person help others find their courage?",
  ],
  followUp: "Tell someone at home about a time you were brave. Then think of one small brave thing you could do this week, like speaking up kindly or trying something new.",
  questions: [
    {
      at: 0.12,
      style: "EMOTION",
      question: "Smoke is drifting over the forest and everyone is worried. Parrot is tiny. How would YOU feel?",
      options: [
        { tone: "poor", text: "😰 Too scared to do anything.", w: { courage: -2, compassion: -1 } },
        { tone: "good", text: "😟 Scared, but I want to help.", w: { courage: 2, perseverance: 1 } },
        { tone: "neutral", text: "😨 Very scared. I would wait and watch." },
      ],
    },
    {
      at: 0.32,
      style: "MORAL_CHOICE",
      question: "Parrot carries water in her wings. The others say, \"It is too little!\" What should Parrot do?",
      options: [
        { tone: "good", text: "Keep carrying water. Every drop helps.", w: { courage: 2, perseverance: 1 } },
        { tone: "poor", text: "Stop. Maybe they are right.", w: { courage: -2, perseverance: -1 } },
        { tone: "neutral", text: "Rest a little and see what happens." },
      ],
    },
    {
      at: 0.52,
      style: "SITUATIONAL",
      question: "A classmate is being left out. You are afraid the group may leave you out too if you speak up. What would YOU do?",
      options: [
        { tone: "neutral", text: "Tell a teacher later." },
        { tone: "poor", text: "Stay quiet and look away.", w: { courage: -2, compassion: -1 } },
        { tone: "good", text: "Kindly speak up and stand with my classmate.", w: { courage: 2, compassion: 1 } },
      ],
    },
    {
      at: 0.74,
      style: "PREDICT",
      question: "Parrot keeps trying, drop after drop. What do you think happens next?",
      options: [
        { tone: "poor", text: "Parrot gets tired and gives up.", w: { courage: -1, perseverance: -1 } },
        { tone: "good", text: "Other animals feel inspired and start to help too.", w: { courage: 2, perseverance: 1 } },
        { tone: "neutral", text: "Nothing changes." },
      ],
    },
    {
      at: 0.92,
      style: "RATING",
      question: "I do the right thing even when I feel scared.",
      options: rating([
        { courage: -2, compassion: -1 },
        { courage: -1, perseverance: -1 },
        { courage: 1 },
        { courage: 2, perseverance: 1 },
      ]),
    },
  ],
};

export const DOG_AND_THE_REFLECTION: ModuleDef = {
  slug: "dog-and-the-reflection",
  title: "The Dog and His Reflection",
  sourceStory: "The Dog and His Reflection (Aesop's Fables)",
  clip: "bbb-webm",
  primary: "self-discipline",
  secondary: ["responsibility", "courage"],
  ageBand: "8-9",
  learningObjective: "I can stop and think before I grab for more, and finish my jobs before I play.",
  script:
    "Dog finds a big bone and trots home with it. On the bridge he looks down and sees another dog in the water, with a bone just as big. " +
    "'I want that one too!' he thinks. He barks, and his own bone falls into the river with a splash. The water settles and the other dog is gone. Dog walks home, quiet and hungry.",
  discussionPrompts: [
    "What did Dog want more than anything? What happened because of it?",
    "When is it hard for you to wait or to stop?",
    "What can you tell yourself when you really want something right now?",
  ],
  followUp: "Practise the 'stop, breathe, think' trick: next time you really want something right away, take three slow breaths before you decide.",
  questions: [
    {
      at: 0.1,
      style: "SITUATIONAL",
      question: "You have homework to finish. Your friends call you to play outside. What would YOU do?",
      options: [
        { tone: "poor", text: "Go out and play so my friends do not tease me.", w: { "self-discipline": -2, courage: -1 } },
        { tone: "good", text: "Finish first, then go and play.", w: { "self-discipline": 2, responsibility: 1 } },
        { tone: "neutral", text: "Do a little, play, and finish later." },
      ],
    },
    {
      at: 0.28,
      style: "EMOTION",
      question: "Dog has a big, juicy bone and sees another dog with a bone in the water. Pick the feeling that is closest to you when you want something more.",
      options: [
        { tone: "neutral", text: "🤔 Curious about the other bone." },
        { tone: "poor", text: "😤 I want that one too, right now!", w: { "self-discipline": -2, courage: -1 } },
        { tone: "good", text: "🙂 Happy with the bone I have.", w: { "self-discipline": 2, responsibility: 1 } },
      ],
    },
    {
      at: 0.46,
      style: "MORAL_CHOICE",
      question: "Dog is standing on the bridge. What should Dog do?",
      options: [
        { tone: "good", text: "Walk home with my own bone.", w: { "self-discipline": 2, courage: 1 } },
        { tone: "poor", text: "Bark at the other dog to get its bone.", w: { "self-discipline": -2, courage: -1 } },
        { tone: "neutral", text: "Stand and look at the water for a while." },
      ],
    },
    {
      at: 0.68,
      style: "PREDICT",
      question: "Dog opens his mouth to bark at the water. What will happen?",
      options: [
        { tone: "neutral", text: "Dog will wonder what happened." },
        { tone: "poor", text: "Dog will win the second bone by barking loudly.", w: { "self-discipline": -1, courage: -1 } },
        { tone: "good", text: "Dog will drop his bone. Grabbing for more can lose what we have.", w: { "self-discipline": 2, responsibility: 1 } },
      ],
    },
    {
      at: 0.9,
      style: "RATING",
      question: "I can wait for what I want, and I finish my jobs first.",
      options: rating([
        { "self-discipline": -2, responsibility: -1 },
        { "self-discipline": -1, courage: -1 },
        { "self-discipline": 1 },
        { "self-discipline": 2, responsibility: 1 },
      ]),
    },
  ],
};
