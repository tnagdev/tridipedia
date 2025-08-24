import React, { ReactNode, useContext, useState } from 'react';
import StickyItem from './StickyItem';
import { useScroll } from 'framer-motion';
import { useHeaderHeight } from '@/app/header';
import { CursorContext } from '@/app/SpotlightBackground';


export const MenuItems = [
    {
        label: 'Home',
        link: '#home',
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
        link: '#projects'
    },
    {
        label: 'Contact',
        link: '#contacts'
    }
]


const SideBar = ({ container }: { container?: React.MutableRefObject<HTMLElement> }) => {
    const [active, setActive] = useState(0);

    const { scrollYProgress } = useScroll({ container: container });
    const { isHovered } = useContext(CursorContext)
    const headerheight = useHeaderHeight();
    // const background = useMotionTemplate`rgba(8, 47, 73, ${scrollY})`;
    // const navigator = useRouter();

    scrollYProgress.on('change', (e) => {
        const totalPages = MenuItems.length;
        const eachPagePercent = 100 / totalPages;
        if (Math.floor((e * 100) / eachPagePercent) != active) {
            setActive(Math.floor((e * 100) / eachPagePercent))
        }
    })

    const goToPage = (index: number) => {
        const main = document.querySelector(MenuItems[index].link);
        main?.scrollIntoView({ behavior: 'smooth' });
        setActive(index)
    }

    return (<div className={`flex flex-col gap-5 justify-center font-sans w-[15vw] min-w-[200px]`}>
        <div className=' text-green-400 border-green-400 border-1 h-full flex flex-col justify-center rounded-xl'>
            {MenuItems.map((item, i) => i == 0 ? null : <StickyItem key={item.label} className="hover:text-neutral-950 hover:font-bold" onClick={() => {
                goToPage(i);
            }}>
                <div className={`flex justify-center items-center transition-all after:transition-all after:w-0 after:duration-300 ${i == active ? isHovered ? 'after:bg-black' : 'after:bg-green-400' : ''} ${i === active ? 'flex-col text-[18px] after:h-[2px] after:mt-1 after:w-4 after:rounded-sm' : ''}`}>{item.label}</div>
            </StickyItem>)}
        </div>
    </div>)
}


export default SideBar;