'use client';

import { useMotionTemplate, useScroll, useTransform } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from 'framer-motion';
import StickyItem from "@/common/components/StickyItem";
import { useRouter } from "next/navigation";
import Effect from "@/common/particlesystem/Effect";



export const useHeaderHeight = () => {
    const [height, setHeight] = useState(0);
    useEffect(() => {
        const header = document.getElementById('header');
        setHeight(header?.getBoundingClientRect().height || 0);
    }, [])
    return height;
}




const Header = ({ container }: any) => {
    const Graffiti = `
    ___________      .__    .___.__                  .___.__        
    \\__    ___/______|__| __| _/|__|_____   ____   __| _/|__|____   
      |    |  \\_  __ \\  |/ __ | |  \\____ \\_/ __ \\ / __ | |  \\__  \\  
      |    |   |  | \\/  / /_/ | |  |  |_> >  ___// /_/ | |  |/ __ \\_
      |____|   |__|  |__\\____ | |__|   __/ \\___  >____ | |__(____  /
                             \\/    |__|        \\/     \\/         \\/  `
    useEffect(() => {
    }, [])

    return <motion.div id='header' className={`flex flex-col justify-between items-center z-50 text-green-400 border-1 rounded-xl border-green-400`}>
        <div className="font-mono text-[8px] p-3">
            {Graffiti.split('\n').map(line => <pre key={line}>{line}</pre>)}
        </div>
    </motion.div>
}


export default Header;