'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import { M_PLUS_Code_Latin } from "next/font/google";
import { twMerge } from "tailwind-merge";

const codeText = M_PLUS_Code_Latin({ subsets: ["latin"], weight: '200' });

interface Particle {
    x: number;
    y: number;
    originalX: number;
    originalY: number;
    vx: number;
    vy: number;
    color: string;
    char: string;
    size: number;
    state: 'falling' | 'forming' | 'static' | 'dropping' | 'waiting';
    targetReachedTime?: number;
    opacity: number;
    fallSpeed: number;
    dropDelay: number;
    startTime?: number;
    // Tech tag constraints (optional)
    tagBounds?: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
}

interface CareerPhase {
    id: number;
    title: string;
    year: string;
    company?: string;
    ascii: string;
    description: string;
    technologies: string[];
}

const careerPhases: CareerPhase[] = [
    {
        id: 1,
        title: "The Beginning",
        year: "2014 - 2018",
        company: "Academy of Technology",
        ascii: `
                                                                                          
                                                                                          
                                                                                          
                                                                                          
                                 ████      ██  ██████            █████                    
           ██████  ██       █████████ ██   ██  ██         ██            █  ██             
         ██  ██████  █         ███    ██   ██  █████     █ █            █    █            
        ██    ██  █████         ██    ████████ ███                                        
        ███  ███   ████         ██     ██  ███ ██  ██           █  ███████                
        ████                    █      ██  ██  ██████           █  ███████                
        ███                                                             █████  ███        
                      ██   █████             ███       █████                  ██████      
     ████████    ███████  ███████  ███       ███       ███             ███  ███████       
     █████████  ████████  ██  ███  ███  ███  ███ ███   ███  ███  ██   ███  ███   ██       
     ███   ████  ███     ███  ██        ███  ███ ████  ███  ███ ████  ███  ███   ██       
      ██    ██   ███     ██            ████  ███ ████  ███  ███ ████  ███ ███             
      ███████    ██████  ██    ███ ██  █████ ██  █████ ███  ███ █████ ███ ███      █      
       █████████ █████  ███ █████  ██  ████████  █████████  ██  █████████ ███  █████      
       ███   ████ ██    ███    ██  ██  ██  █████ ██  █████  ██  ███ █████ ███    ███      
       ██     ████ █     ██   ███  ██  ██  ████  ██   ████ ███  ███  ████ ███    ███      
       ███   ████  █████ ███  ██   ██  ███  ███  ███  ████ ███  ███  ████  ███  ████      
       █████████  ██████  ██████   ██  ███  ███  ███   ███ ███  ███   ███  █████████      
      █████████  ████      ████                  █              ██          ████████      
      ██████                                                                      ██      
      ██               ███████████████████████████████████████████                        
               █████████████████████████                 ████████████     █               
              █████████████                                              ███              
               █████                 ██████████████████                   █               
                                 █████                                                    
`,
        description: "I graduated with a degree in Electrical Engineering, but during college I stumbled upon coding—and it instantly clicked. What started as curiosity soon became passion; every problem felt like a puzzle waiting to be solved. That love for problem-solving pulled me into software development, where I found the perfect mix of creativity and logic. Since then, I’ve been building, learning, and growing as a developer every day.",
        technologies: ["Angular", "React", "Ionic", "TypeScript"]
    },
    {
        id: 3,
        title: "Mobile Mania",
        year: "2020 - 2022",
        company: "Aponiar Solutions",
        ascii: `                                                 
                                         ███████                                          
                     ███     ██       ███       ████            █                         
                 ███    █            ██  ███████       ██     ██ █ ██                     
                 █      ██      ██      █       █         █    █  █████    ██             
                █ █      ██       ██       ███      ██           ████████                 
           ██    █ █      ██    █                                  ███████    ███         
              █   █ ████ ██                        ██   ███          ███    ██            
                     ███              █████████  ████  ████     ██                        
          ██      ██    ██████  ██████  ████████  █    ███      █████████    ████         
                █████   ██████ ███████   █   ███    █  ███      ████████                  
                ██████  ██████ ███   ██  █████    ███  ██       ██         █              
         █        ████████ ████ ██   ██  ██   ███  ██ ███   ██ ██████      █    █         
          ████   ████ ████ ████ ███ ███  ██   ████ █  ████████ ██                         
                 ███  ███   ████ █████   ███████  ███ ███████  ██   ███    ████           
         ████    ████  ██   ████         ██                   █████████                   
                 ████                 ██           ███    ██                ██            
        ██  ██   █         █████    █████  █████   ███ █████   █████      █   ██          
                   █████   █████   ██████   ████   ██     █    ██████        █            
             ███    █████  █████   ██  ███  █████  ██    ██   ███ ███                     
           █       █████████  ███  ██   ██  ██  █████  ███   ███  ███       ███           
           █       ███  ████  ███  ████████ ███ █████  ███  ███   ███    ██               
                   ███   ███  ███  ██   ███  ██  ████  ██  ██████████      ███            
           █ ███   ███    █   ████ ██   ██  ███   ███ ███ ████    ████        █           
          ██    █  ████       ████                          ██    ████    █               
            ██████                     ████████████████                                   
           ███████      ███      ████████            ████     ██████████                  
             ████    ███    ██   █          ██████            █   █████ ██                
                          ██           ████              █    █████ ████ █                
                                  █                                    ██`,
        description: "After discovering my passion for coding, I dived deeper into development and soon specialized in cross-platform mobile apps. Using frameworks like React Native and Ionic, I built numerous applications that brought web experiences to mobile, bridging the gap between the two worlds. This phase shaped my ability to think about performance, user experience, and scalability across platforms, while sharpening my full-stack skills.",
        technologies: ["React Native", "Ionic", "Mobile Development"]
    },
    {
        id: 4,
        title: "FullStack Madness",
        year: "2022 - 2024",
        company: "CBNITS INDIA",
        ascii: `                                                                                          
         █                                                                                
                                                                 █████████████████        
          ███ ████        ███      ██               ███████████  ██ ███████████ ███       
        ███      ███   ██     ███ █████   ███████████            ███  █   ██  █ ███       
       ██       ██                                      ██████    █       █   █ ███ ███   
         ████     ████████████████████████████████████████ █    ███████       █ ██        
              ████         █  ██   █   ██   ██           ███████   ██  ███████  ██        
      ███    ██           ██  ██   █  ███   ██  ████    █    █        ███    █████ ██     
        ████ ██ ██  ███████   ██   █  ███  ███   ████  ██ █  █  █████ █    ████           
      ███     ████       ██   ██   █  ███  █████   ██  █  █  █  ████    █████  ██████     
        █████   █        ██   ██  ██  ███  ███████  █ ██  █  █  ████     ██               
           ██   █   ███████       ██    █    █      █ █   █  █        ██   ██  ███████    
       ████     █    ███████     ██          ██    ██ ██ ███ ███  ██  ███   ███           
          ███████ █████████████████████████████████████████████████████████████████ ██    
     ███ ██    █████   ████    ███       ███   ███    █        ██       ██        ██      
      █  ██     ███    ███     ███        ██    ███  ██       ██       ██    █   ███      
         ██     ██     ███  █   ██  ████   █     ██  ██  ███████   ██████    ██████       
    ███ ██       █     ███  ██  ██   ████  █      █  ██       ███    █████     ███  ██    
        ██   ██    ██  ██   ██  ██   ███   █   █     ██      ██████    ██████    ██       
        ██   ██    ██  ██        █  ███    █   █     ██  ███████  ███   ██ ███    ██      
     █  █    ███  ███  ██    █   █        ██   ██    ██                           ██      
     █ ██    ████████      ███   █     █████   ███   █        ██      ████      ████      
     ██████████    ██████████████████████  ███████████████████████████████████████        
          ███  ██   ██                                         ████       ██       ███    
      ███    ██████████ ██   ██    █████████████    █   ██  ██       ███████    ███       
           █ █          ██   ██                 ██████      █ █████       █ ██            
           █ ██████ ████ ██      ██     ██   ████    █      █  ██   ██ ██ ██  █  ███      
       ███ ██ █   ████   ██    ██████        █    █████     ██    ████  ████  █  ██       
            █ █          ██      ██          █████████   ██   █████ ████    ███           
            ██████████████                         █     █             ██████`,
        description: "Expanded into full-stack development. Started working with backend technologies, databases, and API development while maintaining frontend expertise.",
        technologies: ["Node.js", "MongoDB", "Express", "Full Stack"]
    },
    {
        id: 5,
        title: "Geeky TechLead",
        year: "2022-Present",
        company: "NextZen Minds",
        ascii: `
                     ███                                         ███████                  
              ███████  ██                             ██       ███      ██                
           ███          █      ██                █   ██      ██          █                
           ██           █           ██          ██  ██      ███ █        █                
            █           ██       ██                         ██ ██              ██         
            ██    ████   ██                                 ██ █      █████   █           
             ███   ███████          ████  ██████  ████               ██ ██                
              ████████   ██████ ████████████████  ███  ████ ███    █   ██      █          
       ████            ████████  ███     ██       ██  ████  ███  █████     ████           
           ███        ███        ██  ██  ██████   █████     ███ ████      █               
                     ███     ███ ██████  █████   ██████     ███████                       
        ██████   █   ███  ██████ ██      ██    █ ███ █████   ████      █████              
                     ████   ███  ███████ ███████ ███  █████ ████               █          
              ██      ████████   ███████ ████    ███    █   ███                           
          ███                                                                             
               ███████    █    ███   ██  ███ ████    ██████    █████ ████████             
          ███████████  █████ ███████ ██  ███ ███     ██       █████   █████████           
          ████████   ██      ██   █  ██  ███ ███     ██  █   ███  ██   ██   ████          
               ███   ██████ ███      ███████ ███     █████   ██   ██  ███    ███          
               ████  ██████ ███   █  ██   ██ ███  █  █      ████████  ██   ████           
                ███  ██      ███████ ██  ███ ███████ ██████ ███   ██  ████████            
        ██      ███  ███████ ██████  ███ ███ ██████████████ ██    █████████               
                ████ ████                                                                 
           █               █████████       ███████                        ██ ███          
         ██             ██         █   ████       █████████    ██  ██    ██     █         
                   ██   █          █                      ██     ██      █     █          
                 ██     ██      ████     █                              █     █           
                         ███████                     ██                ███ ███            
                            ██████                                         ███`,
        description: "Passionate about creative coding, building interactive animations, and delightful user interfaces. Always exploring new JS libraries and pushing the boundaries of web experiences.",
        technologies: ["Creative Coding", "Animations", "Interactive UI", "Three.js"]
    }
];

