import { TILES } from "../tiles.js";
import type { TileMapData } from "../types.js";

const TILE_SIZE = 16;

const LEGEND: Record<string, number> = {
  ".": TILES.GRASS_DARK.id,
  G: TILES.GRASS.id,
  P: TILES.PATH.id,
  T: TILES.TREE.id,
  W: TILES.WATER.id,
  F: TILES.FLOWER.id,
  "#": TILES.WALL.id,
};

const MAP_ASCII = [
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  "T..T..T..GGGGGGGGGGGT..T..T..T",
  "T..GGG...GGGGFFGGGG...GGG..T.T",
  "T.GGG.GG.GGGGGGGGGG.GG.GGG...T",
  "T.GGG.GG.GGG....GGG.GG.GGG.GGT",
  "T.....GG.GG.PPPP.GG.GG.....GGT",
  "T.GGGGGG.GG.PPPP.GG.GG.GGGGGGT",
  "T.GGGGGG...GPPPP.G...GGGGFFGGT",
  "T.FFGGGGGGGGPPPPGGGGGGGGGGGGGT",
  "T...GGGGGGGGPPPPGGGGGGGGWW...T",
  "T.GG.WWWWGGGPPPPGGGGWWWWGG.GGT",
  "T.GG.WWWWGGGPPPPGGGGWWWWGG.GGT",
  "T.GG.WWWWGGGPPPPGGGGWWWWGG...T",
  "T...GGGGGGGGPPPPGGGGGGGGGG.GGT",
  "T.GGGGGGFFGGGPPGGGGFFGGGGGGGGT",
  "TGGG.TTTTTGGGPPGGGGTTTTT.GGGGT",
  "TGGG.T.....GGPPGG.....T.GFFGGT",
  "TGGG.T..FF..GGPPGG..FF.T.GGGGT",
  "TGGG.T......GGPPGG.....T.GGGGT",
  "TGGG.TTTTTTTTTTTTTTTTTTT.GGGGT",
  "T..GGGGGGGGGGGGGGGGGGGGGGGG..T",
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
];

function parseMap(ascii: string[]): {
  ground: number[];
  objects: number[];
  width: number;
  height: number;
} {
  const height = ascii.length;
  const width = ascii[0].length;
  const ground: number[] = [];
  const objects: number[] = [];

  for (const row of ascii) {
    for (const char of row) {
      const tileId = LEGEND[char] ?? TILES.GRASS_DARK.id;
      ground.push(tileId);
      objects.push(0);
    }
  }

  return { ground, objects, width, height };
}

const parsed = parseMap(MAP_ASCII);

export const VILLAGE_MAP: TileMapData = {
  width: parsed.width,
  height: parsed.height,
  tileSize: TILE_SIZE,
  tiles: [],
  layers: {
    ground: parsed.ground,
    objects: parsed.objects,
  },
  spawn: { x: 15 * TILE_SIZE, y: 11 * TILE_SIZE },
};
