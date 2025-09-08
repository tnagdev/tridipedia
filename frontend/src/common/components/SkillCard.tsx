'use client'

import { CircularProgress } from "@nextui-org/react";
import Image from "next/image";
import { useState, useEffect } from "react";

const SKillCard = ({ item, isActive = false }: any) => {
    const [scanProgress, setScanProgress] = useState(0);

    // Scanning animation when active
    useEffect(() => {
        if (isActive) {
            const interval = setInterval(() => {
                setScanProgress(prev => {
                    if (prev >= 100) return 0;
                    return prev + 2;
                });
            }, 50);
            return () => clearInterval(interval);
        } else {
            setScanProgress(0);
        }
    }, [isActive]);

    const getSkillColor = (name: string) => {
        const colorMap: { [key: string]: string } = {
            'react js': '#61DBFB',
            'angular': '#DD0031',
            'next js': '#FFFFFF',
            'javascript': '#F7DF1E',
            'html': '#E34F26',
            'css': '#1572B6',
            'git': '#F05032',
            'ionic': '#4F8FF8',
            'firebase': '#FFC107'
        };
        return colorMap[name.toLowerCase()] || '#3b82f6';
    };

    const skillColor = getSkillColor(item.name);

    return (
        <div
            className="flex flex-col items-center justify-center p-6 bg-transparent transition-all duration-500 cursor-pointer relative min-h-[120px] group border border-green-400/20 rounded-lg backdrop-blur-sm overflow-hidden"
            style={{
                background: `linear-gradient(135deg, 
                    rgba(0, 255, 0, 0.02) 0%, 
                    rgba(0, 255, 0, 0.01) 50%, 
                    transparent 100%)`
            }}
        >
            {/* Matrix-style background grid */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div
                    className="w-full h-full"
                    style={{
                        backgroundImage: `
                            linear-gradient(90deg, transparent 0%, ${skillColor}22 50%, transparent 100%),
                            linear-gradient(0deg, transparent 0%, ${skillColor}22 50%, transparent 100%)
                        `,
                        backgroundSize: '8px 8px'
                    }}
                />
            </div>

            {/* Scanning line effect - only when active */}
            {isActive && (
                <div
                    className="absolute left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent transition-all duration-100"
                    style={{
                        top: `${scanProgress}%`,
                        opacity: 1,
                        boxShadow: `0 0 10px ${skillColor}`
                    }}
                />
            )}

            <div className="relative mb-4 flex items-center justify-center transition-all duration-500 z-10">
                {/* Glowing background - only when active */}
                {isActive && (
                    <div
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] rounded-full opacity-30 transition-all duration-500 z-0"
                        style={{
                            background: `radial-gradient(circle, ${skillColor}40 0%, transparent 70%)`,
                            boxShadow: `0 0 20px ${skillColor}60`
                        }}
                    />
                )}

                {/* Skill icon */}
                <Image
                    className={`relative z-10 transition-all duration-500 ${isActive ? 'scale-110' : ''}`}
                    src={item.url}
                    height={40}
                    width={40}
                    alt={item.name}
                    style={{
                        filter: isActive
                            ? `drop-shadow(0 0 8px ${skillColor}) contrast(1.1) brightness(1.1)`
                            : 'none'
                    }}
                />
            </div>

            {/* Terminal-style skill name */}
            <div className="text-center relative z-10">
                <h3 className={`text-sm font-medium text-slate-200 m-0 transition-all duration-300 font-mono ${isActive ? 'opacity-100 text-green-300' : 'opacity-80'}`}>
                    {item.name.toUpperCase()}
                </h3>

                {/* Proficiency bar - only visible when active */}
                {isActive && (
                    <div className="mt-2 w-16 h-1 bg-gray-700 rounded-full mx-auto overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{
                                width: `${item.proficiency}%`,
                                background: `linear-gradient(90deg, ${skillColor}, ${skillColor}aa)`,
                                boxShadow: `0 0 4px ${skillColor}`
                            }}
                        />
                    </div>
                )}

                {/* Experience indicator - only visible when active */}
                {isActive && (
                    <div className="text-xs text-green-300 font-mono mt-1 opacity-80 transition-opacity duration-300">
                        {item.exp} {item.exp_unit}
                    </div>
                )}
            </div>

            {/* Corner decorations */}
            <div className="absolute top-1 left-1 w-3 h-3 border-l-2 border-t-2 border-green-400 opacity-40"></div>
            <div className="absolute top-1 right-1 w-3 h-3 border-r-2 border-t-2 border-green-400 opacity-40"></div>
            <div className="absolute bottom-1 left-1 w-3 h-3 border-l-2 border-b-2 border-green-400 opacity-40"></div>
            <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-green-400 opacity-40"></div>
        </div>
    );
}

export default SKillCard;