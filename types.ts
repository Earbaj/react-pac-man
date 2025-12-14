export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  NONE = 'NONE'
}

export enum TileType {
  EMPTY = 0,
  WALL = 1,
  DOT = 2,
  POWER_PELLET = 3,
  GHOST_HOUSE = 4,
  PACMAN_SPAWN = 5,
  GHOST_SPAWN = 6 // New tile type for editor
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum GameMode {
  CLASSIC = 'CLASSIC',
  TIME_ATTACK = 'TIME_ATTACK'
}

export interface Position {
  x: number;
  y: number;
}

export interface Entity extends Position {
  dir: Direction;
  nextDir?: Direction;
}

export interface Ghost extends Entity {
  id: number;
  color: string;
  isScared: boolean;
  isDead: boolean;
  speed: number;
}

export type Grid = number[][];

export interface CustomMap {
  id: string;
  name: string;
  grid: Grid;
  createdAt: number;
}

export interface HighScore {
  name: string;
  score: number;
  date: string;
  mode?: GameMode;
  difficulty?: Difficulty;
}

export interface GameState {
  score: number;
  lives: number;
  status: 'IDLE' | 'PLAYING' | 'PAUSED' | 'WON' | 'GAME_OVER' | 'DYING' | 'LEVEL_TRANSITION' | 'NEW_HIGH_SCORE' | 'LEADERBOARD' | 'EDITOR' | 'MAP_SELECT';
  level: number;
  mode: GameMode;
  difficulty: Difficulty;
  isCustomMap?: boolean;
}