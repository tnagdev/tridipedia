import React, { useState, useEffect } from 'react';
import SKillCard from './SkillCard';

interface CarouselItem {
    id: number;
    component: React.ReactNode;
    skill?: any; // Add skill data for SkillCard
    title: string;
    description?: string;
    details?: {
        [key: string]: any;
    };
    themeColor?: string;
}

interface CarouselProps {
    items: CarouselItem[];
    autoRotate?: boolean;
    autoRotateInterval?: number; // in milliseconds
    onItemSelect?: (item: CarouselItem) => void;
    layout?: 'default' | 'skills';
}

const Carousel: React.FC<CarouselProps> = ({
    items,
    autoRotate = false,
    autoRotateInterval = 3000,
    onItemSelect,
    layout = 'default',
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const selectedItem = items[currentIndex];

    useEffect(() => {
        if (autoRotate && items.length > 1) {
            const interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % items.length);
            }, autoRotateInterval);

            return () => clearInterval(interval);
        }
    }, [autoRotate, autoRotateInterval, items.length]);

    useEffect(() => {
        if (onItemSelect && selectedItem) {
            onItemSelect(selectedItem);
        }
    }, [selectedItem, onItemSelect]);

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev + 1) % items.length);
    };

    const containerClasses = layout === 'skills'
        ? "w-full h-full relative flex flex-col lg:flex-row"
        : "w-full h-screen relative flex flex-col text-white";

    const bannerClasses = layout === 'skills'
        ? "w-full lg:w-1/2 h-[65%] lg:h-full text-center overflow-hidden relative group"
        : "w-full h-[70%] text-center overflow-hidden relative group";

    const sliderClasses = "absolute transition-transform duration-600 ease-in-out z-[2] " +
        "w-[100px] h-[100px] top-[calc(40%-50px)] left-[calc(50%-50px)] "

    const detailsClasses = layout === 'skills'
        ? "w-full lg:w-1/2 h-[35%] lg:h-full p-5 lg:p-10 flex items-center justify-start overflow-y-auto relative"
        : "h-[30%] p-0 flex items-center justify-center relative overflow-hidden";

    return (
        <div className={containerClasses}>
            <div className={bannerClasses}>
                <div
                    className={sliderClasses}
                    style={{
                        transformStyle: 'preserve-3d',
                        transform: `perspective(1000px) rotateX(-16deg) rotateY(${-currentIndex * (360 / items.length)}deg)`,
                        '--quantity': items.length,
                        '--current-rotation': `${-currentIndex * (360 / items.length)}deg`
                    } as React.CSSProperties}
                >
                    {items.map((item, index) => (
                        <div
                            key={item.id}
                            className={`absolute transition-all duration-400 ${index === currentIndex ? 'z-10 scale-110' : ''}`}
                            style={{
                                '--position': index + 1,
                                transform: `rotateY(${(index) * (360 / items.length)}deg) translateZ(${index === currentIndex ? '300px' : '300px'})`,
                                background: 'transparent',
                                border: 'none',
                                boxShadow: 'none',
                                overflow: 'visible'
                            } as React.CSSProperties}
                        >
                            <div className="w-full h-full flex items-center justify-center p-0 relative overflow-visible">
                                {item.skill ? (
                                    <SKillCard item={item.skill} isActive={index === currentIndex} />
                                ) : (
                                    item.component
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Navigation Controls */}
                <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 gap-4 md:gap-5 z-10 hidden group-hover:flex">
                    <button
                        onClick={goToPrevious}
                        className="bg-white/10 border-2 border-white/30 rounded-full w-9 h-9 md:w-12 md:h-12 flex items-center justify-center cursor-pointer transition-all duration-300 text-white backdrop-blur-sm hover:bg-white/20 hover:border-white/50 hover:scale-110 active:scale-95"
                        aria-label="Previous item"
                    >
                        <svg width="20" height="20" className="md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>

                    <button
                        onClick={goToNext}
                        className="bg-white/10 border-2 border-white/30 rounded-full w-9 h-9 md:w-12 md:h-12 flex items-center justify-center cursor-pointer transition-all duration-300 text-white backdrop-blur-sm hover:bg-white/20 hover:border-white/50 hover:scale-110 active:scale-95"
                        aria-label="Next item"
                    >
                        <svg width="20" height="20" className="md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                {/* Indicators */}
                <div className="absolute bottom-16 md:bottom-20 left-1/2 transform -translate-x-1/2 hidden group-hover:flex gap-2 md:gap-2.5 z-10">
                    {items.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-2 h-2 md:w-3 md:h-3 rounded-full border-2 cursor-pointer transition-all duration-300 ${index === currentIndex
                                ? 'bg-white border-white'
                                : 'bg-transparent border-white/50 hover:border-white/80 hover:scale-125'
                                }`}
                            aria-label={`Go to item ${index + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* Selected Item Details */}
            {selectedItem && (
                <div
                    className={detailsClasses}
                    style={{
                        '--skill-color': selectedItem.themeColor || '#00FFFF',
                        borderColor: selectedItem.themeColor || '#00FFFF'
                    } as React.CSSProperties}
                >
                    <div className="w-full h-full gap-4 lg:gap-2.5 grid grid-cols-1 lg:grid-cols-1 items-center animate-slideInFromBottom z-10 p-4 lg:p-0">
                        <div className="flex flex-col justify-center">
                            <h3
                                className="text-3xl md:text-4xl lg:text-5xl font-black mb-2 lg:mb-3 leading-tight lg:leading-[0.9] font-mono tracking-tight relative"
                                style={{
                                    color: selectedItem.themeColor || '#00FF00',
                                    textShadow: `
                                        0 0 20px ${selectedItem.themeColor || '#00FF00'}, 
                                        0 0 40px ${selectedItem.themeColor || '#00FF00'}33,
                                        0 0 60px ${selectedItem.themeColor || '#00FF00'}22
                                    `,
                                    filter: 'brightness(1.1) contrast(1.1)'
                                }}
                            >
                                {selectedItem.title.toUpperCase()}

                                {/* Animated underline */}
                                <div
                                    className="absolute -bottom-1.5 lg:-bottom-2 left-0 w-[80px] lg:w-[120px] h-0.5 lg:h-1 rounded-sm"
                                    style={{
                                        background: `linear-gradient(90deg, ${selectedItem.themeColor || '#00FF00'}, transparent)`,
                                        boxShadow: `0 0 15px ${selectedItem.themeColor || '#00FF00'}`,
                                        animation: 'slideInFromBottom 0.8s ease-out'
                                    }}
                                />

                                {/* Glitch effect */}
                                <div
                                    className="absolute inset-0 opacity-30 animate-pulse"
                                    style={{
                                        background: `linear-gradient(45deg, transparent 30%, ${selectedItem.themeColor || '#00FF00'}11 50%, transparent 70%)`,
                                        animation: 'glitch 2s infinite alternate'
                                    }}
                                />
                            </h3>

                            {selectedItem.description && (
                                <p className="text-base lg:text-lg text-green-300 font-normal font-mono relative pl-3 lg:pl-5 mt-3">
                                    <div
                                        className="absolute left-0 top-1 lg:top-1.5 w-0.5 lg:w-1 rounded-sm"
                                        style={{
                                            height: 'calc(100% - 8px)',
                                            background: `linear-gradient(180deg, ${selectedItem.themeColor || '#00FF00'}, transparent)`,
                                            boxShadow: `0 0 4px ${selectedItem.themeColor || '#00FF00'}`
                                        }}
                                    />
                                    {selectedItem.description}
                                </p>
                            )}
                        </div>
                        {selectedItem.details && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 content-center">
                                {Object.entries(selectedItem.details).map(([key, value], index) => (
                                    <div key={key} className="relative p-4 lg:p-5 bg-gradient-to-br from-green-950/10 via-black/20 to-green-900/10 rounded-lg border border-green-400/20 backdrop-blur-xl transition-all duration-400 overflow-hidden flex flex-col justify-center min-h-[60px] lg:min-h-[80px] group hover:-translate-y-1 hover:shadow-xl hover:border-green-400/40"
                                        style={{
                                            animationDelay: `${index * 100}ms`,
                                            animation: 'slideInFromBottom 0.6s ease-out forwards'
                                        }}>
                                        {/* Matrix grid background */}
                                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                                            <div
                                                style={{
                                                    backgroundImage: `
                                                        linear-gradient(90deg, transparent 0%, ${selectedItem.themeColor || '#00FF00'}22 50%, transparent 100%),
                                                        linear-gradient(0deg, transparent 0%, ${selectedItem.themeColor || '#00FF00'}22 50%, transparent 100%)
                                                    `,
                                                    backgroundSize: '6px 6px',
                                                    width: '100%',
                                                    height: '100%'
                                                }}
                                            />
                                        </div>

                                        {/* Top scanning line - removed hover effect */}
                                        <span className="font-semibold text-green-300 uppercase text-xs tracking-wider mb-1 lg:mb-1.5 font-mono">
                                            {key}:
                                        </span>

                                        <span
                                            className="font-bold text-lg lg:text-xl font-mono leading-tight"
                                            style={{
                                                color: selectedItem.themeColor || '#00FF00',
                                                textShadow: `0 0 10px ${selectedItem.themeColor || '#00FF00'}66`,
                                                filter: 'brightness(1.1)'
                                            }}
                                        >
                                            {String(value)}
                                        </span>

                                        {/* Corner brackets for retro feel */}
                                        <div className="absolute top-1 left-1 w-2 h-2 border-l border-t border-green-400/40 transition-opacity duration-300 opacity-0 group-hover:opacity-100"></div>
                                        <div className="absolute top-1 right-1 w-2 h-2 border-r border-t border-green-400/40 transition-opacity duration-300 opacity-0 group-hover:opacity-100"></div>
                                        <div className="absolute bottom-1 left-1 w-2 h-2 border-l border-b border-green-400/40 transition-opacity duration-300 opacity-0 group-hover:opacity-100"></div>
                                        <div className="absolute bottom-1 right-1 w-2 h-2 border-r border-b border-green-400/40 transition-opacity duration-300 opacity-0 group-hover:opacity-100"></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Carousel;