export default function CareerTV() {
    const [currentPhase, setCurrentPhase] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const [transitionState, setTransitionState] = useState<'static' | 'dropping' | 'forming'>('forming');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const particlesRef = useRef<Particle[]>([]);
    const mouseRef = useRef({ x: 0, y: 0 });
    const transitionTimerRef = useRef<NodeJS.Timeout>();

    const phase = careerPhases[currentPhase];

    // Initialize particles from text
    const initializeParticles = useCallback(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const particles: Particle[] = [];
        const asciiLines = phase.ascii.split('\n').filter(line => line.trim());

        // Calculate optimal font size based on canvas size
        const frameWidth = 8; // Frame width for boundary clamping
        const frameMargin = 15; // Margin from frame edges
        const maxWidth = canvas.width * 0.40 - frameMargin * 2; // Left panel width with margins
        const maxHeight = canvas.height - frameWidth * 2 - frameMargin * 2; // Full available height

        // Start with a reasonable font size
        let fontSize = 12;
        ctx.font = `${fontSize}px monospace`;

        // Find largest ASCII line to determine width scaling
        let maxLineWidth = 0;
        asciiLines.forEach(line => {
            const width = ctx.measureText(line).width;
            if (width > maxLineWidth) maxLineWidth = width;
        });

        // Calculate required font size to fit width
        if (maxLineWidth > maxWidth) {
            fontSize = Math.floor((fontSize * maxWidth) / maxLineWidth);
        }

        // Calculate required font size to fit height
        const lineHeight = fontSize + 2; // Slightly more line spacing
        const totalTextHeight = asciiLines.length * lineHeight;

        if (totalTextHeight > maxHeight) {
            const heightBasedFontSize = Math.floor((fontSize * maxHeight) / totalTextHeight);
            fontSize = Math.min(fontSize, heightBasedFontSize);
        }

        // Ensure minimum readable size
        fontSize = Math.max(4, fontSize);
        const finalLineHeight = fontSize + 2;
        const finalTotalHeight = asciiLines.length * finalLineHeight;

        // Center the ASCII art vertically in the available space
        const availableHeight = canvas.height - frameWidth * 2 - frameMargin * 2;
        const startY = frameWidth + frameMargin + (availableHeight - finalTotalHeight) / 2 + fontSize;
        const leftPanelCenterX = (canvas.width * 0.40) / 2;

        const baseTime = Date.now();
        const baseDelay = Math.random() * 200; // Random base delay for natural effect

        asciiLines.forEach((line, lineIndex) => {
            ctx.font = `${fontSize}px monospace`;
            const lineWidth = ctx.measureText(line).width;
            const lineStartX = leftPanelCenterX - lineWidth / 2;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char !== ' ') {
                    const targetX = lineStartX + ctx.measureText(line.substring(0, i)).width;
                    const targetY = startY + lineIndex * finalLineHeight;

                    // Ensure particles stay within the left panel boundaries
                    const clampedTargetX = Math.max(frameWidth + frameMargin, Math.min(targetX, canvas.width * 0.40 - frameMargin));
                    const clampedTargetY = Math.max(frameWidth + frameMargin, Math.min(targetY, canvas.height - frameWidth - frameMargin));

                    // Matrix rain: particles fall straight down from top of screen
                    particles.push({
                        x: clampedTargetX + (Math.random() - 0.5) * 20, // Small horizontal offset for variety
                        y: -Math.random() * 100 - 50, // Always start above screen
                        originalX: clampedTargetX,
                        originalY: clampedTargetY,
                        vx: 0,
                        vy: 0,
                        color: '#22c55e',
                        char,
                        size: fontSize,
                        state: 'waiting', // Always start in waiting state
                        opacity: 0,
                        fallSpeed: 2 + Math.random() * 1.5, // Consistent fall speed
                        dropDelay: Math.random() * 150, // Individual random delay, not cumulative
                        startTime: baseTime + baseDelay + Math.random() * 150 // Same base timing for all
                    });
                }
            }
        });

        // Add description text particles (right panel)
        const description = phase.description;
        const rightPanelStart = canvas.width * 0.45;
        const rightPanelWidth = canvas.width * 0.52;
        const words = description.split(' ');

        // Calculate content dimensions for vertical centering
        const titleFontSize = Math.max(14, Math.floor(canvas.width / 32));
        const companyFontSize = Math.max(11, Math.floor(canvas.width / 42));
        const descFontSize = Math.max(10, Math.floor(canvas.width / 65));
        const techFontSize = Math.max(7, Math.floor(canvas.width / 75));

        // Estimate description height by counting lines
        ctx.font = `${descFontSize}px monospace`;
        let descriptionLines = 0;
        let currentLine = '';
        words.forEach(word => {
            const testLine = currentLine + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > rightPanelWidth && currentLine !== '') {
                descriptionLines++;
                currentLine = word + ' ';
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) descriptionLines++; // Add the last line

        // Calculate total content height
        const titleHeight = titleFontSize;
        const companyHeight = phase.company ? companyFontSize + 10 : 0; // Reduced spacing between title and company
        const descriptionHeight = descriptionLines * (descFontSize + 3); // 3px line spacing
        const spacingBetweenSections = 35; // Increased space between title/company and description from 25 to 35px
        const techTagsHeight = techFontSize + 10; // Tags height with padding
        const spacingToTags = 30; // Increased space between description and tags from 20 to 30px

        const totalContentHeight = titleHeight + companyHeight + spacingBetweenSections + descriptionHeight + spacingToTags + techTagsHeight;

        // Calculate starting Y position to center all content
        const rightPanelHeight = canvas.height - (frameWidth + frameMargin) * 2;
        const contentStartY = frameWidth + frameMargin + (rightPanelHeight - totalContentHeight) / 2;

        // Position elements relative to contentStartY
        const titleY = contentStartY + titleHeight;
        const companyY = titleY + (phase.company ? companyHeight + 5 : 0);
        let yOffset = titleY + companyHeight + spacingBetweenSections;


        currentLine = '';
        const descFontSize2 = Math.max(10, Math.floor(canvas.width / 65)); // Slightly larger responsive font size
        ctx.font = `${descFontSize2}px monospace`;
        words.forEach(word => {
            const testLine = currentLine + word + ' ';
            const metrics = ctx.measureText(testLine);

            if (metrics.width > rightPanelWidth && currentLine !== '') {
                // Add current line particles
                for (let i = 0; i < currentLine.length; i++) {
                    const char = currentLine[i];
                    if (char !== ' ') {
                        const targetX = rightPanelStart + ctx.measureText(currentLine.substring(0, i)).width;
                        const targetY = yOffset;

                        // Ensure particles start and target within frame boundaries
                        const clampedTargetX = Math.max(frameWidth + frameMargin, Math.min(targetX, canvas.width - frameWidth - frameMargin));
                        const clampedTargetY = Math.max(frameWidth + frameMargin, Math.min(targetY, canvas.height - frameWidth - frameMargin));

                        particles.push({
                            x: clampedTargetX + (Math.random() - 0.5) * 20,
                            y: -Math.random() * 100 - 50,
                            originalX: clampedTargetX,
                            originalY: clampedTargetY,
                            vx: 0,
                            vy: 0,
                            color: '#22c55e',
                            char,
                            size: descFontSize,
                            state: 'waiting',
                            opacity: 0,
                            fallSpeed: 2 + Math.random() * 1.5,
                            dropDelay: Math.random() * 150, // Individual random delay
                            startTime: baseTime + baseDelay + Math.random() * 150 // Same base timing
                        });
                    }
                }
                currentLine = word + ' ';
                yOffset += descFontSize + 3;
            } else {
                currentLine = testLine;
            }
        });

        // Add remaining line
        if (currentLine) {
            for (let i = 0; i < currentLine.length; i++) {
                const char = currentLine[i];
                if (char !== ' ') {
                    const targetX = rightPanelStart + ctx.measureText(currentLine.substring(0, i)).width;
                    const targetY = yOffset;

                    // Ensure particles start and target within frame boundaries
                    const clampedTargetX = Math.max(frameWidth + 15, Math.min(targetX, canvas.width - frameWidth - 15));
                    const clampedTargetY = Math.max(frameWidth + frameMargin, Math.min(targetY, canvas.height - frameWidth - frameMargin));

                    particles.push({
                        x: clampedTargetX + (Math.random() - 0.5) * 20,
                        y: -Math.random() * 100 - 50,
                        originalX: clampedTargetX,
                        originalY: clampedTargetY,
                        vx: 0,
                        vy: 0,
                        color: '#22c55e',
                        char,
                        size: descFontSize,
                        state: 'waiting',
                        opacity: 0,
                        fallSpeed: 2 + Math.random() * 1.5,
                        dropDelay: Math.random() * 150, // Individual random delay
                        startTime: baseTime + baseDelay + Math.random() * 150 // Same base timing
                    });
                }
            }
        }

        // Add title particles (right panel header)
        const titleText = `[${phase.year}] ${phase.title}`;
        // Use the titleFontSize and titleY calculated above for centering
        ctx.font = `bold ${titleFontSize}px monospace`;

        for (let i = 0; i < titleText.length; i++) {
            const char = titleText[i];
            if (char !== ' ') {
                const targetX = rightPanelStart + ctx.measureText(titleText.substring(0, i)).width;
                const targetY = titleY;

                // Ensure particles start and target within frame boundaries
                const clampedTargetX = Math.max(frameWidth + frameMargin, Math.min(targetX, canvas.width - frameWidth - frameMargin));
                const clampedTargetY = Math.max(frameWidth + frameMargin, Math.min(targetY, canvas.height - frameWidth - frameMargin));

                particles.push({
                    x: clampedTargetX + (Math.random() - 0.5) * 20,
                    y: -Math.random() * 100 - 50,
                    originalX: clampedTargetX,
                    originalY: clampedTargetY,
                    vx: 0,
                    vy: 0,
                    color: '#22c55e',
                    char,
                    size: titleFontSize,
                    state: 'waiting',
                    opacity: 0,
                    fallSpeed: 2 + Math.random() * 1.5,
                    dropDelay: Math.random() * 150, // Individual random delay
                    startTime: baseTime + baseDelay + Math.random() * 150 // Same base timing
                });
            }
        }

        // Add company particles if company exists
        if (phase.company) {
            const companyText = `@ ${phase.company}`;
            // Use the companyY calculated above for centering
            ctx.font = `${companyFontSize}px monospace`;

            for (let i = 0; i < companyText.length; i++) {
                const char = companyText[i];
                if (char !== ' ') {
                    const targetX = rightPanelStart + ctx.measureText(companyText.substring(0, i)).width;
                    const targetY = companyY;

                    // Ensure particles start and target within frame boundaries
                    const clampedTargetX = Math.max(frameWidth + frameMargin, Math.min(targetX, canvas.width - frameWidth - frameMargin));
                    const clampedTargetY = Math.max(frameWidth + frameMargin, Math.min(targetY, canvas.height - frameWidth - frameMargin));

                    particles.push({
                        x: clampedTargetX + (Math.random() - 0.5) * 20,
                        y: -Math.random() * 100 - 50,
                        originalX: clampedTargetX,
                        originalY: clampedTargetY,
                        vx: 0,
                        vy: 0,
                        color: '#86efac',
                        char,
                        size: companyFontSize,
                        state: 'waiting',
                        opacity: 0,
                        fallSpeed: 2 + Math.random() * 1.5,
                        dropDelay: Math.random() * 150, // Individual random delay
                        startTime: baseTime + baseDelay + Math.random() * 150 // Same base timing
                    });
                }
            }
        }

        // Add technology tag particles (centered with other content)
        const centeredTechY = contentStartY + totalContentHeight - techTagsHeight; // Position tags at bottom of centered content
        ctx.font = `${techFontSize}px monospace`;
        let techX = canvas.width * 0.45;

        phase.technologies.forEach((tech, index) => {
            const padding = 8; // Increased padding for bigger boxes
            const width = ctx.measureText(tech).width + padding * 2;
            const height = techFontSize + padding * 2; // Increased height with more padding

            // Don't overflow right edge - respect frame boundaries
            if (techX + width > canvas.width - frameWidth - frameMargin) {
                return;
            }

            // Calculate box positioning for better vertical centering
            const boxTop = centeredTechY - height;
            const boxBottom = centeredTechY;
            const boxCenterY = boxTop + height / 2;

            // Define tag bounds for constraining particles - adjusted to be inside the box
            const tagBounds = {
                left: techX + padding, // Add padding to keep text inside the box
                right: techX + width - padding, // Subtract padding to keep text inside the box
                top: boxTop + padding / 2, // Small margin from top of box
                bottom: boxBottom - padding / 2 // Small margin from bottom of box
            };

            // Add particles for each character in the tech name
            for (let i = 0; i < tech.length; i++) {
                const char = tech[i];
                if (char !== ' ') {
                    const targetX = techX + padding + ctx.measureText(tech.substring(0, i)).width;
                    const targetY = boxCenterY + techFontSize / 3; // Center text vertically in the box

                    // Ensure particles land within the tag bounds (inside the box)
                    const clampedTargetX = Math.max(tagBounds.left, Math.min(targetX, tagBounds.right));
                    const clampedTargetY = Math.max(tagBounds.top, Math.min(targetY, tagBounds.bottom));

                    particles.push({
                        x: clampedTargetX + (Math.random() - 0.5) * 20,
                        y: -Math.random() * 100 - 50,
                        originalX: clampedTargetX,
                        originalY: clampedTargetY,
                        vx: 0,
                        vy: 0,
                        color: '#86efac', // Lighter green for tech tags
                        char,
                        size: techFontSize,
                        state: 'waiting',
                        opacity: 0,
                        fallSpeed: 2 + Math.random() * 1.5,
                        dropDelay: Math.random() * 150, // Individual random delay
                        startTime: baseTime + baseDelay + Math.random() * 150, // Same base timing
                        tagBounds: tagBounds // Add tag boundary constraints
                    });
                }
            }

            techX += width + 6; // Slightly more spacing between tags
        });

        particlesRef.current = particles;
    }, [phase]);

    // Animation loop
    const animate = useCallback(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear with TV screen background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const currentTime = Date.now();
        const mouseRadius = Math.min(canvas.width, canvas.height) * 0.15;
        const frameWidth = 8; // Frame width for boundary clamping

        particlesRef.current.forEach(particle => {
            // Handle different particle states
            switch (particle.state) {
                case 'waiting':
                    // Particles waiting to start falling (invisible until their time comes)
                    if (currentTime >= (particle.startTime || 0)) {
                        particle.state = 'falling';
                        particle.y = -50 - Math.random() * 100; // Start from top of screen
                        particle.opacity = 0.1;
                    }
                    break;

                case 'falling':
                    // Particles falling vertically like Matrix rain
                    particle.y += particle.fallSpeed;

                    // Slight horizontal drift towards target position, but keep it mostly vertical
                    const dx = particle.originalX - particle.x;
                    particle.x += dx * 0.01; // Very subtle horizontal movement

                    // Fade in while falling
                    particle.opacity = Math.min(1, particle.opacity + 0.02);

                    // Check if reached or passed target position
                    if (particle.y >= particle.originalY - 5) {
                        particle.y = particle.originalY;
                        particle.x = particle.originalX;
                        particle.state = 'forming';
                        particle.targetReachedTime = currentTime;
                        particle.opacity = 1;
                    }

                    // If particle falls too far past target, reset to target position
                    if (particle.y > particle.originalY + 20) {
                        particle.y = particle.originalY;
                        particle.x = particle.originalX;
                        particle.state = 'forming';
                        particle.targetReachedTime = currentTime;
                        particle.opacity = 1;
                    }
                    break;

                case 'forming':
                    // Brief glow effect when particle reaches target
                    const formingDuration = 500;
                    const timeSinceReached = currentTime - (particle.targetReachedTime || 0);

                    if (timeSinceReached < formingDuration) {
                        // Pulsing effect during formation
                        const pulsePhase = (timeSinceReached / formingDuration) * Math.PI;
                        particle.opacity = 0.7 + 0.3 * Math.sin(pulsePhase * 4);
                    } else {
                        particle.state = 'static';
                        particle.opacity = 1;
                    }
                    break;

                case 'static':
                    // Normal interactive behavior
                    const mouseDx = mouseRef.current.x - particle.x;
                    const mouseDy = mouseRef.current.y - particle.y;
                    const distance = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);

                    // Ensure original position is within appropriate boundaries
                    if (particle.tagBounds) {
                        // For tech tag particles, constrain to their tag bounds
                        const clampedOriginalX = Math.max(particle.tagBounds.left, Math.min(particle.originalX, particle.tagBounds.right));
                        const clampedOriginalY = Math.max(particle.tagBounds.top, Math.min(particle.originalY, particle.tagBounds.bottom));

                        particle.originalX = clampedOriginalX;
                        particle.originalY = clampedOriginalY;
                    } else {
                        // For other particles, use frame boundaries with proper margins
                        const margin = 15; // Frame margin for particles
                        const clampedOriginalX = Math.max(frameWidth + margin, Math.min(particle.originalX, canvas.width - frameWidth - margin));
                        const clampedOriginalY = Math.max(frameWidth + margin, Math.min(particle.originalY, canvas.height - frameWidth - margin));

                        particle.originalX = clampedOriginalX;
                        particle.originalY = clampedOriginalY;
                    }

                    // Always try to return to clamped original position
                    const returnDx = particle.originalX - particle.x;
                    const returnDy = particle.originalY - particle.y;
                    const returnForce = 0.08;

                    // Add return force
                    particle.vx += returnDx * returnForce;
                    particle.vy += returnDy * returnForce;

                    // If mouse is hovering and particle is within bounce radius
                    if (isHovering && distance < mouseRadius && distance > 0) {
                        // Calculate bounce force (stronger when closer)
                        const bounceStrength = (mouseRadius - distance) / mouseRadius;
                        const bounceForce = bounceStrength * 3;

                        // Normalize direction vector (away from mouse)
                        const bounceX = -(mouseDx / distance) * bounceForce;
                        const bounceY = -(mouseDy / distance) * bounceForce;

                        // Apply bounce force
                        particle.vx += bounceX;
                        particle.vy += bounceY;
                    }

                    // Apply damping
                    particle.vx *= 0.85;
                    particle.vy *= 0.85;

                    // Update position
                    particle.x += particle.vx;
                    particle.y += particle.vy;
                    break;

                case 'dropping':
                    // Particles dropping down vertically and fading out
                    if (currentTime > particle.dropDelay) {
                        particle.y += particle.fallSpeed * 1.5; // Faster drop
                        particle.opacity -= 0.02;

                        // Keep vertical fall with minimal horizontal drift
                        particle.x += (Math.random() - 0.5) * 0.5;
                    }
                    break;
            }

            // Keep particles within TV screen bounds (only for static state)
            if (particle.state === 'static') {
                // Special constraint for tech tag particles
                if (particle.tagBounds) {
                    // Constrain tech tag particles to their tag box
                    if (particle.x < particle.tagBounds.left) {
                        particle.x = particle.tagBounds.left;
                        particle.vx *= -0.5;
                    }
                    if (particle.x > particle.tagBounds.right) {
                        particle.x = particle.tagBounds.right;
                        particle.vx *= -0.5;
                    }
                    if (particle.y < particle.tagBounds.top) {
                        particle.y = particle.tagBounds.top;
                        particle.vy *= -0.5;
                    }
                    if (particle.y > particle.tagBounds.bottom) {
                        particle.y = particle.tagBounds.bottom;
                        particle.vy *= -0.5;
                    }
                } else {
                    // General TV frame constraints for non-tech particles with proper margins
                    const margin = frameWidth + 15; // More conservative buffer inside frame
                    if (particle.x < margin) {
                        particle.x = margin;
                        particle.vx *= -0.5;
                    }
                    if (particle.x > canvas.width - margin) {
                        particle.x = canvas.width - margin;
                        particle.vx *= -0.5;
                    }
                    if (particle.y < margin) {
                        particle.y = margin;
                        particle.vy *= -0.5;
                    }
                    if (particle.y > canvas.height - margin) {
                        particle.y = canvas.height - margin;
                        particle.vy *= -0.5;
                    }
                }
            }

            // Don't render if completely transparent, off-screen, or waiting
            if (particle.opacity <= 0 || particle.y > canvas.height + 100 || particle.state === 'waiting') {
                return;
            }

            // Draw particle with Matrix-style effects
            let glowIntensity = 0;

            // Falling particles have a trailing glow
            if (particle.state === 'falling') {
                glowIntensity = 0.5;
            }
            // Forming particles have a strong glow
            else if (particle.state === 'forming') {
                glowIntensity = 1;
            }
            // Interactive glow for static particles
            else if (particle.state === 'static' && isHovering) {
                const distance = Math.sqrt(
                    Math.pow(mouseRef.current.x - particle.x, 2) +
                    Math.pow(mouseRef.current.y - particle.y, 2)
                );
                glowIntensity = Math.max(0, (mouseRadius - distance) / mouseRadius);
            }

            if (glowIntensity > 0) {
                ctx.shadowColor = particle.color;
                ctx.shadowBlur = glowIntensity * 12;
            } else {
                ctx.shadowBlur = 0;
            }

            // Apply opacity and draw
            ctx.globalAlpha = particle.opacity;
            ctx.fillStyle = particle.color;
            ctx.font = `${particle.size}px monospace`;
            ctx.fillText(particle.char, particle.x, particle.y);

            // Draw trailing effect for falling particles
            if (particle.state === 'falling' && particle.y > 0) {
                ctx.globalAlpha = particle.opacity * 0.3;
                ctx.fillText(particle.char, particle.x, particle.y - particle.fallSpeed * 2);
                ctx.globalAlpha = particle.opacity * 0.1;
                ctx.fillText(particle.char, particle.x, particle.y - particle.fallSpeed * 4);
            }

            ctx.shadowBlur = 0; // Reset shadow
            ctx.globalAlpha = 1; // Reset alpha
        });

        // Screen divider line
        // ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
        // ctx.lineWidth = 3;
        // ctx.beginPath();
        // ctx.moveTo(canvas.width * 0.41, frameWidth + 10);
        // ctx.lineTo(canvas.width * 0.41, canvas.height - frameWidth - 20);
        // ctx.stroke();

        // Draw interactive technology tags (centered with content, only when not transitioning)
        if (transitionState === 'static') {
            // Recalculate centered position for consistency with particles
            const frameWidth = 8;
            const frameMargin = 15;
            const titleFontSize = Math.max(14, Math.floor(canvas.width / 32));
            const companyFontSize = Math.max(11, Math.floor(canvas.width / 42));
            const descFontSize = Math.max(10, Math.floor(canvas.width / 65));
            const techFontSize = Math.max(7, Math.floor(canvas.width / 75));

            // Estimate description lines
            const rightPanelWidth = canvas.width * 0.52;
            const words = phase.description.split(' ');
            ctx.font = `${descFontSize}px monospace`;
            let descriptionLines = 0;
            let currentLine = '';
            words.forEach(word => {
                const testLine = currentLine + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > rightPanelWidth && currentLine !== '') {
                    descriptionLines++;
                    currentLine = word + ' ';
                } else {
                    currentLine = testLine;
                }
            });
            if (currentLine) descriptionLines++;

            // Calculate total content height and center it
            const titleHeight = titleFontSize;
            const companyHeight = phase.company ? companyFontSize + 10 : 0; // Reduced spacing between title and company
            const descriptionHeight = descriptionLines * (descFontSize + 3);
            const spacingBetweenSections = 35; // Increased spacing
            const techTagsHeight = techFontSize + 10;
            const spacingToTags = 30; // Increased spacing
            const totalContentHeight = titleHeight + companyHeight + spacingBetweenSections + descriptionHeight + spacingToTags + techTagsHeight;
            const availableHeight = canvas.height - (frameWidth + frameMargin) * 2;
            const contentStartY = frameWidth + frameMargin + (availableHeight - totalContentHeight) / 2;
            const techY = contentStartY + totalContentHeight - techTagsHeight;

            ctx.font = `${techFontSize}px monospace`;
            let techX = canvas.width * 0.45;
            const tagMouseRadius = Math.min(canvas.width, canvas.height) * 0.15;

            phase.technologies.forEach((tech, index) => {
                const padding = 8; // Increased padding for bigger boxes (match particle section)
                const width = ctx.measureText(tech).width + padding * 2;
                const height = techFontSize + padding * 2; // Increased height with more padding

                // Don't overflow right edge
                if (techX + width > canvas.width - frameWidth - 15) {
                    return;
                }

                // Calculate box positioning for better vertical centering
                const boxTop = techY - height;
                const boxBottom = techY;
                const boxCenterY = boxTop + height / 2;

                // Calculate distance from mouse to tag center
                const tagCenterX = techX + width / 2;
                const tagCenterY = boxCenterY;
                const distanceToMouse = Math.sqrt(
                    Math.pow(mouseRef.current.x - tagCenterX, 2) +
                    Math.pow(mouseRef.current.y - tagCenterY, 2)
                );

                // Interactive effects based on mouse proximity
                const isNearMouse = isHovering && distanceToMouse < tagMouseRadius;
                const proximity = isNearMouse ? Math.max(0, (tagMouseRadius - distanceToMouse) / tagMouseRadius) : 0;

                // Scale and glow effects
                const scale = 1 + proximity * 0.3;
                const glowIntensity = proximity * 15;
                const borderAlpha = 0.6 + proximity * 0.4;

                // Apply scaling transformation
                ctx.save();
                ctx.translate(tagCenterX, tagCenterY);
                ctx.scale(scale, scale);
                ctx.translate(-tagCenterX, -tagCenterY);

                // Function to draw rounded rectangle
                const drawRoundedRect = (x: number, y: number, w: number, h: number, radius: number) => {
                    ctx.beginPath();
                    ctx.moveTo(x + radius, y);
                    ctx.lineTo(x + w - radius, y);
                    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
                    ctx.lineTo(x + w, y + h - radius);
                    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
                    ctx.lineTo(x + radius, y + h);
                    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
                    ctx.lineTo(x, y + radius);
                    ctx.quadraticCurveTo(x, y, x + radius, y);
                    ctx.closePath();
                };

                // Draw tech tag background with pulsing effect and rounded corners
                const bgAlpha = 0.1 + proximity * 0.2; // Reduced alpha since text is now particles
                ctx.fillStyle = `rgba(34, 197, 94, ${bgAlpha})`;
                drawRoundedRect(techX, boxTop, width, height, 4);
                ctx.fill();

                // Draw tech tag border with enhanced glow and rounded corners
                if (glowIntensity > 0) {
                    ctx.shadowColor = '#22c55e';
                    ctx.shadowBlur = glowIntensity;
                }
                ctx.strokeStyle = `rgba(34, 197, 94, ${borderAlpha})`;
                ctx.lineWidth = 1 + proximity;
                drawRoundedRect(techX, boxTop, width, height, 4);
                ctx.stroke();
                ctx.shadowBlur = 0;

                ctx.restore();

                techX += width + 6; // Match the particle spacing (increased)
            });
        }

        // TV scan lines effect
        // ctx.globalAlpha = 0.03;
        // for (let y = frameWidth; y < canvas.height - frameWidth; y += 3) {
        //     ctx.fillStyle = '#22c55e';
        //     ctx.fillRect(frameWidth, y, canvas.width - frameWidth * 2, 1);
        // }
        // ctx.globalAlpha = 1;

        animationRef.current = requestAnimationFrame(animate);
    }, [isHovering, phase.technologies, phase.company, phase.description, transitionState]);

    // Handle mouse events
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

    // Phase cycling with Matrix rain transitions
    useEffect(() => {
        const checkDropComplete = () => {
            // Check if all particles have dropped (opacity <= 0 or off-screen)
            const allDropped = particlesRef.current.every(particle =>
                particle.state !== 'dropping' ||
                particle.opacity <= 0 ||
                particle.y > (canvasRef.current?.height || 0) + 100
            );
            return allDropped;
        };

        const cyclePhases = () => {
            // Start dropping current particles
            setTransitionState('dropping');

            // Set all current particles to dropping state with synchronized timing
            const baseDropTime = Date.now();
            const maxDropDelay = 500; // Fixed maximum delay instead of index-based
            particlesRef.current.forEach((particle) => {
                particle.state = 'dropping';
                particle.dropDelay = baseDropTime + Math.random() * 300; // Individual random delay, not cumulative
            });

            // Wait for all particles to start dropping, then check periodically for completion
            const checkInterval = setInterval(() => {
                if (checkDropComplete()) {
                    clearInterval(checkInterval);

                    // All particles have dropped, now switch to next phase
                    setCurrentPhase((prev) => (prev + 1) % careerPhases.length);
                    setTransitionState('forming');

                    // Reset all particles to waiting state for gradual appearance
                    setTimeout(() => {
                        const baseTime = Date.now();
                        const newBaseDelay = Math.random() * 200; // Same as initialization
                        const resetFrameWidth = 8;
                        const resetFrameMargin = 15;
                        particlesRef.current.forEach((particle) => {
                            particle.state = 'waiting';
                            particle.startTime = baseTime + newBaseDelay + Math.random() * 150; // Synchronized timing
                            particle.opacity = 0;
                            particle.y = -50 - Math.random() * 100;

                            // Ensure original positions are also within frame boundaries
                            particle.originalX = Math.max(resetFrameWidth + resetFrameMargin, Math.min(particle.originalX, canvasRef.current!.width - resetFrameWidth - resetFrameMargin));
                            particle.originalY = Math.max(resetFrameWidth + resetFrameMargin, Math.min(particle.originalY, canvasRef.current!.height - resetFrameWidth - resetFrameMargin));
                        });
                    }, 100);

                    // After forming animation, switch to static
                    setTimeout(() => {
                        setTransitionState('static');
                    }, 6000); // More time for the gradual Matrix rain to form
                }
            }, 500); // Check every 500ms

            // Fallback timer in case something goes wrong (max 8 seconds for dropping)
            const fallbackTimer = setTimeout(() => {
                clearInterval(checkInterval);
                if (transitionState === 'dropping') {
                    setCurrentPhase((prev) => (prev + 1) % careerPhases.length);
                    setTransitionState('forming');

                    setTimeout(() => {
                        const baseTime = Date.now();
                        const newBaseDelay = Math.random() * 200; // Same as initialization
                        const resetFrameWidth = 8;
                        const resetFrameMargin = 15;
                        particlesRef.current.forEach((particle) => {
                            particle.state = 'waiting';
                            particle.startTime = baseTime + newBaseDelay + Math.random() * 150; // Synchronized timing
                            particle.opacity = 0;
                            particle.y = -50 - Math.random() * 100;

                            // Ensure original positions are also within frame boundaries
                            particle.originalX = Math.max(resetFrameWidth + resetFrameMargin, Math.min(particle.originalX, canvasRef.current!.width - resetFrameWidth - resetFrameMargin));
                            particle.originalY = Math.max(resetFrameWidth + resetFrameMargin, Math.min(particle.originalY, canvasRef.current!.height - resetFrameWidth - resetFrameMargin));
                        });
                    }, 100);

                    setTimeout(() => {
                        setTransitionState('static');
                    }, 6000);
                }
            }, maxDropDelay + 3000); // Give extra time beyond the last drop delay

            // Store timers for cleanup
            transitionTimerRef.current = fallbackTimer;
        };

        // Start the cycle after an initial delay
        const initialTimer = setTimeout(() => {
            setTransitionState('static');
        }, 4000); // Longer initial formation time

        // Set up recurring cycle - now with shorter interval for better pacing
        const interval = setInterval(cyclePhases, 15000); // 15 second cycle

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
            const currentTimer = transitionTimerRef.current;
            if (currentTimer) {
                clearTimeout(currentTimer);
            }
        };
    }, [transitionState]);

    // Initialize and start animation
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
    }, [initializeParticles, currentPhase]);

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
        <div className="absolute inset-0">
            {/* TV Frame with glow effect */}
            <div className="absolute inset-0 rounded-lg">
                <div className="absolute inset-1"></div>
            </div>

            {/* Static/noise overlay when hovering */}
            {isHovering && (
                <div
                    className="absolute inset-0 pointer-events-none opacity-10"
                    style={{
                        background: 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxmaWx0ZXIgaWQ9Im5vaXNlIj4KICAgICAgPGZlVHVyYnVsZW5jZSBiYXNlRnJlcXVlbmN5PSIwLjkiIG51bU9jdGF2ZXM9IjQiIHNlZWQ9IjIiLz4KICAgICAgPGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=") repeat'
                    }}
                />
            )}

            <canvas
                ref={canvasRef}
                className="absolute inset-2 cursor-pointer rounded"
                onMouseMove={handleMouseMove}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{ background: 'rgba(0, 0, 0, 0.9)' }}
            />

            {/* Phase indicators */}
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-2">
                {careerPhases.map((_, index) => (
                    <div
                        key={index}
                        className={twMerge([
                            "w-2 h-2 rounded-full transition-all duration-300",
                            index === currentPhase ?
                                "bg-green-400 shadow-lg shadow-green-400/50 scale-125" :
                                "bg-green-400/30 hover:bg-green-400/50"
                        ])}
                    />
                ))}
            </div>
        </div>
    );
}
