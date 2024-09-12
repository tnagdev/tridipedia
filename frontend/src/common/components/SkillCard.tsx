'use client'

import { CircularProgress } from "@nextui-org/react";
import Image from "next/image";
import StickyItem from "./StickyItem";
import Tilt from 'react-parallax-tilt';





const SKillCard = ({ item }: any) => {
    const defaultOptions = {
        reverse:        false,
        max:            35,
        perspective:    1000,
        scale:          1,
        speed:          1000,
        transition:     true,
        axis:           null,
        reset:          true,
        easing:         "cubic-bezier(.03,.98,.52,.99)",    // Easing on enter/exit.
        glare: true,
        'max-glare': 1
    }
    return <Tilt 
                tiltEnable={true}
                glareEnable={true}
                glareMaxOpacity={1}
                glareBorderRadius={'0.5rem'}
                transitionEasing="cubic-bezier(.03,.98,.52,.99)"
                className="flex flex-col items-center gap-2 p-3 rounded-lg shadow-medium bg-[#ffffff1a] shadow-[#00000080] border-t-[#ffffff1a] border-l-[#ffffff1a] border-t-[1px] border-l-[1px] backdrop-blur-sm"
        >
        <div className="relative">
            <CircularProgress
                aria-label="Loading..."
                classNames={{
                    svg: "w-[90px] h-[90px] drop-shadow-md",
                    indicator: "stroke-white",
                    track: "stroke-white/20"
                }}
                value={item.proficiency}
                color="warning"
            />
            <Image className="absolute inset-0 self-center place-self-center" src={item.url} height={30} width={30} alt={item.name} />
        </div>
        <div className="text-[10px] flex flex-col gap-1 text-center">
            <p>{item.name}</p>
            <p className="text-[8px]">Lvl: {item.proficiency}</p>
            <p className="text-[8px]">XP: {item.exp} {item.exp_unit}</p>
        </div>
    </Tilt>
}


export default SKillCard;