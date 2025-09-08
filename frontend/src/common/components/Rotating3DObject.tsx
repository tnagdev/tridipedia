'use client';
import { useRef, useEffect, useCallback } from 'react';

// Simple, clean symbols for better visibility
const CHARACTERS = ['●', '○', '◆', '◇', '▲', '△', '■', '□', '▼', '▽', '◉', '◎', '⬢', '⬡', '⭐', '✦', '⚫', '⚪', '⬛', '⬜', '🔴', '🟢', '🔵', '🟡'];

interface Rotating3DObjectProps {
    className?: string;
}

const Rotating3DObject: React.FC<Rotating3DObjectProps> = ({ className = '' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const timeRef = useRef(0);

    // 3D rotation functions
    const rotateX = (point: [number, number, number], angle: number): [number, number, number] => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [point[0], point[1] * cos - point[2] * sin, point[1] * sin + point[2] * cos];
    };

    const rotateY = (point: [number, number, number], angle: number): [number, number, number] => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [point[0] * cos + point[2] * sin, point[1], -point[0] * sin + point[2] * cos];
    };

    const rotateZ = (point: [number, number, number], angle: number): [number, number, number] => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [point[0] * cos - point[1] * sin, point[0] * sin + point[1] * cos, point[2]];
    };

    const project = (point: [number, number, number], distance: number = 400): [number, number] => {
        const factor = distance / (distance + point[2]);
        return [point[0] * factor, point[1] * factor];
    };

    // Define different 3D shapes that morph between each other
    const createSphere = (scale: number, detail: number = 8): [number, number, number][] => {
        const vertices: [number, number, number][] = [];
        // Create lightweight sphere
        for (let i = 0; i <= detail; i++) {
            const lat = (i * Math.PI) / detail - Math.PI / 2;
            for (let j = 0; j <= detail; j++) {
                const lon = (j * 2 * Math.PI) / detail;
                vertices.push([
                    scale * Math.cos(lat) * Math.cos(lon),
                    scale * Math.cos(lat) * Math.sin(lon),
                    scale * Math.sin(lat)
                ]);
            }
        }
        return vertices;
    };

    const createCube = (scale: number): [number, number, number][] => {
        const vertices: [number, number, number][] = [];
        const divisions = 2; // Minimal divisions for performance

        // Create lightweight cube
        for (let x = -divisions; x <= divisions; x++) {
            for (let y = -divisions; y <= divisions; y++) {
                for (let z = -divisions; z <= divisions; z++) {
                    // Only include face vertices
                    if (Math.abs(x) === divisions || Math.abs(y) === divisions || Math.abs(z) === divisions) {
                        vertices.push([
                            (x / divisions) * scale,
                            (y / divisions) * scale,
                            (z / divisions) * scale
                        ]);
                    }
                }
            }
        }
        return vertices;
    };

    const createTorus = (scale: number, detail: number = 8): [number, number, number][] => {
        const vertices: [number, number, number][] = [];
        const R = scale * 0.7; // Major radius
        const r = scale * 0.3; // Minor radius

        // Optimized torus with reduced detail for better performance
        for (let i = 0; i < detail; i++) {
            const u = (i / detail) * 2 * Math.PI;
            const cosU = Math.cos(u);
            const sinU = Math.sin(u);

            for (let j = 0; j < detail; j++) {
                const v = (j / detail) * 2 * Math.PI;
                const cosV = Math.cos(v);
                const sinV = Math.sin(v);

                // Pre-calculate common terms for optimization
                const rCosV = R + r * cosV;

                vertices.push([
                    rCosV * cosU,
                    rCosV * sinU,
                    r * sinV
                ]);
            }
        }
        return vertices;
    };

    const createOctahedron = (scale: number): [number, number, number][] => {
        const vertices: [number, number, number][] = [];
        const density = 3; // Minimal density

        // Create lightweight octahedron
        for (let level = -density; level <= density; level++) {
            const y = (level / density) * scale;
            const levelRadius = scale * (1 - Math.abs(level) / density);
            const levelDensity = Math.max(1, Math.floor(density - Math.abs(level)));

            if (levelRadius > 0) {
                for (let i = 0; i < levelDensity * 2; i++) { // Minimal multiplier
                    const angle = (i / (levelDensity * 2)) * Math.PI * 2;
                    vertices.push([
                        levelRadius * Math.cos(angle),
                        y,
                        levelRadius * Math.sin(angle)
                    ]);
                }
            }
        }
        return vertices;
    };

    const createLiquidBlob = (scale: number, detail: number = 6): [number, number, number][] => {
        const vertices: [number, number, number][] = [];
        const time = timeRef.current;

        // Create lightweight liquid blob
        for (let i = 0; i <= detail; i++) {
            const lat = (i * Math.PI) / detail - Math.PI / 2;
            for (let j = 0; j <= detail; j++) {
                const lon = (j * 2 * Math.PI) / detail;

                // Add noise for liquid-like distortion
                const noise = 0.2 * (Math.sin(lat * 3 + time * 2) * Math.cos(lon * 2 + time * 1.5) +
                    Math.sin(lat * 5 + time * 3) * Math.cos(lon * 4 + time * 2.5));
                const radius = scale * (1 + noise);

                vertices.push([
                    radius * Math.cos(lat) * Math.cos(lon),
                    radius * Math.cos(lat) * Math.sin(lon),
                    radius * Math.sin(lat)
                ]);
            }
        }
        return vertices;
    };

    const createDNA = (scale: number, detail: number = 8): [number, number, number][] => {
        const vertices: [number, number, number][] = [];
        const time = timeRef.current;
        const radius = scale * 0.5;
        const heightScale = scale * 2.0;

        // Optimize DNA double helix with reduced detail
        for (let i = 0; i < detail; i++) {
            const t = (i / detail) * Math.PI * 3; // Optimized turns
            const height = ((i / detail) - 0.5) * heightScale;

            // Pre-calculate trigonometric values
            const cosT = Math.cos(t + time * 0.5);
            const sinT = Math.sin(t + time * 0.5);
            const cosTPi = Math.cos(t + Math.PI + time * 0.5);
            const sinTPi = Math.sin(t + Math.PI + time * 0.5);

            // First strand - optimized
            vertices.push([
                radius * cosT,
                height,
                radius * sinT
            ]);

            // Second strand - optimized
            vertices.push([
                radius * cosTPi,
                height,
                radius * sinTPi
            ]);

            // Add connecting rungs more efficiently
            if (i % 3 === 0) { // Reduced frequency for performance
                const centerRadius = radius * 0.5;
                vertices.push([
                    centerRadius * cosT,
                    height,
                    centerRadius * sinT
                ]);
            }
        }
        return vertices;
    };

    const createPyramid = (scale: number): [number, number, number][] => {
        const vertices: [number, number, number][] = [];
        const density = 3; // Minimal density for performance

        // Create lightweight pyramid
        for (let level = 0; level < density; level++) {
            const levelHeight = ((level / density) - 0.5) * scale * 1.5;
            const levelSize = scale * (1 - level / density);
            const levelDensity = Math.max(1, Math.floor(density - level));

            // Create square base at each level
            for (let x = -levelDensity; x <= levelDensity; x++) {
                for (let z = -levelDensity; z <= levelDensity; z++) {
                    if (Math.abs(x) === levelDensity || Math.abs(z) === levelDensity || level === density - 1) {
                        vertices.push([
                            (x / levelDensity) * levelSize,
                            levelHeight,
                            (z / levelDensity) * levelSize
                        ]);
                    }
                }
            }
        }
        return vertices;
    };

    const createCylinder = (scale: number, detail: number = 8): [number, number, number][] => {
        const vertices: [number, number, number][] = [];
        const height = scale * 1.5;
        const radius = scale * 0.6;

        // Create lightweight cylinder
        for (let level = 0; level < 6; level++) { // Fewer levels
            const y = ((level / 5) - 0.5) * height;

            for (let i = 0; i < detail; i++) {
                const angle = (i / detail) * Math.PI * 2;

                // Outer ring only
                vertices.push([
                    radius * Math.cos(angle),
                    y,
                    radius * Math.sin(angle)
                ]);
            }
        }
        return vertices;
    };

    const animate = useCallback(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Safety check for canvas dimensions
        if (canvas.width <= 0 || canvas.height <= 0) return;

        timeRef.current += 0.015;

        // Clear canvas with simple black background
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const size = Math.max(80, Math.min(canvas.width, canvas.height) * 0.3); // Bigger size and increased minimum

        // Morphing cycle: determine which shapes to morph between
        const morphCycle = timeRef.current * 0.08; // Even slower for holographic effect
        const shapeIndex = Math.floor(morphCycle) % 8; // Now we have 8 shapes
        const morphProgress = morphCycle - Math.floor(morphCycle);

        // Smooth morphing transition with easing
        const t = 0.5 * (1 + Math.sin((morphProgress - 0.5) * Math.PI));

        let vertices1: [number, number, number][];
        let vertices2: [number, number, number][];

        // Define shape transitions with minimal particle counts for performance
        switch (shapeIndex) {
            case 0: // Sphere to Cube
                vertices1 = createSphere(size, 8);
                vertices2 = createCube(size);
                break;
            case 1: // Cube to Torus
                vertices1 = createCube(size);
                vertices2 = createTorus(size, 8);
                break;
            case 2: // Torus to DNA
                vertices1 = createTorus(size, 8);
                vertices2 = createDNA(size, 8);
                break;
            case 3: // DNA to Pyramid
                vertices1 = createDNA(size, 8);
                vertices2 = createPyramid(size);
                break;
            case 4: // Pyramid to Cylinder
                vertices1 = createPyramid(size);
                vertices2 = createCylinder(size, 8);
                break;
            case 5: // Cylinder to Octahedron
                vertices1 = createCylinder(size, 8);
                vertices2 = createOctahedron(size);
                break;
            case 6: // Octahedron to Liquid Blob
                vertices1 = createOctahedron(size);
                vertices2 = createLiquidBlob(size, 6);
                break;
            case 7: // Liquid Blob to Sphere
                vertices1 = createLiquidBlob(size, 6);
                vertices2 = createSphere(size, 8);
                break;
            default:
                vertices1 = createSphere(size, 8);
                vertices2 = createCube(size);
        }

        // Interpolate between shapes (handle different vertex counts)
        const maxVertices = Math.max(vertices1.length, vertices2.length);
        const morphedVertices: [number, number, number][] = [];

        for (let i = 0; i < maxVertices; i++) {
            const v1 = vertices1[i % vertices1.length];
            const v2 = vertices2[i % vertices2.length];

            morphedVertices.push([
                v1[0] * (1 - t) + v2[0] * t,
                v1[1] * (1 - t) + v2[1] * t,
                v1[2] * (1 - t) + v2[2] * t
            ]);
        }

        // Rotate all vertices
        const rotated = morphedVertices.map((v) => {
            let rotatedPoint = rotateX(v, timeRef.current * 0.8);
            rotatedPoint = rotateY(rotatedPoint, timeRef.current * 1.2);
            rotatedPoint = rotateZ(rotatedPoint, timeRef.current * 0.6);
            return rotatedPoint;
        });

        // Project to 2D
        const projected = rotated.map((v) => project(v, 500)); // Increased distance for better perspective

        // Sort vertices by depth for proper rendering order
        const sortedVertices = rotated.map((v, index) => ({ vertex: v, projected: projected[index], index }))
            .sort((a, b) => a.vertex[2] - b.vertex[2]);

        // Draw selective border connections - only connect particles that form the shape outline
        ctx.lineWidth = 2.5; // More prominent connections
        ctx.globalAlpha = 0.8; // Higher opacity for better visibility

        // Connect particles to form wireframe borders based on shape structure
        for (let i = 0; i < sortedVertices.length; i++) {
            const connectionsPerVertex = 2; // Limit connections per vertex
            let connectionCount = 0;

            // Find the closest particles to form structural connections
            const currentVertex = sortedVertices[i];
            const nearbyVertices = [];

            for (let j = 0; j < sortedVertices.length; j++) {
                if (i === j) continue;

                const dist = Math.sqrt(
                    Math.pow(currentVertex.vertex[0] - sortedVertices[j].vertex[0], 2) +
                    Math.pow(currentVertex.vertex[1] - sortedVertices[j].vertex[1], 2) +
                    Math.pow(currentVertex.vertex[2] - sortedVertices[j].vertex[2], 2)
                );

                if (dist < size * 0.7) {
                    nearbyVertices.push({ vertex: sortedVertices[j], distance: dist });
                }
            }

            // Sort by distance and connect to closest neighbors only
            nearbyVertices.sort((a, b) => a.distance - b.distance);

            for (let k = 0; k < Math.min(connectionsPerVertex, nearbyVertices.length); k++) {
                const neighbor = nearbyVertices[k];
                const avgZ = (currentVertex.vertex[2] + neighbor.vertex.vertex[2]) / 2;
                const intensity = Math.max(0.4, (avgZ + size) / (2 * size)); // Higher minimum intensity

                // Distance-based opacity for depth
                const distanceOpacity = Math.max(0.3, 1 - (neighbor.distance / (size * 0.7))); // Higher minimum opacity
                const finalOpacity = intensity * distanceOpacity * 0.9; // Higher final opacity

                ctx.strokeStyle = `rgba(0, 255, 100, ${finalOpacity})`;
                ctx.beginPath();
                ctx.moveTo(centerX + currentVertex.projected[0], centerY + currentVertex.projected[1]);
                ctx.lineTo(centerX + neighbor.vertex.projected[0], centerY + neighbor.vertex.projected[1]);
                ctx.stroke();

                connectionCount++;
            }
        }

        // Add structural backbone for shape definition
        ctx.lineWidth = 3; // Thicker backbone lines
        ctx.globalAlpha = 0.6; // Higher opacity for backbone

        // Connect every 4th particle to form main structural lines
        for (let i = 0; i < sortedVertices.length; i += 4) {
            const nextIndex = (i + 4) % sortedVertices.length;
            const v1 = sortedVertices[i];
            const v2 = sortedVertices[nextIndex];

            const dist = Math.sqrt(
                Math.pow(v1.vertex[0] - v2.vertex[0], 2) +
                Math.pow(v1.vertex[1] - v2.vertex[1], 2) +
                Math.pow(v1.vertex[2] - v2.vertex[2], 2)
            );

            // Only connect if reasonably close
            if (dist < size * 1.2) {
                const avgZ = (v1.vertex[2] + v2.vertex[2]) / 2;
                const intensity = Math.max(0.4, (avgZ + size) / (2 * size)); // Higher minimum intensity

                ctx.strokeStyle = `rgba(0, 255, 100, ${intensity * 0.8})`;
                ctx.beginPath();
                ctx.moveTo(centerX + v1.projected[0], centerY + v1.projected[1]);
                ctx.lineTo(centerX + v2.projected[0], centerY + v2.projected[1]);
                ctx.stroke();
            }
        }

        // Draw vertices as holographic sci-fi symbols
        ctx.globalAlpha = 1;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        sortedVertices.forEach((item, index) => {
            const { vertex, projected } = item;
            const z = vertex[2];
            const intensity = Math.max(0.4, (z + size) / (2 * size));
            const fontSize = Math.max(6, 10 + intensity * 4); // Larger particles for better visibility

            // Use consistent symbols based on current shape type (no morphing changes)
            let char;
            switch (shapeIndex) {
                case 0: // Sphere
                    char = CHARACTERS[0]; // ●
                    break;
                case 1: // Cube
                    char = CHARACTERS[6]; // ■
                    break;
                case 2: // Torus
                    char = CHARACTERS[2]; // ◆
                    break;
                case 3: // DNA
                    char = CHARACTERS[4]; // ▲
                    break;
                case 4: // Pyramid
                    char = CHARACTERS[4]; // ▲
                    break;
                case 5: // Cylinder
                    char = CHARACTERS[6]; // ■
                    break;
                case 6: // Octahedron
                    char = CHARACTERS[2]; // ◆
                    break;
                case 7: // Liquid Blob
                    char = CHARACTERS[10]; // ◉
                    break;
                default:
                    char = CHARACTERS[0]; // ●
            }

            // Green color scheme to match app theme
            const hue = 120 + intensity * 20; // Green spectrum
            const saturation = 70 + intensity * 20;
            const lightness = 40 + intensity * 35;

            // Reduced flicker for stability
            const flicker = Math.sin(timeRef.current * 6 + index * 0.15) * 0.1 + 0.9;

            ctx.font = `${fontSize}px 'Courier New', monospace`;
            ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${flicker})`;

            // Minimal green glow
            ctx.shadowColor = `hsl(${hue}, 60%, 50%)`;
            ctx.shadowBlur = 2 + intensity * 2; // Slightly more glow for bigger symbols

            ctx.fillText(
                char,
                centerX + projected[0],
                centerY + projected[1]
            );
        });

        ctx.shadowBlur = 0;

        // Display transformation phases
        const phases = ['SPHERE.INIT', 'CUBE.FORM', 'TORUS.RING', 'DNA.HELIX', 'PYRAMID.PEAK', 'CYLINDER.TUBE', 'OCTAHEDRON.GEO', 'LIQUID.STATE'];
        const concepts = [
            'Spherical Matrix',
            'Cubic Structure',
            'Torus Ring',
            'Genetic Helix',
            'Pyramid Form',
            'Cylindrical Tube',
            'Octahedral Geometry',
            'Liquid Plasma'
        ];

        const currentPhase = phases[shapeIndex];
        const currentConcept = concepts[shapeIndex];

        // Holographic text with flicker
        const textFlicker = Math.sin(timeRef.current * 6) * 0.2 + 0.8;
        ctx.fillStyle = `rgba(0, 255, 100, ${0.9 * textFlicker})`;
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 255, 100, 0.6)';
        ctx.shadowBlur = 4;
        ctx.fillText(currentPhase, centerX, centerY + size * 1.5 + 20);

        ctx.font = '11px "Courier New", monospace';
        ctx.fillStyle = `rgba(100, 255, 150, ${0.7 * textFlicker})`;
        ctx.shadowBlur = 2;
        ctx.fillText(currentConcept, centerX, centerY + size * 1.5 + 40);

        ctx.shadowBlur = 0;

        // Add holographic progress indicator
        const progressBarWidth = 140;
        const progressBarHeight = 8;
        const progressX = centerX - progressBarWidth / 2;
        const progressY = centerY + size * 1.5 + 65;

        // Holographic progress bar background
        ctx.fillStyle = 'rgba(0, 100, 50, 0.3)';
        ctx.fillRect(progressX, progressY, progressBarWidth, progressBarHeight);

        // Holographic progress bar fill with animated segments
        const segments = 20;
        const segmentWidth = progressBarWidth / segments;
        const activeSegments = Math.floor(segments * morphProgress);

        for (let i = 0; i < activeSegments; i++) {
            const segmentFlicker = Math.sin(timeRef.current * 8 + i * 0.4) * 0.2 + 0.8;
            ctx.fillStyle = `rgba(0, 255, 100, ${0.8 * segmentFlicker})`;
            ctx.fillRect(progressX + i * segmentWidth, progressY, segmentWidth - 1, progressBarHeight);
        }

        // Add morphing percentage text with holographic effect
        const percentFlicker = Math.sin(timeRef.current * 5) * 0.15 + 0.85;
        ctx.fillStyle = `rgba(0, 255, 100, ${0.9 * percentFlicker})`;
        ctx.font = '9px "Courier New", monospace';
        ctx.shadowColor = 'rgba(0, 255, 100, 0.5)';
        ctx.shadowBlur = 2;
        ctx.fillText(`${Math.round(morphProgress * 100)}% MORPH`, centerX, progressY + 22);

        ctx.shadowBlur = 0;

        ctx.globalAlpha = 1;
        animationRef.current = requestAnimationFrame(animate);
    }, []);

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const resizeCanvas = () => {
            const container = canvas.parentElement;
            if (container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Start animation
        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [animate]);

    return (
        <div className={`relative w-full h-full ${className}`}>
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{
                    background: 'linear-gradient(135deg, rgba(0,20,10,0.9) 0%, rgba(0,30,15,0.8) 50%, rgba(0,25,12,0.9) 100%)',
                    boxShadow: 'inset 0 0 30px rgba(0,255,100,0.1)'
                }}
            />
        </div>
    );
};

export default Rotating3DObject;
