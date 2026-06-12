const ADJECTIVES = [
  "Curious",
  "Brave",
  "Clever",
  "Gentle",
  "Bold",
  "Quiet",
  "Swift",
  "Calm",
  "Bright",
  "Dark",
  "Wild",
  "Tame",
  "Free",
  "Lost",
  "Found",
  "Happy",
  "Sleepy",
  "Grumpy",
  "Silly",
  "Wise",
  "Young",
  "Old",
  "Tiny",
  "Great",
];

const ANIMALS = [
  "Capybara",
  "Fox",
  "Owl",
  "Bear",
  "Wolf",
  "Cat",
  "Dog",
  "Rabbit",
  "Deer",
  "Hawk",
  "Eagle",
  "Otter",
  "Badger",
  "Raccoon",
  "Hedgehog",
  "Squirrel",
  "Mouse",
  "Frog",
  "Turtle",
  "Crane",
  "Heron",
  "Lynx",
];

const usedNames = new Set<string>();

export function generateName(): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const name = `${adj} ${animal}`;

    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }

  const suffix = Math.floor(Math.random() * 1000);
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal} ${suffix}`;
}
