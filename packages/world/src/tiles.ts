import type { TileDef } from "./types.js";

export const TILES: Record<string, TileDef> = {
  EMPTY: { id: 0, name: "empty", color: 0x000000, solid: false },
  GRASS: { id: 1, name: "grass", color: 0x6abf69, solid: false },
  GRASS_DARK: { id: 2, name: "grass_dark", color: 0x4a9e49, solid: false },
  PATH: { id: 3, name: "path", color: 0xd4b896, solid: false },
  TREE: { id: 4, name: "tree", color: 0x1a4d1a, solid: true },
  WATER: { id: 5, name: "water", color: 0x2196f3, solid: true },
  FLOWER: { id: 6, name: "flower", color: 0xff69b4, solid: false },
  WALL: { id: 7, name: "wall", color: 0x8b4513, solid: true },
};

export const TILES_BY_ID: TileDef[] = [
  TILES.EMPTY,
  TILES.GRASS,
  TILES.GRASS_DARK,
  TILES.PATH,
  TILES.TREE,
  TILES.WATER,
  TILES.FLOWER,
  TILES.WALL,
];
