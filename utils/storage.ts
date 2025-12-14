import { HighScore, CustomMap } from '../types';

const SCORES_KEY = 'pacman_highscores';
const MAPS_KEY = 'pacman_custom_maps';
const MAX_SCORES = 5;

// --- High Scores ---

export const getHighScores = (): HighScore[] => {
  try {
    const stored = localStorage.getItem(SCORES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveHighScore = (name: string, score: number, mode: any, difficulty: any): HighScore[] => {
  const scores = getHighScores();
  const newScore: HighScore = { 
    name, 
    score, 
    date: new Date().toLocaleDateString(),
    mode,
    difficulty
  };
  
  scores.push(newScore);
  scores.sort((a, b) => b.score - a.score);
  
  const topScores = scores.slice(0, MAX_SCORES);
  
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(topScores));
  } catch (e) {
    console.error('Failed to save high score', e);
  }
  
  return topScores;
};

export const isHighScore = (score: number): boolean => {
  const scores = getHighScores();
  if (scores.length < MAX_SCORES) return true;
  return score > scores[scores.length - 1].score;
};

// --- Custom Maps ---

export const getCustomMaps = (): CustomMap[] => {
  try {
    const stored = localStorage.getItem(MAPS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveCustomMap = (map: CustomMap) => {
  const maps = getCustomMaps();
  // Update if exists or add new
  const index = maps.findIndex(m => m.id === map.id);
  if (index >= 0) {
    maps[index] = map;
  } else {
    maps.push(map);
  }
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
  } catch (e) {
    console.error('Failed to save map', e);
  }
};

export const deleteCustomMap = (id: string) => {
  const maps = getCustomMaps();
  const newMaps = maps.filter(m => m.id !== id);
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(newMaps));
  } catch (e) {
    console.error('Failed to delete map', e);
  }
};
