export type ExhibitKind = "project" | "about" | "contact" | "meta";

export interface ExhibitLink {
  label: string;
  url: string;
}

export interface Exhibit {
  id: string;
  kind: ExhibitKind;
  /** Tile coordinates on the village map (must be a walkable tile). */
  tileX: number;
  tileY: number;
  /** Short label shown above the in-world marker. */
  label: string;
  /** Modal heading. */
  title: string;
  /** Body copy. Blank lines (\n\n) separate paragraphs. Plain text. */
  body: string;
  /** Tech-stack chips shown in the modal. */
  tags?: string[];
  /** Screenshot URLs (served from apps/web/public, e.g. "/hangul1.jpg"). */
  images?: string[];
  links: ExhibitLink[];
}

export const EXHIBITS: Exhibit[] = [
  {
    id: "bookroom",
    kind: "project",
    tileX: 9,
    tileY: 6,
    label: "Bookroom",
    title: "Bookroom",
    body: "Your cozy personal library — track what you're reading, what you loved, and what's next.\n\nMy first full-stack app built from the ground up, and the one where it all clicked: standing up a real full-stack project end to end, modelling data with Prisma, and getting hands-on with server/client hydration in Next.js.",
    tags: ["Next.js", "Prisma", "TypeScript", "Tailwind", "Sass", "PostgreSQL (via Neon)"],
    links: [
      { label: "Live", url: "https://mybookroom.vercel.app/" },
      { label: "Source", url: "https://github.com/FelixFer/bookroom" },
    ],
  },
  {
    id: "seiyou",
    kind: "project",
    tileX: 17,
    tileY: 6,
    label: "SeiYou",
    title: "SeiYou — for voice actors",
    body: "A community app for voice-acting fans: upload your own performances and discover what others have made.\n\nA college group project and the most challenging one I'd taken on — my first cross-platform app and a real deep-dive into UI work. One honest caveat: it was built mobile-first, so view it on a phone or a narrow browser window.",
    tags: ["Ionic React", "JavaScript", "TypeScript", "CSS", "Firebase"],
    links: [
      { label: "Live", url: "https://sei-you.vercel.app/welcome" },
      { label: "Source", url: "https://github.com/FelixFer/WeHearYouAll-SeiYou" },
    ],
  },
  {
    id: "hangul",
    kind: "project",
    tileX: 9,
    tileY: 13,
    label: "Hangul",
    title: "Hangul Syllable Prediction",
    body: "A mobile app that recognizes hand-drawn Korean (Hangul) syllables — handwriting classified by a Convolutional Neural Network I trained from scratch.\n\nMy college thesis, and my first proper end-to-end machine-learning project: building and training my own model, then wiring it into a working app.",
    tags: ["Python", "Flask", "Expo", "JavaScript"],
    images: ["/hangul1.jpg", "/hangul2.jpg", "/hangul3.jpg"],
    links: [],
  },
  {
    id: "about",
    kind: "about",
    tileX: 9,
    tileY: 9,
    label: "About",
    title: "About me",
    body: "Frontend engineer who builds web apps with React and TypeScript — and cares as much about the workflow behind a product as the interface in front of it. I like untangling hard problems, sharpening developer workflows, and shipping alongside a team.\n\nOutside of frontend, I'm drawn to software architecture and generative AI. This little world is one of those side-quests.",
    links: [],
  },
  {
    id: "contact",
    kind: "contact",
    tileX: 17,
    tileY: 9,
    label: "Contact",
    title: "Get in touch",
    body: "Walked all the way over here? Say hi.",
    links: [
      { label: "Email", url: "mailto:felixfdnd@gmail.com" },
      { label: "GitHub", url: "https://github.com/FelixFer" },
      { label: "Instagram", url: "https://www.instagram.com/felferdinand" },
      { label: "LinkedIn", url: "https://www.linkedin.com/in/felix-frdnnd" },
      { label: "My Website", url: "https://felixferdinand.vercel.app" },
    ],
  },
  {
    id: "tinyworld",
    kind: "meta",
    tileX: 17,
    tileY: 13,
    label: "This World",
    title: "tinyworld — you're standing in it",
    body: "This portfolio is a tiny persistent multiplayer world. Every visitor is an avatar; the netcode is the point.\n\nThe server is one authoritative Node process ticking at 20 Hz. Your avatar is predicted locally and reconciled against the server by replaying unacknowledged inputs; everyone else is interpolated ~120 ms in the past.",
    links: [{ label: "Source", url: "https://github.com/FelixFer/tinyworld" }],
  },
];
