"use client"

import { useRef, useState } from "react";
import HomePage from './home';
import Header, { useHeaderHeight } from "./header";
import SpotlightBackground, { CursorContext } from "./SpotlightBackground";


export default function Home() {
  const containerRef = useRef();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <CursorContext.Provider value={{isHovered, setIsHovered}}>
      <main className="h-full w-full relative bg-sky-950">
        <SpotlightBackground />
        <div className="h-full w-full z-10 relative flex">
          <Header container={containerRef} />
          <div ref={containerRef as any} id='main-container' className="overflow-auto flex-1">
            <HomePage />
          </div>
        </div>
      </main>
    </CursorContext.Provider>
);
}
