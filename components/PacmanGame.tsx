import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useInterval } from '../hooks/useInterval';
import { Direction, Entity, Ghost, Grid, TileType, GameState, HighScore, Difficulty, GameMode, CustomMap, Position } from '../types';
import { INITIAL_MAZE, GET_MAZE_FOR_LEVEL, DIRECTIONS, BASE_GAME_SPEED, BASE_SCARED_DURATION, GHOST_COLORS } from '../constants';
import { gameAudio } from '../utils/audio';
import { getHighScores, saveHighScore, isHighScore, getCustomMaps, saveCustomMap, deleteCustomMap } from '../utils/storage';

const PacmanGame: React.FC = () => {
  // --- State Initialization ---
  const [grid, setGrid] = useState<Grid>(JSON.parse(JSON.stringify(INITIAL_MAZE)));
  const [pacman, setPacman] = useState<Entity>({ x: 7, y: 12, dir: Direction.RIGHT, nextDir: Direction.RIGHT });
  const [ghosts, setGhosts] = useState<Ghost[]>([
    { id: 0, x: 7, y: 8, dir: Direction.UP, color: GHOST_COLORS[0], isScared: false, isDead: false, speed: 1 },
    { id: 1, x: 6, y: 8, dir: Direction.UP, color: GHOST_COLORS[1], isScared: false, isDead: false, speed: 1 },
    { id: 2, x: 8, y: 8, dir: Direction.UP, color: GHOST_COLORS[2], isScared: false, isDead: false, speed: 1 },
    { id: 3, x: 7, y: 7, dir: Direction.UP, color: GHOST_COLORS[3], isScared: false, isDead: false, speed: 1 },
  ]);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: 3,
    status: 'IDLE',
    level: 1,
    mode: GameMode.CLASSIC,
    difficulty: Difficulty.MEDIUM,
    isCustomMap: false
  });
  
  // Gameplay State
  const [scaredTimer, setScaredTimer] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(120); // Time Attack seconds
  const [isMuted, setIsMuted] = useState(false);
  
  // Menu/Editor State
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [customMaps, setCustomMaps] = useState<CustomMap[]>([]);
  
  // Editor State
  const [editorTool, setEditorTool] = useState<TileType>(TileType.WALL);
  const [editorMapName, setEditorMapName] = useState('My Maze');

  // Refs
  const pacmanRef = useRef(pacman);
  const nextDirRef = useRef(Direction.RIGHT);
  const gameStateRef = useRef(gameState);
  const tickRef = useRef(0);
  const ghostsRef = useRef(ghosts);

  useEffect(() => { pacmanRef.current = pacman; }, [pacman]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { ghostsRef.current = ghosts; }, [ghosts]);

  // --- Configuration Logic ---
  const getDifficultySettings = () => {
    switch (gameState.difficulty) {
      case Difficulty.EASY:
        return { speed: BASE_GAME_SPEED * 1.2, aiRandomness: 0.7 };
      case Difficulty.HARD:
        return { speed: BASE_GAME_SPEED * 0.8, aiRandomness: 0.1 };
      case Difficulty.MEDIUM:
      default:
        return { speed: BASE_GAME_SPEED, aiRandomness: 0.4 };
    }
  };

  const { speed: baseSpeed, aiRandomness } = getDifficultySettings();
  const currentSpeed = Math.max(100, baseSpeed - (gameState.level - 1) * 20);
  const currentScaredDuration = Math.max(0, BASE_SCARED_DURATION - (gameState.level - 1) * 5);

  // --- Audio Loop ---
  useEffect(() => {
    if (gameState.status === 'PLAYING') {
      const isScared = scaredTimer > 0;
      if (isScared) {
        gameAudio.startScared();
      } else {
        gameAudio.startSiren();
      }
    } else {
      if (gameState.status !== 'DYING') { 
         gameAudio.stopBackground();
      }
    }
  }, [gameState.status, scaredTimer]);

  useEffect(() => {
    setHighScores(getHighScores());
    setCustomMaps(getCustomMaps());
  }, []);

  // --- Helpers ---
  const isValidMove = (grid: Grid, x: number, y: number) => {
    if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return false;
    // Allow ghosts to move through spawn points in editor maps
    const cell = grid[y][x];
    return cell !== TileType.WALL;
  };

  const getOppositeDir = (dir: Direction) => {
    if (dir === Direction.UP) return Direction.DOWN;
    if (dir === Direction.DOWN) return Direction.UP;
    if (dir === Direction.LEFT) return Direction.RIGHT;
    if (dir === Direction.RIGHT) return Direction.LEFT;
    return Direction.NONE;
  };

  const toggleMute = () => {
    const muted = gameAudio.toggleMute();
    setIsMuted(muted);
  };

  const togglePause = useCallback(() => {
    if (gameStateRef.current.status === 'PLAYING') {
      setGameState(prev => ({ ...prev, status: 'PAUSED' }));
    } else if (gameStateRef.current.status === 'PAUSED') {
      setGameState(prev => ({ ...prev, status: 'PLAYING' }));
    }
  }, []);

  // --- Movement & AI ---
  const movePacman = () => {
    const current = pacmanRef.current;
    let nextX = current.x;
    let nextY = current.y;
    let nextDir = current.dir;

    const intendedDir = nextDirRef.current;
    const dxIntended = DIRECTIONS[intendedDir].x;
    const dyIntended = DIRECTIONS[intendedDir].y;

    if (isValidMove(grid, current.x + dxIntended, current.y + dyIntended)) {
      nextDir = intendedDir;
      nextX += dxIntended;
      nextY += dyIntended;
    } else {
      const dxCurrent = DIRECTIONS[current.dir].x;
      const dyCurrent = DIRECTIONS[current.dir].y;
      if (isValidMove(grid, current.x + dxCurrent, current.y + dyCurrent)) {
        nextX += dxCurrent;
        nextY += dyCurrent;
      }
    }

    if (nextX < 0) nextX = grid[0].length - 1;
    if (nextX >= grid[0].length) nextX = 0;

    return { x: nextX, y: nextY, dir: nextDir };
  };

  const moveGhosts = (currentGhosts: Ghost[], target: Entity) => {
    return currentGhosts.map(ghost => {
      // Scared logic
      if (ghost.isScared && !ghost.isDead && tickRef.current % 2 !== 0) {
        return ghost;
      }

      // Dead logic
      if (ghost.isDead) {
        // Find ghost house or spawn point
        const spawnY = grid.findIndex(row => row.includes(TileType.GHOST_HOUSE) || row.includes(TileType.GHOST_SPAWN));
        const spawnX = spawnY !== -1 ? grid[spawnY].findIndex(cell => cell === TileType.GHOST_HOUSE || cell === TileType.GHOST_SPAWN) : 7;
        
        // Simple respawn for now
        if (Math.abs(ghost.x - spawnX) < 1 && Math.abs(ghost.y - spawnY) < 1) {
             return { ...ghost, isDead: false, isScared: false };
        }
        // Teleport to spawn (simplified pathfinding for death)
        return { ...ghost, x: spawnX, y: spawnY, isDead: false, isScared: false };
      }
      
      // AI Move Logic
      const possibleMoves: Direction[] = [];
      Object.entries(DIRECTIONS).forEach(([key, val]) => {
        const d = key as Direction;
        if (d === Direction.NONE) return;
        if (d === getOppositeDir(ghost.dir)) return;

        const nx = ghost.x + val.x;
        const ny = ghost.y + val.y;
        if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length && grid[ny][nx] !== TileType.WALL) {
           possibleMoves.push(d);
        }
      });

      if (possibleMoves.length === 0) possibleMoves.push(getOppositeDir(ghost.dir));

      let chosenDir = possibleMoves[0];
      
      // AI Decision
      const shouldBeRandom = Math.random() < aiRandomness;

      if (ghost.isScared || shouldBeRandom) {
        chosenDir = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      } else {
        // Target Logic
        let minDist = Infinity;
        possibleMoves.forEach(d => {
            const nx = ghost.x + DIRECTIONS[d].x;
            const ny = ghost.y + DIRECTIONS[d].y;
            const dist = Math.abs(nx - target.x) + Math.abs(ny - target.y);
            if (dist < minDist) {
                minDist = dist;
                chosenDir = d;
            }
        });
      }

      return {
        ...ghost,
        x: ghost.x + DIRECTIONS[chosenDir].x,
        y: ghost.y + DIRECTIONS[chosenDir].y,
        dir: chosenDir
      };
    });
  };

  // --- Collision & Game Logic ---
  const handleCollisions = (newPacman: Entity, newGhosts: Ghost[]) => {
    const cell = grid[newPacman.y][newPacman.x];
    if (cell === TileType.DOT) {
      gameAudio.playWaka();
      setGameState(prev => ({ ...prev, score: prev.score + 10 }));
      const newGrid = [...grid];
      newGrid[newPacman.y][newPacman.x] = TileType.EMPTY;
      setGrid(newGrid);
      checkForWin(newGrid);
    } else if (cell === TileType.POWER_PELLET) {
      setGameState(prev => ({ ...prev, score: prev.score + 50 }));
      const newGrid = [...grid];
      newGrid[newPacman.y][newPacman.x] = TileType.EMPTY;
      setGrid(newGrid);
      setScaredTimer(currentScaredDuration);
      setGhosts(prev => prev.map(g => ({ ...g, isScared: true })));
    }

    const collisionGhostIndex = newGhosts.findIndex(g => g.x === newPacman.x && g.y === newPacman.y);
    if (collisionGhostIndex !== -1) {
      const ghost = newGhosts[collisionGhostIndex];
      if (ghost.isScared && !ghost.isDead) {
        gameAudio.playEatGhost();
        setGameState(prev => ({ ...prev, score: prev.score + 200 }));
        const updatedGhosts = [...newGhosts];
        const spawnY = grid.findIndex(row => row.includes(TileType.GHOST_HOUSE) || row.includes(TileType.GHOST_SPAWN));
        const spawnX = spawnY !== -1 ? grid[spawnY].findIndex(cell => cell === TileType.GHOST_HOUSE || cell === TileType.GHOST_SPAWN) : 7;
        
        updatedGhosts[collisionGhostIndex] = { ...ghost, isDead: true, isScared: false, x: spawnX, y: spawnY };
        setGhosts(updatedGhosts);
      } else if (!ghost.isDead) {
        handleDeath();
      }
    }
  };

  const checkForWin = (currentGrid: Grid) => {
    const hasDots = currentGrid.some(row => row.includes(TileType.DOT) || row.includes(TileType.POWER_PELLET));
    if (!hasDots) {
      setGameState(prev => ({ ...prev, status: 'LEVEL_TRANSITION' }));
    }
  };

  const findSpawn = (gridToCheck: Grid, type: TileType, defaultX: number, defaultY: number) => {
    for(let y=0; y<gridToCheck.length; y++) {
      for(let x=0; x<gridToCheck[y].length; x++) {
        if (gridToCheck[y][x] === type) return {x, y};
      }
    }
    return {x: defaultX, y: defaultY};
  }

  const resetPositions = (gridToUse: Grid = grid) => {
    const pacSpawn = findSpawn(gridToUse, TileType.PACMAN_SPAWN, 7, 12);
    setPacman({ x: pacSpawn.x, y: pacSpawn.y, dir: Direction.RIGHT, nextDir: Direction.RIGHT });
    nextDirRef.current = Direction.RIGHT;

    // Find ghost spawns
    const ghostSpawns: Position[] = [];
    for(let y=0; y<gridToUse.length; y++) {
      for(let x=0; x<gridToUse[y].length; x++) {
        if (gridToUse[y][x] === TileType.GHOST_HOUSE || gridToUse[y][x] === TileType.GHOST_SPAWN) {
          ghostSpawns.push({x, y});
        }
      }
    }
    // Default fallback if no spawns found
    if (ghostSpawns.length === 0) ghostSpawns.push({x: 7, y: 8});

    const newGhosts: Ghost[] = [];
    for(let i=0; i<4; i++) {
        const spawn = ghostSpawns[i % ghostSpawns.length];
        newGhosts.push({
            id: i,
            x: spawn.x,
            y: spawn.y,
            dir: Direction.UP,
            color: GHOST_COLORS[i],
            isScared: false,
            isDead: false,
            speed: 1
        });
    }
    setGhosts(newGhosts);
  };

  const handleDeath = () => {
    gameAudio.playDie();
    
    if (gameState.mode === GameMode.TIME_ATTACK) {
       setGameState(prev => ({ ...prev, status: 'DYING' }));
    } else {
        if (gameStateRef.current.lives > 1) {
            setGameState(prev => ({ ...prev, lives: prev.lives - 1, status: 'DYING' }));
        } else {
            setGameState(prev => ({ ...prev, status: 'GAME_OVER' }));
            checkScore();
        }
    }
  };

  const checkScore = () => {
    if (isHighScore(gameStateRef.current.score)) {
        setTimeout(() => setGameState(prev => ({ ...prev, status: 'NEW_HIGH_SCORE' })), 1000);
    }
  };

  const submitHighScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    const newScores = saveHighScore(playerName.trim(), gameState.score, gameState.mode, gameState.difficulty);
    setHighScores(newScores);
    setGameState(prev => ({ ...prev, status: 'LEADERBOARD' }));
  };

  // --- Effects ---

  // Death Animation
  useEffect(() => {
    if (gameState.status === 'DYING') {
      const timer = setTimeout(() => {
        resetPositions(grid);
        if (gameState.lives > 0 || gameState.mode === GameMode.TIME_ATTACK) {
             setGameState(prev => ({ ...prev, status: 'PLAYING' }));
        } else {
             setGameState(prev => ({ ...prev, status: 'GAME_OVER' }));
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState.status]);

  // Level Transition
  useEffect(() => {
    if (gameState.status === 'LEVEL_TRANSITION') {
      const timer = setTimeout(() => {
        let nextGrid = [...grid];

        // If Custom Map, reload it with dots. If Classic, load next level maze.
        if (gameState.isCustomMap) {
            nextGrid = grid.map(row => row.map(cell => {
                if (cell === TileType.EMPTY) return TileType.DOT; 
                return cell;
            }));
        } else {
            const nextLevel = gameState.level + 1;
            nextGrid = GET_MAZE_FOR_LEVEL(nextLevel);
        }

        setGrid(nextGrid);
        
        // IMPORTANT: Must pass nextGrid to resetPositions because state 'grid' is not updated yet in this scope
        resetPositions(nextGrid);
        
        setScaredTimer(0);
        setGameState(prev => ({
          ...prev,
          level: prev.level + 1,
          score: prev.score + 1000,
          status: 'PLAYING'
        }));
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [gameState.status]);

  // Game Loop
  const gameTick = useCallback(() => {
    if (gameState.status !== 'PLAYING') return;

    tickRef.current += 1;
    
    // Time Attack Logic
    if (gameState.mode === GameMode.TIME_ATTACK && tickRef.current % (1000/currentSpeed) < 1) { // Approx every second
        setTimeLeft(prev => {
            if (prev <= 1) {
                setGameState(s => ({...s, status: 'GAME_OVER'}));
                checkScore();
                return 0;
            }
            return prev - 1;
        });
    }

    const newPacman = movePacman();
    setPacman(prev => ({ ...prev, x: newPacman.x, y: newPacman.y, dir: newPacman.dir }));
    const newGhosts = moveGhosts(ghosts, newPacman);
    setGhosts(newGhosts);

    if (scaredTimer > 0) {
        setScaredTimer(prev => {
            if (prev === 1) {
                setGhosts(gs => gs.map(g => ({ ...g, isScared: false })));
            }
            return prev - 1;
        });
    }

    handleCollisions(newPacman, newGhosts);
  }, [grid, ghosts, scaredTimer, gameState.status, gameState.mode]);

  useInterval(gameTick, gameState.status === 'PLAYING' ? currentSpeed : null);

  // Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
         togglePause();
         return;
      }
      
      if (gameStateRef.current.status !== 'PLAYING') return;
      
      switch (e.key) {
        case 'ArrowUp': nextDirRef.current = Direction.UP; break;
        case 'ArrowDown': nextDirRef.current = Direction.DOWN; break;
        case 'ArrowLeft': nextDirRef.current = Direction.LEFT; break;
        case 'ArrowRight': nextDirRef.current = Direction.RIGHT; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePause]);

  const handleDirectionPress = (dir: Direction) => {
    if (gameState.status === 'PLAYING') {
      nextDirRef.current = dir;
    }
  };

  // --- Map Editor Logic ---
  const handleEditorClick = (x: number, y: number) => {
    if (gameState.status !== 'EDITOR') return;
    const newGrid = [...grid];
    const currentRow = [...newGrid[y]];
    
    if (currentRow[x] === editorTool) {
        currentRow[x] = TileType.EMPTY; // Toggle off
    } else {
        currentRow[x] = editorTool;
    }
    
    newGrid[y] = currentRow;
    setGrid(newGrid);
  };

  const saveCurrentMap = () => {
    if (!editorMapName) return;
    // Validate
    const hasPacSpawn = grid.some(r => r.includes(TileType.PACMAN_SPAWN));
    const hasGhostSpawn = grid.some(r => r.includes(TileType.GHOST_SPAWN) || r.includes(TileType.GHOST_HOUSE));
    if (!hasPacSpawn || !hasGhostSpawn) {
        alert("Map must have at least one Pac-Man spawn and one Ghost spawn/house.");
        return;
    }

    const newMap: CustomMap = {
        id: Date.now().toString(),
        name: editorMapName,
        grid: grid,
        createdAt: Date.now()
    };
    saveCustomMap(newMap);
    setCustomMaps(getCustomMaps());
    alert("Map Saved!");
  };

  const loadMap = (map: CustomMap) => {
    setGrid(map.grid);
    setGameState(prev => ({ ...prev, status: 'IDLE', isCustomMap: true })); // Go to menu to start
  };

  const initEditor = () => {
    // Start with blank grid
    const blank = Array(20).fill(0).map(() => Array(15).fill(TileType.EMPTY));
    // Add border
    for(let i=0; i<20; i++) { blank[i][0] = TileType.WALL; blank[i][14] = TileType.WALL; }
    for(let i=0; i<15; i++) { blank[0][i] = TileType.WALL; blank[19][i] = TileType.WALL; }
    
    setGrid(blank);
    setGameState(prev => ({ ...prev, status: 'EDITOR' }));
  };

  const startGame = () => {
    gameAudio.playGameStart();
    
    // Check if we need to load level 1 standard maze (only if not playing a custom map)
    let startGrid = grid;
    if (!gameState.isCustomMap) {
        startGrid = GET_MAZE_FOR_LEVEL(1);
        setGrid(startGrid);
    }

    // Reset positions and state
    // Note: We use the local startGrid variable because state update is async
    resetPositions(startGrid);
    
    setTimeLeft(120);
    setGameState(prev => ({ ...prev, score: 0, lives: 3, status: 'PLAYING', level: 1 }));
    setScaredTimer(0);
    setPlayerName('');
  };

  // --- Rendering ---
  const isDying = gameState.status === 'DYING';
  const transitionStyle = { transitionDuration: `${currentSpeed}ms` };
  
  const getRotation = (dir: Direction) => {
    switch (dir) {
      case Direction.LEFT: return 'rotate-180';
      case Direction.UP: return '-rotate-90';
      case Direction.DOWN: return 'rotate-90';
      default: return 'rotate-0';
    }
  };

  const getEyeStyle = (dir: Direction) => {
      switch(dir) {
          case Direction.UP: return 'translate-y-[-2px]';
          case Direction.DOWN: return 'translate-y-[2px]';
          case Direction.LEFT: return 'translate-x-[-2px]';
          case Direction.RIGHT: return 'translate-x-[2px]';
          default: return '';
      }
  };

  // Editor Palette
  const editorTools = [
      { id: TileType.WALL, label: 'Wall', color: 'bg-blue-900' },
      { id: TileType.DOT, label: 'Dot', color: 'bg-pink-200' },
      { id: TileType.POWER_PELLET, label: 'Power', color: 'bg-yellow-100' },
      { id: TileType.PACMAN_SPAWN, label: 'Pac Spawn', color: 'bg-yellow-400' },
      { id: TileType.GHOST_SPAWN, label: 'Ghost Spawn', color: 'bg-red-500' },
      { id: TileType.EMPTY, label: 'Eraser', color: 'bg-gray-800' },
  ];

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[100dvh] bg-transparent text-white touch-none overflow-hidden select-none">
      
      <div className="flex flex-col items-center w-full max-w-4xl h-full p-2 gap-2 md:justify-center">

        {/* Header */}
        <div className="flex justify-between w-full max-w-[600px] text-yellow-400 font-bold text-xs sm:text-base uppercase tracking-widest shadow-neon items-center shrink-0 h-10">
            {gameState.status === 'EDITOR' ? (
                <div className="flex flex-wrap gap-2 w-full justify-between items-center">
                    <input 
                        value={editorMapName} 
                        onChange={(e) => setEditorMapName(e.target.value)}
                        className="bg-slate-800 border border-blue-500 px-2 py-1 w-28 sm:w-48 text-white text-xs sm:text-sm"
                        placeholder="Map Name"
                    />
                    <div className="flex gap-2">
                        <button onClick={saveCurrentMap} className="bg-green-600 px-2 py-1 rounded text-white text-xs">Save</button>
                        <button 
                            onClick={() => {
                                setGrid(JSON.parse(JSON.stringify(INITIAL_MAZE))); 
                                setGameState(p => ({...p, status: 'IDLE', isCustomMap: false}));
                            }} 
                            className="bg-red-600 px-2 py-1 rounded text-white text-xs"
                        >
                            Exit
                        </button>
                    </div>
                </div>
            ) : (
                <>
                <div className="flex flex-col items-start leading-tight">
                    <span>Score: {gameState.score}</span>
                    <span className="text-[10px] sm:text-xs text-blue-300">Level: {gameState.level} | {gameState.mode === GameMode.TIME_ATTACK ? 'TIME' : gameState.difficulty}</span>
                </div>
                
                {gameState.mode === GameMode.TIME_ATTACK && (
                    <div className={`text-xl font-mono ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                )}

                <div className="flex gap-2 sm:gap-4 items-center">
                    <button onClick={togglePause} className="text-xl hover:text-white p-1" title="Pause">
                        {gameState.status === 'PAUSED' ? '▶️' : '⏸️'}
                    </button>
                    <button onClick={toggleMute} className="text-xl hover:text-white p-1" title={isMuted ? "Unmute" : "Mute"}>
                        {isMuted ? '🔇' : '🔊'}
                    </button>
                    {gameState.mode === GameMode.CLASSIC && <div className="leading-tight">Lives: {gameState.lives}</div>}
                </div>
                </>
            )}
        </div>

        {/* Game Board */}
        <div className="relative w-full flex justify-center items-center shrink-1 min-h-0">
             {/* Dynamic Aspect Ratio Container to prevent squashed entities */}
             <div 
                 className="relative bg-gray-900 border-2 sm:border-4 border-blue-800 rounded-lg shadow-2xl p-1 w-full max-w-[600px] max-h-[65dvh] md:max-h-[80vh]"
                 style={{ aspectRatio: `${grid[0].length}/${grid.length}` }}
             >
                
                <div 
                    className="grid gap-0 h-full w-full" 
                    style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))` }}
                >
                {grid.map((row, y) => (
                    row.map((cell, x) => (
                    <div 
                        key={`${x}-${y}`} 
                        onPointerDown={() => handleEditorClick(x, y)}
                        className={`
                            flex items-center justify-center relative
                            ${cell === TileType.WALL ? 'bg-blue-900/40 border-[0.5px] border-blue-700/50 rounded-sm' : ''}
                            ${gameState.status === 'EDITOR' ? 'cursor-pointer hover:bg-white/10' : ''}
                        `}
                    >
                        {cell === TileType.DOT && <div className="w-[20%] h-[20%] bg-pink-200 rounded-full" />}
                        {cell === TileType.POWER_PELLET && <div className="w-[50%] h-[50%] bg-yellow-100 rounded-full animate-pulse" />}
                        {cell === TileType.PACMAN_SPAWN && <div className="w-[80%] h-[80%] bg-yellow-400/50 rounded-full border border-yellow-400" />}
                        {cell === TileType.GHOST_SPAWN && <div className="w-[80%] h-[80%] bg-red-500/50 rounded-t-full border border-red-500" />}
                    </div>
                    ))
                ))}
                </div>

                {/* Entities (Hidden in Editor) */}
                {gameState.status !== 'EDITOR' && (
                    <div className="absolute inset-1 pointer-events-none overflow-hidden">
                        {/* Pacman */}
                        <div 
                            className={`absolute z-20 flex justify-center items-center ${!isDying ? 'transition-all ease-linear' : ''}`}
                            style={{ 
                                left: `${(pacman.x / grid[0].length) * 100}%`, 
                                top: `${(pacman.y / grid.length) * 100}%`,
                                width: `${100 / grid[0].length}%`, height: `${100 / grid.length}%`,
                                ...(!isDying ? transitionStyle : {})
                            }}
                        >
                            <div className={`w-[70%] h-[70%] sm:w-[85%] sm:h-[85%] relative ${isDying ? 'animate-spin scale-0 transition-transform duration-1000' : ''}`}>
                                <div className={`w-full h-full absolute ${getRotation(pacman.dir)}`}>
                                    <div className="w-full h-1/2 bg-yellow-400 rounded-t-full animate-chomp-top"></div>
                                    <div className="w-full h-1/2 bg-yellow-400 rounded-b-full animate-chomp-bottom"></div>
                                </div>
                            </div>
                        </div>

                        {/* Ghosts */}
                        {ghosts.map((ghost) => {
                            const isExpiring = ghost.isScared && scaredTimer < 15 && (scaredTimer % 4 < 2);
                            let ghostColorClass = ghost.color;
                            if (ghost.isDead) ghostColorClass = 'bg-gray-700 opacity-60';
                            else if (ghost.isScared) ghostColorClass = isExpiring ? 'bg-white' : 'bg-blue-700';

                            return (
                            <div 
                                key={ghost.id}
                                className="absolute transition-all ease-linear z-10 flex justify-center items-center"
                                style={{ 
                                    left: `${(ghost.x / grid[0].length) * 100}%`, 
                                    top: `${(ghost.y / grid.length) * 100}%`,
                                    width: `${100 / grid[0].length}%`, height: `${100 / grid.length}%`,
                                    ...transitionStyle
                                }}
                            >
                                <div className={`w-[70%] h-[70%] sm:w-[85%] sm:h-[85%] rounded-t-full ${ghostColorClass} flex justify-center items-start pt-[15%] transition-colors duration-150 relative`}>
                                    {!ghost.isScared && !ghost.isDead && (
                                        <div className={`flex gap-1 transition-transform duration-200 ${getEyeStyle(ghost.dir)}`}>
                                            <div className="w-2 h-2 bg-white rounded-full relative"><div className="w-1 h-1 bg-black rounded-full absolute top-[1px] right-[1px]"/></div>
                                            <div className="w-2 h-2 bg-white rounded-full relative"><div className="w-1 h-1 bg-black rounded-full absolute top-[1px] right-[1px]"/></div>
                                        </div>
                                    )}
                                    {(ghost.isScared || ghost.isDead) && (
                                        <div className="flex gap-1 mt-1"><div className="w-1 h-1 bg-yellow-200 rounded-full"/><div className="w-1 h-1 bg-yellow-200 rounded-full"/></div>
                                    )}
                                    <div className="absolute bottom-0 w-full flex justify-between px-0.5">
                                        <div className="w-1.5 h-1.5 bg-gray-900 rounded-t-full"></div>
                                        <div className="w-1.5 h-1.5 bg-gray-900 rounded-t-full"></div>
                                        <div className="w-1.5 h-1.5 bg-gray-900 rounded-t-full"></div>
                                    </div>
                                </div>
                            </div>
                        );
                        })}
                    </div>
                )}

                {/* Overlays / Menus */}
                {gameState.status !== 'PLAYING' && gameState.status !== 'DYING' && gameState.status !== 'EDITOR' && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm rounded-lg p-4 overflow-y-auto">
                        
                        {/* MAIN MENU / IDLE */}
                        {gameState.status === 'IDLE' && (
                            <div className="flex flex-col gap-4 w-full max-w-xs text-center">
                                <h1 className="text-4xl font-black text-yellow-400 drop-shadow-neon">PAC-MAN</h1>
                                
                                {/* Difficulty Select */}
                                <div className="flex justify-center gap-2">
                                    {Object.values(Difficulty).map(d => (
                                        <button 
                                            key={d}
                                            onClick={() => setGameState(p => ({...p, difficulty: d}))}
                                            className={`px-2 py-1 text-xs rounded border ${gameState.difficulty === d ? 'bg-yellow-500 text-black border-yellow-500' : 'border-gray-600 text-gray-400'}`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>

                                {/* Mode Select */}
                                <div className="flex justify-center gap-2">
                                    {Object.values(GameMode).map(m => (
                                        <button 
                                            key={m}
                                            onClick={() => setGameState(p => ({...p, mode: m}))}
                                            className={`px-2 py-1 text-xs rounded border ${gameState.mode === m ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-600 text-gray-400'}`}
                                        >
                                            {m === GameMode.TIME_ATTACK ? 'TIME ATK' : m}
                                        </button>
                                    ))}
                                </div>

                                <button onClick={startGame} className="btn-primary">START GAME</button>
                                <button onClick={() => setGameState(p => ({...p, status: 'MAP_SELECT'}))} className="btn-secondary">CUSTOM MAPS</button>
                                <button onClick={initEditor} className="btn-secondary">MAP EDITOR</button>
                                <button onClick={() => setGameState(p => ({...p, status: 'LEADERBOARD'}))} className="text-blue-400 text-xs underline">Leaderboard</button>
                            </div>
                        )}

                        {/* MAP SELECT */}
                        {gameState.status === 'MAP_SELECT' && (
                            <div className="w-full max-w-xs">
                                <h2 className="text-xl text-yellow-400 font-bold mb-4 text-center">Select Map</h2>
                                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mb-4">
                                    <button onClick={() => { setGrid(JSON.parse(JSON.stringify(INITIAL_MAZE))); setGameState(p => ({...p, status: 'IDLE', isCustomMap: false})); }} className="p-2 border border-blue-500 rounded text-left hover:bg-blue-900">
                                        Default Maze
                                    </button>
                                    {customMaps.map(m => (
                                        <div key={m.id} className="flex justify-between items-center p-2 border border-gray-600 rounded hover:bg-gray-800">
                                            <button onClick={() => loadMap(m)} className="text-left flex-1">{m.name}</button>
                                            <button onClick={() => { deleteCustomMap(m.id); setCustomMaps(getCustomMaps()); }} className="text-red-500 px-2">X</button>
                                        </div>
                                    ))}
                                    {customMaps.length === 0 && <p className="text-gray-500 text-center text-xs">No custom maps. Use Editor!</p>}
                                </div>
                                <button onClick={() => setGameState(p => ({...p, status: 'IDLE'}))} className="w-full py-2 bg-gray-700 rounded">Back</button>
                            </div>
                        )}

                        {/* GAME OVER / WON / PAUSED */}
                        {(['GAME_OVER', 'WON', 'PAUSED'].includes(gameState.status)) && (
                            <div className="flex flex-col gap-4 text-center">
                                <h2 className="text-3xl font-bold text-yellow-400">{gameState.status.replace('_', ' ')}</h2>
                                <p className="text-xl">Score: {gameState.score}</p>
                                {gameState.status === 'PAUSED' ? (
                                    <button onClick={togglePause} className="btn-primary">RESUME</button>
                                ) : (
                                    <button onClick={startGame} className="btn-primary">PLAY AGAIN</button>
                                )}
                                <button onClick={() => setGameState(p => ({...p, status: 'IDLE'}))} className="btn-secondary">MAIN MENU</button>
                            </div>
                        )}

                        {/* LEADERBOARD */}
                        {gameState.status === 'LEADERBOARD' && (
                             <div className="w-full max-w-xs">
                                <h2 className="text-xl text-yellow-400 font-bold mb-2 text-center">High Scores</h2>
                                {highScores.map((h, i) => (
                                    <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-700">
                                        <span>{i+1}. {h.name}</span>
                                        <span className="text-gray-400">{h.score} ({h.mode === GameMode.TIME_ATTACK ? 'TA' : 'CL'})</span>
                                    </div>
                                ))}
                                <button onClick={() => setGameState(p => ({...p, status: 'IDLE'}))} className="mt-4 w-full py-2 bg-gray-700 rounded">Back</button>
                             </div>
                        )}

                         {/* NEW HIGH SCORE */}
                         {gameState.status === 'NEW_HIGH_SCORE' && (
                            <form onSubmit={submitHighScore} className="flex flex-col gap-4 w-full max-w-xs">
                                <h2 className="text-2xl text-yellow-400 font-bold">NEW HIGH SCORE!</h2>
                                <p>Score: {gameState.score}</p>
                                <input 
                                    autoFocus maxLength={8}
                                    value={playerName} onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                                    className="bg-slate-800 border-2 border-yellow-400 p-2 text-center text-xl font-bold uppercase"
                                    placeholder="YOUR NAME"
                                />
                                <button type="submit" className="btn-primary">SUBMIT</button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Editor Tools */}
        {gameState.status === 'EDITOR' && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 w-full max-w-[600px] shrink-0 pb-safe px-2">
                {editorTools.map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setEditorTool(t.id)}
                        className={`
                            aspect-square rounded flex flex-col items-center justify-center text-[8px] sm:text-[10px]
                            ${editorTool === t.id ? 'border-2 border-white ring-2 ring-blue-500 z-10' : 'opacity-70'}
                            bg-slate-800
                        `}
                    >
                        <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full mb-1 ${t.color}`}></div>
                        {t.label}
                    </button>
                ))}
            </div>
        )}

        {/* Play Controls (Hidden in Editor) */}
        {gameState.status !== 'EDITOR' && (
            <div className="grid grid-cols-3 gap-2 md:hidden w-full max-w-[180px] shrink-0 pb-safe">
                <div />
                <ControlButton dir={Direction.UP} onClick={() => handleDirectionPress(Direction.UP)} />
                <div />
                <ControlButton dir={Direction.LEFT} onClick={() => handleDirectionPress(Direction.LEFT)} />
                <ControlButton dir={Direction.DOWN} onClick={() => handleDirectionPress(Direction.DOWN)} />
                <ControlButton dir={Direction.RIGHT} onClick={() => handleDirectionPress(Direction.RIGHT)} />
            </div>
        )}

        {/* Utility Styles */}
        <style>{`
            .btn-primary { @apply w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg rounded shadow-[0_0_15px_rgba(255,215,0,0.6)] transition-transform hover:scale-105 active:scale-95; }
            .btn-secondary { @apply w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded transition-colors; }
        `}</style>
      </div>
    </div>
  );
};

const ControlButton: React.FC<{ dir: Direction; onClick: () => void }> = ({ dir, onClick }) => {
    const icons = { [Direction.UP]: '▲', [Direction.DOWN]: '▼', [Direction.LEFT]: '◀', [Direction.RIGHT]: '▶', [Direction.NONE]: '' };
    return (
        <button 
            className="w-14 h-14 bg-slate-800 rounded-full shadow-lg border-b-4 border-slate-950 active:border-b-0 active:translate-y-1 text-2xl text-blue-400 flex items-center justify-center hover:bg-slate-700 active:bg-slate-600"
            onClick={(e) => { e.preventDefault(); onClick(); }}
            onTouchStart={(e) => { e.preventDefault(); onClick(); }}
        >
            {icons[dir]}
        </button>
    )
}

export default PacmanGame;