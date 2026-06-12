export interface TileDef {
  id: number;
  name: string;
  color: number;
  solid: boolean;
}

export interface TileMapData {
  width: number;
  height: number;
  tileSize: number;
  tiles: TileDef[];
  layers: {
    ground: number[];
    objects: number[];
  };
  spawn: { x: number; y: number };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
