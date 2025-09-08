'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { M_PLUS_Code_Latin } from "next/font/google";
import { twMerge } from "tailwind-merge";
import { Typewriter } from "react-simple-typewriter";

const codeFont = M_PLUS_Code_Latin({ subsets: ["latin"], weight: '400' });

// Maze configuration constants
const MAZE_SIZE = 31; // Must be odd for proper maze generation
const CELL_SIZE = 14;
const WALL_WIDTH = 1;
const MAZE_CENTER = Math.floor(MAZE_SIZE / 2);
const MAZE_RADIUS = Math.floor(MAZE_SIZE / 2) - 1;

// Check if a cell is within the circular boundary
const isInsideCircle = (row: number, col: number) => {
    const dx = col - MAZE_CENTER;
    const dy = row - MAZE_CENTER;
    return Math.sqrt(dx * dx + dy * dy) <= MAZE_RADIUS;
};

interface ExperienceData {
    company: string;
    startDate: Date | string;
    endDate: Date | string;
    location: string;
    position: string;
    exp: number;
    exp_unit: string;
}

interface MazeProps {
    experiences: ExperienceData[];
    className?: string;
}

const Maze: React.FC<MazeProps> = ({ experiences, className = '' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();
    const [currentCheckpoint, setCurrentCheckpoint] = useState(0);
    const [pathProgress, setPathProgress] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [mazeSeed, setMazeSeed] = useState(0); // For regenerating maze

    // Generate maze using useMemo to avoid recreation on every render
    const mazeData = useMemo(() => {
        // Use mazeSeed to influence randomness
        Math.random = (() => {
            let seed = mazeSeed + 12345;
            return () => {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };
        })();

        // Generate a complex circular maze using recursive backtracking algorithm (DSA)
        const generateMaze = () => {
            // Initialize maze with all walls (1 = wall, 0 = path, -1 = outside circle)
            const maze: number[][] = Array(MAZE_SIZE).fill(null).map((_, row) =>
                Array(MAZE_SIZE).fill(null).map((_, col) =>
                    isInsideCircle(row, col) ? 1 : -1
                )
            );

            // Directions for maze generation (right, down, left, up)
            const directions = [
                [0, 2],   // Right
                [2, 0],   // Down
                [0, -2],  // Left
                [-2, 0]   // Up
            ];

            // Stack for backtracking algorithm
            const stack: [number, number][] = [];
            const visited = Array(MAZE_SIZE).fill(null).map(() => Array(MAZE_SIZE).fill(false));

            // Find a valid starting position on the left side of the circle
            let startRow = MAZE_CENTER;
            let startCol = MAZE_CENTER;

            // Find leftmost position in the circle
            for (let radius = MAZE_RADIUS - 2; radius > 1; radius--) {
                const testRow = MAZE_CENTER;
                const testCol = MAZE_CENTER - radius;

                // Ensure odd coordinates
                let finalRow = testRow % 2 === 1 ? testRow : testRow - 1;
                let finalCol = testCol % 2 === 1 ? testCol : testCol - 1;

                if (finalRow >= 1 && finalRow < MAZE_SIZE - 1 &&
                    finalCol >= 1 && finalCol < MAZE_SIZE - 1 &&
                    isInsideCircle(finalRow, finalCol)) {
                    startRow = finalRow;
                    startCol = finalCol;
                    break;
                }
            }

            // Mark starting cell as path and visited
            maze[startRow][startCol] = 0;
            visited[startRow][startCol] = true;
            stack.push([startRow, startCol]);

            // Recursive backtracking maze generation
            while (stack.length > 0) {
                const [currentRow, currentCol] = stack[stack.length - 1];

                // Get all valid unvisited neighbors
                const neighbors: [number, number, number, number][] = [];

                for (const [dRow, dCol] of directions) {
                    const newRow = currentRow + dRow;
                    const newCol = currentCol + dCol;

                    // Check bounds, circle boundary, and if unvisited
                    if (newRow >= 1 && newRow < MAZE_SIZE - 1 &&
                        newCol >= 1 && newCol < MAZE_SIZE - 1 &&
                        isInsideCircle(newRow, newCol) &&
                        !visited[newRow][newCol]) {

                        // Wall between current and neighbor
                        const wallRow = currentRow + dRow / 2;
                        const wallCol = currentCol + dCol / 2;

                        // Check if wall is also inside circle
                        if (isInsideCircle(wallRow, wallCol)) {
                            neighbors.push([newRow, newCol, wallRow, wallCol]);
                        }
                    }
                }

                if (neighbors.length > 0) {
                    // Randomly choose a neighbor
                    const randomIndex = Math.floor(Math.random() * neighbors.length);
                    const [nextRow, nextCol, wallRow, wallCol] = neighbors[randomIndex];

                    // Remove wall between current cell and chosen neighbor
                    maze[wallRow][wallCol] = 0;
                    maze[nextRow][nextCol] = 0;

                    // Mark neighbor as visited and add to stack
                    visited[nextRow][nextCol] = true;
                    stack.push([nextRow, nextCol]);
                } else {
                    // Backtrack - no unvisited neighbors
                    stack.pop();
                }
            }

            // Create a guaranteed path from start to end using A* pathfinding
            const findPath = () => {
                const start = [startRow, startCol];

                // Find a valid end position on the right side of the circle
                let endRow = MAZE_CENTER;
                let endCol = MAZE_CENTER;

                // Find rightmost position in the circle
                for (let radius = MAZE_RADIUS - 2; radius > 1; radius--) {
                    const testRow = MAZE_CENTER;
                    const testCol = MAZE_CENTER + radius;

                    // Ensure odd coordinates
                    let finalRow = testRow % 2 === 1 ? testRow : testRow - 1;
                    let finalCol = testCol % 2 === 1 ? testCol : testCol + 1;

                    if (finalRow >= 1 && finalRow < MAZE_SIZE - 1 &&
                        finalCol >= 1 && finalCol < MAZE_SIZE - 1 &&
                        isInsideCircle(finalRow, finalCol)) {
                        endRow = finalRow;
                        endCol = finalCol;
                        break;
                    }
                }

                const end = [endRow, endCol];

                // Ensure end position is clear
                maze[end[0]][end[1]] = 0;

                // Priority queue for A* algorithm
                interface Node {
                    row: number;
                    col: number;
                    gCost: number;
                    hCost: number;
                    fCost: number;
                    parent: Node | null;
                }

                const heuristic = (row1: number, col1: number, row2: number, col2: number) => {
                    return Math.abs(row1 - row2) + Math.abs(col1 - col2);
                };

                const openSet: Node[] = [];
                const closedSet: boolean[][] = Array(MAZE_SIZE).fill(null).map(() => Array(MAZE_SIZE).fill(false));

                const startNode: Node = {
                    row: start[0],
                    col: start[1],
                    gCost: 0,
                    hCost: heuristic(start[0], start[1], end[0], end[1]),
                    fCost: 0,
                    parent: null
                };
                startNode.fCost = startNode.gCost + startNode.hCost;

                openSet.push(startNode);

                const pathDirections = [
                    [-1, 0], [1, 0], [0, -1], [0, 1] // 4-directional movement
                ];

                while (openSet.length > 0) {
                    // Find node with lowest fCost
                    let currentIndex = 0;
                    for (let i = 1; i < openSet.length; i++) {
                        if (openSet[i].fCost < openSet[currentIndex].fCost) {
                            currentIndex = i;
                        }
                    }

                    const current = openSet.splice(currentIndex, 1)[0];
                    closedSet[current.row][current.col] = true;

                    // Check if we reached the end
                    if (current.row === end[0] && current.col === end[1]) {
                        const path: [number, number][] = [];
                        let pathNode: Node | null = current;

                        while (pathNode !== null) {
                            path.unshift([pathNode.row, pathNode.col]);
                            pathNode = pathNode.parent;
                        }

                        return path;
                    }

                    // Check all neighbors
                    for (const [dRow, dCol] of pathDirections) {
                        const newRow = current.row + dRow;
                        const newCol = current.col + dCol;

                        // Check bounds, circle boundary, and if walkable
                        if (newRow >= 0 && newRow < MAZE_SIZE &&
                            newCol >= 0 && newCol < MAZE_SIZE &&
                            isInsideCircle(newRow, newCol) &&
                            maze[newRow][newCol] === 0 &&
                            !closedSet[newRow][newCol]) {

                            const gCost = current.gCost + 1;
                            const hCost = heuristic(newRow, newCol, end[0], end[1]);
                            const fCost = gCost + hCost;

                            // Check if this path to neighbor is better
                            const existingIndex = openSet.findIndex(node =>
                                node.row === newRow && node.col === newCol
                            );

                            if (existingIndex === -1) {
                                const newNode: Node = {
                                    row: newRow,
                                    col: newCol,
                                    gCost,
                                    hCost,
                                    fCost,
                                    parent: current
                                };
                                openSet.push(newNode);
                            } else if (gCost < openSet[existingIndex].gCost) {
                                openSet[existingIndex].gCost = gCost;
                                openSet[existingIndex].fCost = fCost;
                                openSet[existingIndex].parent = current;
                            }
                        }
                    }
                }

                // Fallback: create a simple circular path if A* fails
                const simplePath: [number, number][] = [];

                // Create a circular path from center outward
                const numPoints = 20;
                for (let i = 0; i < numPoints; i++) {
                    const angle = (i / numPoints) * 2 * Math.PI;
                    const radius = Math.min(MAZE_RADIUS * 0.7, MAZE_RADIUS - 2);
                    const row = Math.round(MAZE_CENTER + radius * Math.sin(angle));
                    const col = Math.round(MAZE_CENTER + radius * Math.cos(angle));

                    if (row >= 1 && row < MAZE_SIZE - 1 &&
                        col >= 1 && col < MAZE_SIZE - 1 &&
                        isInsideCircle(row, col)) {
                        simplePath.push([row, col]);
                        maze[row][col] = 0; // Ensure path is clear
                    }
                }

                return simplePath;
            };

            const path = findPath();

            // Add some additional complexity with branching paths
            const addBranchingPaths = () => {
                const branches = 8; // Number of additional branches

                for (let i = 0; i < branches; i++) {
                    // Random starting point from existing paths
                    const pathIndex = Math.floor(Math.random() * path.length);
                    const [startRow, startCol] = path[pathIndex];

                    // Random direction and length
                    const directions = [[-2, 0], [2, 0], [0, -2], [0, 2]];
                    const direction = directions[Math.floor(Math.random() * directions.length)];
                    const length = Math.floor(Math.random() * 4) + 2; // Shorter branches for circular maze

                    let currentRow = startRow;
                    let currentCol = startCol;

                    for (let j = 0; j < length; j++) {
                        const nextRow = currentRow + direction[0];
                        const nextCol = currentCol + direction[1];

                        if (nextRow >= 1 && nextRow < MAZE_SIZE - 1 &&
                            nextCol >= 1 && nextCol < MAZE_SIZE - 1 &&
                            isInsideCircle(nextRow, nextCol)) {

                            const wallRow = currentRow + direction[0] / 2;
                            const wallCol = currentCol + direction[1] / 2;

                            // Only create path if wall is also inside circle
                            if (isInsideCircle(wallRow, wallCol)) {
                                // Create path
                                maze[wallRow][wallCol] = 0;
                                maze[nextRow][nextCol] = 0;

                                currentRow = nextRow;
                                currentCol = nextCol;
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                }
            };

            addBranchingPaths();

            return { maze, path };
        };

        return generateMaze();
    }, [mazeSeed]); // Include mazeSeed to regenerate when needed

    const { maze, path } = mazeData;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        let startTime = Date.now();

        // Calculate checkpoint positions on the path
        const checkpointPositions = experiences.map((_, index) => {
            const progress = (index + 1) / experiences.length;
            return Math.floor(path.length * progress);
        });

        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;

            // Animation phases for each checkpoint:
            // 1. Move to checkpoint (2 seconds)
            // 2. Pause at checkpoint (3 seconds)
            const moveTime = 2000; // 2 seconds to move to checkpoint
            const pauseTime = 3000; // 3 seconds pause at checkpoint
            const phaseTime = moveTime + pauseTime; // 5 seconds total per checkpoint
            const totalCycleTime = experiences.length * phaseTime + 2000; // +2s final pause before restart

            const cyclePosition = elapsed % totalCycleTime;

            // Determine current checkpoint and animation phase
            const currentPhaseIndex = Math.floor(cyclePosition / phaseTime);
            const timeInCurrentPhase = cyclePosition % phaseTime;

            // Check if we're past all checkpoints (in final pause)
            if (currentPhaseIndex >= experiences.length) {
                // Final pause before restart - stay at last checkpoint
                const finalCheckpoint = experiences.length - 1;
                setCurrentCheckpoint(finalCheckpoint);
                setPathProgress(path.length - 1); // Show complete path

                // Check if we should restart with new maze
                if (cyclePosition >= experiences.length * phaseTime + 1000) { // 1s into final pause
                    // Generate new maze and restart
                    setMazeSeed(prev => prev + 1);
                    return; // Exit and let useEffect restart
                }

                animationId = requestAnimationFrame(animate);
                return;
            }

            const newCheckpoint = currentPhaseIndex;

            // Calculate path progress based on phase
            let targetPosition = 0;

            if (timeInCurrentPhase <= moveTime && newCheckpoint < experiences.length) {
                // Moving phase - animate to current checkpoint
                const moveProgress = timeInCurrentPhase / moveTime;
                const startPos = newCheckpoint === 0 ? 0 : checkpointPositions[newCheckpoint - 1];
                const endPos = checkpointPositions[newCheckpoint];
                targetPosition = startPos + (endPos - startPos) * moveProgress;
            } else {
                // Pause phase - stay at current checkpoint
                targetPosition = checkpointPositions[newCheckpoint];
            }

            // Update states
            setCurrentCheckpoint(newCheckpoint);
            setPathProgress(targetPosition);

            // Glow effect
            const glowCycle = (Math.sin(elapsed * 0.005) + 1) / 2;

            // Set canvas size
            canvas.width = MAZE_SIZE * CELL_SIZE;
            canvas.height = MAZE_SIZE * CELL_SIZE;

            // Clear canvas with pure black background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Matrix-style maze walls
            ctx.strokeStyle = '#00ff41';
            ctx.lineWidth = 1;
            ctx.shadowColor = '#00ff41';
            ctx.shadowBlur = 3;

            // Draw maze structure
            for (let row = 0; row < MAZE_SIZE; row++) {
                for (let col = 0; col < MAZE_SIZE; col++) {
                    if (maze[row][col] === 1) { // Only draw walls inside the circle
                        const x = col * CELL_SIZE;
                        const y = row * CELL_SIZE;

                        // Draw walls only where adjacent to paths or circle boundary
                        const hasTopPath = (row === 0 || maze[row - 1][col] === 0 || maze[row - 1][col] === -1);
                        const hasBottomPath = (row === MAZE_SIZE - 1 || maze[row + 1][col] === 0 || maze[row + 1][col] === -1);
                        const hasLeftPath = (col === 0 || maze[row][col - 1] === 0 || maze[row][col - 1] === -1);
                        const hasRightPath = (col === MAZE_SIZE - 1 || maze[row][col + 1] === 0 || maze[row][col + 1] === -1);

                        if (hasTopPath) {
                            ctx.beginPath();
                            ctx.moveTo(x, y);
                            ctx.lineTo(x + CELL_SIZE, y);
                            ctx.stroke();
                        }

                        if (hasBottomPath) {
                            ctx.beginPath();
                            ctx.moveTo(x, y + CELL_SIZE);
                            ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE);
                            ctx.stroke();
                        }

                        if (hasLeftPath) {
                            ctx.beginPath();
                            ctx.moveTo(x, y);
                            ctx.lineTo(x, y + CELL_SIZE);
                            ctx.stroke();
                        }

                        if (hasRightPath) {
                            ctx.beginPath();
                            ctx.moveTo(x + CELL_SIZE, y);
                            ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE);
                            ctx.stroke();
                        }
                    }
                }
            }

            ctx.shadowBlur = 0;

            // Draw the complete path (dim)
            ctx.strokeStyle = '#00aa33';
            ctx.lineWidth = 1;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.3;

            ctx.beginPath();
            path.forEach(([row, col], index) => {
                const x = col * CELL_SIZE + CELL_SIZE / 2;
                const y = row * CELL_SIZE + CELL_SIZE / 2;

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Draw traveled path (bright)
            const traveledLength = Math.floor(targetPosition);
            if (traveledLength > 0) {
                ctx.strokeStyle = '#00ff41';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#00ff41';
                ctx.shadowBlur = 8 + (glowCycle * 5);

                ctx.beginPath();
                for (let i = 0; i < traveledLength && i < path.length; i++) {
                    const [row, col] = path[i];
                    const x = col * CELL_SIZE + CELL_SIZE / 2;
                    const y = row * CELL_SIZE + CELL_SIZE / 2;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Draw start point
            const [startRow, startCol] = path[0];
            ctx.fillStyle = '#22c55e';
            ctx.shadowColor = '#22c55e';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(
                startCol * CELL_SIZE + CELL_SIZE / 2,
                startRow * CELL_SIZE + CELL_SIZE / 2,
                4,
                0,
                2 * Math.PI
            );
            ctx.fill();
            ctx.shadowBlur = 0;

            // Draw current position
            if (traveledLength > 0 && traveledLength < path.length) {
                const currentIndex = Math.min(traveledLength, path.length - 1);
                const [currentRow, currentCol] = path[currentIndex];

                const pulseSize = 6 + (Math.sin(elapsed * 0.01) * 2);

                ctx.fillStyle = '#ffff00';
                ctx.shadowColor = '#ffff00';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(
                    currentCol * CELL_SIZE + CELL_SIZE / 2,
                    currentRow * CELL_SIZE + CELL_SIZE / 2,
                    pulseSize,
                    0,
                    2 * Math.PI
                );
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            // Draw end point
            const [endRow, endCol] = path[path.length - 1];
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(
                endCol * CELL_SIZE + CELL_SIZE / 2,
                endRow * CELL_SIZE + CELL_SIZE / 2,
                4,
                0,
                2 * Math.PI
            );
            ctx.fill();
            ctx.shadowBlur = 0;

            // Draw checkpoint markers
            experiences.forEach((exp, index) => {
                const checkpointPos = checkpointPositions[index];

                if (checkpointPos < path.length) {
                    const [row, col] = path[checkpointPos];
                    const x = col * CELL_SIZE + CELL_SIZE / 2;
                    const y = row * CELL_SIZE + CELL_SIZE / 2;

                    const isReached = traveledLength >= checkpointPos;
                    const isCurrent = index === newCheckpoint;

                    let color, size, shadowBlur;

                    if (isCurrent) {
                        color = '#00ccff';
                        size = 5 + (Math.sin(elapsed * 0.008) * 2);
                        shadowBlur = 12;
                    } else if (isReached) {
                        color = '#00ff41';
                        size = 4;
                        shadowBlur = 8;
                    } else {
                        color = '#666666';
                        size = 3;
                        shadowBlur = 0;
                    }

                    ctx.fillStyle = color;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = shadowBlur;
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });

            // Draw checkpoint markers
            experiences.forEach((exp, index) => {
                const checkpointPos = checkpointPositions[index];

                if (checkpointPos < path.length) {
                    const [row, col] = path[checkpointPos];
                    const x = col * CELL_SIZE + CELL_SIZE / 2;
                    const y = row * CELL_SIZE + CELL_SIZE / 2;

                    const isReached = traveledLength >= checkpointPos;
                    const isCurrent = index === newCheckpoint;

                    let color, size, shadowBlur;

                    if (isCurrent) {
                        color = '#00ccff';
                        size = 5 + (Math.sin(elapsed * 0.008) * 2);
                        shadowBlur = 12;
                    } else if (isReached) {
                        color = '#00ff41';
                        size = 4;
                        shadowBlur = 8;
                    } else {
                        color = '#666666';
                        size = 3;
                        shadowBlur = 0;
                    }

                    ctx.fillStyle = color;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = shadowBlur;
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });

            animationId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };

    }, [experiences, maze, path]); // Include maze and path dependencies

    // Calculate current experience based on checkpoint
    const getCurrentExperience = () => {
        return experiences[currentCheckpoint] || experiences[0];
    };

    const currentExp = getCurrentExperience();

    return (
        <>
            <div className="h-full flex w-full gap-4 bg-black/90">
                {/* Left side - Matrix Maze */}
                <canvas
                    ref={canvasRef}
                    className=""
                />

                {/* Right side - Experience Terminal */}
                <div className="self-center flex-1 items-center bg-gradient-to-b from-black via-green-900/10 to-black relative overflow-hidden">
                    <motion.div
                        key={currentCheckpoint}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="relative z-10 h-full flex flex-col"
                    >
                        {/* Experience Data Display */}
                        <div className="flex-1 space-y-4">
                            <div className="border border-green-400/50 rounded-lg p-4 bg-black/60 backdrop-blur-sm">
                                <div className={twMerge("space-y-3", codeFont.className)}>
                                    {/* Company */}
                                    <div className="border-l-2 border-green-400 pl-3">
                                        <div className="text-green-300 text-xs opacity-80">{'> '}ORGANIZATION</div>
                                        <div className="text-white text-lg font-bold tracking-wide">{currentExp.company}</div>
                                    </div>

                                    {/* Role */}
                                    <div className="border-l-2 border-cyan-400 pl-3">
                                        <div className="text-cyan-300 text-xs opacity-80">{'> '}DESIGNATION</div>
                                        <div className="text-cyan-100 text-sm">{currentExp.position}</div>
                                    </div>

                                    {/* Location */}
                                    <div className="border-l-2 border-yellow-400 pl-3">
                                        <div className="text-yellow-300 text-xs opacity-80">{'> '}COORDINATES</div>
                                        <div className="text-yellow-100 text-sm">{currentExp.location}</div>
                                    </div>

                                    {/* Duration */}
                                    <div className="border-l-2 border-purple-400 pl-3">
                                        <div className="text-purple-300 text-xs opacity-80">{'> '}TIME_PERIOD</div>
                                        <div className="text-purple-100 text-sm">
                                            {currentExp.startDate instanceof Date
                                                ? currentExp.startDate.toLocaleDateString()
                                                : currentExp.startDate}
                                            <span className="text-purple-300 mx-2">→</span>
                                            {currentExp.endDate instanceof Date
                                                ? currentExp.endDate.toLocaleDateString()
                                                : currentExp.endDate}
                                        </div>
                                    </div>

                                    {/* Experience Level */}
                                    <div className="border-l-2 border-red-400 pl-3">
                                        <div className="text-red-300 text-xs opacity-80">{'> '}EXP_GAINED</div>
                                        <div className="text-red-100 text-sm font-bold">+{currentExp.exp} {currentExp.exp_unit}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </>
    );
};

export default Maze;