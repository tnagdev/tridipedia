import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface Particle {
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  vx: number;
  vy: number;
  char: string;
  size: number;
  state: 'falling' | 'forming' | 'static' | 'waiting';
  targetReachedTime?: number;
  opacity: number;
  fallSpeed: number;
  startTime?: number;
}

interface AsciiArtProps {
  className?: string;
  [key: string]: any;
}

const AsciiArt = ({ className, ...props }: AsciiArtProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Optimized ASCII art
  const asciiArt = useMemo(() => `                                                      
                 █████████████████████████████████████                
             ██████          ███████████████████████                  
           ████████                 █████████████ ███                 
            █████████                             ███                 
            ███████████                            ██                 
            █████████                              ██                 
            ████████    █████                       █                 
             ██████   ███████████               ████                  
             █████             ████       ██████████                  
             ██████████████████████████ █████████████████             
         ████ ████  ██  ███    █    ██████             ██             
        █    ████   ██    ████      ██  ██ ████ ███    █              
        █ ██   ███   ██   ███       █    ██████       ██              
        █   ██ ███   ██            ██     █           ██              
        █    █  ██    ███        ███      ██         ██               
         █   █  ██       ████████          ██████████                 
         ██   █ ███                  █████           █                
           ██   ████             ███████████        ██                
              ███████        ██████████████████     █                 
                 █████    █████████       ███████  ██                 
                 ███████ ████    ██████████   ███████                 
                 ████████████                  ██████                 
                  ████████████     ███████    ██████                  
                   █████████████            ████████                  
                    ████████████████     ██████████                   
                     ██████████████████████████████                   
                       ██████████████████████████                     
               ██         ██████████████████████                      
           ███████           █████████████████                        
        ███████  ████               ████                              
     █████    ███  ████                    ███                        
 █████          ███   ████                 ███████                    
 ██               ███    ██████          ███  ██ ████                 
                    ███      ██████████████   ██    █████             
                       ████                 ███         █████         
                          █████          ████              █████      
                               ███████████                    █████   
                                                                  ███  
  `, []);

  // Initialize particles - optimized like CareerTV
  const initializeParticles = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: Particle[] = [];
    const asciiLines = asciiArt.split('\n').filter(line => line.trim());

    // Optimized font size calculation
    const maxWidth = canvas.width * 1;
    const maxHeight = canvas.height * 1;
    let fontSize = 10;

    ctx.font = `${fontSize}px monospace`;

    // Find the longest line
    let maxLineWidth = 0;
    asciiLines.forEach(line => {
      const width = ctx.measureText(line).width;
      if (width > maxLineWidth) maxLineWidth = width;
    });

    // Scale font size to fit
    if (maxLineWidth > maxWidth) {
      fontSize = Math.floor((fontSize * maxWidth) / maxLineWidth);
    }

    const lineHeight = fontSize + 1;
    const totalHeight = asciiLines.length * lineHeight;

    if (totalHeight > maxHeight) {
      const heightBasedFontSize = Math.floor((fontSize * maxHeight) / totalHeight);
      fontSize = Math.min(fontSize, heightBasedFontSize);
    }

    fontSize = Math.max(4, fontSize);
    const finalLineHeight = fontSize + 1;

    // Center the ASCII art
    const startX = (canvas.width - maxLineWidth * fontSize / 10) / 2;
    const startY = (canvas.height - asciiLines.length * finalLineHeight) / 2 + fontSize;

    const baseTime = Date.now();
    const baseDelay = Math.random() * 200;

    asciiLines.forEach((line, lineIndex) => {
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char !== ' ') {
          const targetX = startX + i * (fontSize * 0.6);
          const targetY = startY + lineIndex * finalLineHeight;

          particles.push({
            x: targetX + (Math.random() - 0.5) * 20,
            y: -Math.random() * 100 - 50,
            originalX: targetX,
            originalY: targetY,
            vx: 0,
            vy: 0,
            char,
            size: fontSize,
            state: 'waiting',
            opacity: 0,
            fallSpeed: 2 + Math.random() * 1.5,
            startTime: baseTime + baseDelay + Math.random() * 150
          });
        }
      }
    });

    particlesRef.current = particles;
  }, [asciiArt]);

  // Optimized animation loop
  const animate = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas efficiently
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const currentTime = Date.now();
    const mouseRadius = Math.min(canvas.width, canvas.height) * 0.15;
    const particles = particlesRef.current;

    // Batch process particles for better performance
    const particlesToRender: Particle[] = [];

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];

      // Optimized particle state machine
      switch (particle.state) {
        case 'waiting':
          if (currentTime >= (particle.startTime || 0)) {
            particle.state = 'falling';
            particle.y = -50 - Math.random() * 100;
            particle.opacity = 0.1;
          }
          break;

        case 'falling':
          particle.y += particle.fallSpeed;
          const dx = particle.originalX - particle.x;
          particle.x += dx * 0.01;
          particle.opacity = Math.min(1, particle.opacity + 0.02);

          if (particle.y >= particle.originalY - 5) {
            particle.y = particle.originalY;
            particle.x = particle.originalX;
            particle.state = 'forming';
            particle.targetReachedTime = currentTime;
            particle.opacity = 1;
          }
          break;

        case 'forming':
          const formingDuration = 500;
          const timeSinceReached = currentTime - (particle.targetReachedTime || 0);

          if (timeSinceReached < formingDuration) {
            const pulsePhase = (timeSinceReached / formingDuration) * Math.PI;
            particle.opacity = 0.7 + 0.3 * Math.sin(pulsePhase * 4);
          } else {
            particle.state = 'static';
            particle.opacity = 1;
          }
          break;

        case 'static':
          // Optimized mouse interaction
          const mouseDx = mouseRef.current.x - particle.x;
          const mouseDy = mouseRef.current.y - particle.y;
          const distance = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);

          // Return to original position
          const returnDx = particle.originalX - particle.x;
          const returnDy = particle.originalY - particle.y;
          const returnForce = 0.08;

          particle.vx += returnDx * returnForce;
          particle.vy += returnDy * returnForce;

          // Mouse bounce effect
          if (isHovering && distance < mouseRadius && distance > 0) {
            const bounceStrength = (mouseRadius - distance) / mouseRadius;
            const bounceForce = bounceStrength * 3;
            const bounceX = -(mouseDx / distance) * bounceForce;
            const bounceY = -(mouseDy / distance) * bounceForce;

            particle.vx += bounceX;
            particle.vy += bounceY;
          }

          // Apply damping and update position
          particle.vx *= 0.85;
          particle.vy *= 0.85;
          particle.x += particle.vx;
          particle.y += particle.vy;

          // Boundary constraints
          if (particle.x < 0) {
            particle.x = 0;
            particle.vx *= -0.5;
          } else if (particle.x > canvas.width) {
            particle.x = canvas.width;
            particle.vx *= -0.5;
          }

          if (particle.y < 0) {
            particle.y = 0;
            particle.vy *= -0.5;
          } else if (particle.y > canvas.height) {
            particle.y = canvas.height;
            particle.vy *= -0.5;
          }
          break;
      }

      // Only add visible particles to render queue
      if (particle.opacity > 0 && particle.state !== 'waiting') {
        particlesToRender.push(particle);
      }
    }

    // Batch render particles
    ctx.font = `${particles[0]?.size || 8}px monospace`;
    ctx.fillStyle = '#00ff41';

    for (let i = 0; i < particlesToRender.length; i++) {
      const particle = particlesToRender[i];

      // Calculate glow only when needed
      let glowIntensity = 0;
      if (particle.state === 'falling') {
        glowIntensity = 0.5;
      } else if (particle.state === 'forming') {
        glowIntensity = 1;
      } else if (particle.state === 'static' && isHovering) {
        const distance = Math.sqrt(
          Math.pow(mouseRef.current.x - particle.x, 2) +
          Math.pow(mouseRef.current.y - particle.y, 2)
        );
        glowIntensity = Math.max(0, (mouseRadius - distance) / mouseRadius);
      }

      // Apply glow only when necessary
      if (glowIntensity > 0) {
        ctx.shadowColor = '#00ff41';
        ctx.shadowBlur = glowIntensity * 10;
      } else {
        ctx.shadowBlur = 0;
      }

      // Render particle
      ctx.globalAlpha = particle.opacity;
      ctx.fillText(particle.char, particle.x, particle.y);

      // Efficient trail rendering for falling particles
      if (particle.state === 'falling' && particle.y > 0 && particle.opacity > 0.7) {
        ctx.globalAlpha = particle.opacity * 0.3;
        ctx.fillText(particle.char, particle.x, particle.y - particle.fallSpeed * 2);

        if (particle.opacity > 0.9) {
          ctx.globalAlpha = particle.opacity * 0.1;
          ctx.fillText(particle.char, particle.x, particle.y - particle.fallSpeed * 4);
        }
      }
    }

    // Reset context state
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    animationRef.current = requestAnimationFrame(animate);
  }, [isHovering]);

  // Mouse event handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  // Canvas setup and lifecycle management
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        initializeParticles();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initializeParticles]);

  useEffect(() => {
    initializeParticles();
  }, [initializeParticles]);

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  return (
    <div className={`relative w-full h-full ${className}`} {...props}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ background: 'rgba(0, 0, 0, 0.9)' }}
      />
    </div>
  );
};

export default AsciiArt;