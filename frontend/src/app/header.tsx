'use client';

import { useMotionTemplate, useScroll, useTransform } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {motion} from 'framer-motion';
import StickyItem from "@/common/components/StickyItem";
import { useRouter } from "next/navigation";



export const useHeaderHeight = () => {
    const [height, setHeight] = useState(0);
    useEffect(() => {
        const header = document.getElementById('header');
        setHeight(header?.getBoundingClientRect().height || 0);
    }, [])
    return height;
}




const Header = ({container}: any) => {
    const Graffiti = `
    ___________      .__    .___.__                  .___.__        
    \\__    ___/______|__| __| _/|__|_____   ____   __| _/|__|____   
      |    |  \\_  __ \\  |/ __ | |  \\____ \\_/ __ \\ / __ | |  \\__  \\  
      |    |   |  | \\/  / /_/ | |  |  |_> >  ___// /_/ | |  |/ __ \\_
      |____|   |__|  |__\\____ | |__|   __/ \\___  >____ | |__(____  /
                             \\/    |__|        \\/     \\/         \\/  `
    const height = useHeaderHeight();
    const [active, setActive] = useState(0);
    const {scrollYProgress} =  useScroll({container: container});
    // const background = useMotionTemplate`rgba(8, 47, 73, ${scrollY})`;
    // const navigator = useRouter();
    const navItems = [
        {
            label: 'Home',
            link: '#home'
        },
        {
            label: 'Skills',
            link: '#skills'
        },
        {
            label: 'Experience',
            link: '#experience'
        },
        {
            label: 'Projects',
            link: '#project'
        },
        {
            label: 'Contact',
            link: '#contact'
        }
    ]

    const goToPage = (index: number) => {
        const main = document.querySelector(navItems[index].link);
        main?.scrollIntoView({behavior: 'smooth'});
        setActive(index)
    }

    scrollYProgress.on('change', (e) => {
        const totalPages = navItems.length;
        const eachPagePercent = 100 / totalPages;
        if (Math.floor((e * 100) / eachPagePercent) != active) {
            setActive(Math.floor((e * 100) / eachPagePercent))
        }
    })

    return <motion.div id='header' className={`bg-transparent font-sans top-0e py-[10px] flex flex-col justify-between items-start`}>
        <div className="font-mono text-[8px]">
            {Graffiti.split('\n').map(line => <pre key={line}>{line}</pre>)}
        </div>
        <div className="flex flex-col gap-5 flex-1 justify-center pl-10">
            {navItems.map((item, i) => <StickyItem key={item.label} className="hover:text-sky-500 hover:font-bold" onClick={() => {
                goToPage(i);
            }}>
                <div className={`h-[50px] w-[50px] flex justify-center items-center transition-all after:transition-all after:w-0 after:duration-300 ${i === active ? 'flex-col text-[18px] after:h-[2px] after:mt-1 after:w-4 after:bg-white after:rounded-sm' : ''}`}>{item.label}</div>
            </StickyItem>)}
        </div>
    </motion.div>
}


export default Header;