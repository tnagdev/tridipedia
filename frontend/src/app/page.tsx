"use client"

import { useEffect, useRef, useState } from "react";
import HomePage from './home';
import Header from "./header";
import SpotlightBackground, { CursorContext } from "./SpotlightBackground";
import SideBar from "@/common/components/Sidebar";
import Effect from "@/common/particlesystem/Effect";


export default function Home() {
  const containerRef = useRef();
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
  }, [])

  return (
    <CursorContext.Provider value={{ isHovered, setIsHovered }}>
      <SpotlightBackground />
      <main className="absolute inset-0 h-[100vh] w-[100vw] z-10 flex flex-col p-3 gap-3">
        <Header container={containerRef} />
        <div className="flex flex-row flex-1 gap-3 h-[1px]" id='animation'>
          <SideBar container={containerRef as any} />
          <div ref={containerRef as any} id='main-container' className="overflow-auto flex-1 z-10 text-green-400 perspective-1200">
            <HomePage container={containerRef} />
          </div>
        </div>
      </main>
    </CursorContext.Provider>
  );
}
