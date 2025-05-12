'use client'

import { CircularProgress } from "@nextui-org/react";
import Image from "next/image";





const SKillCard = ({ item }: any) => {
    return <div className="flex items-center">
        <div className="relative">
            <CircularProgress
                aria-label="Loading..."
                classNames={{
                    svg: "w-[80px] h-[80px]",
                    indicator: `stroke-[#fff]`,
                    track: "stroke-white/0"
                }}
                value={item.proficiency}
                color="warning"
            />
            <Image className="absolute inset-0 self-center place-self-center" src={item.url} height={30} width={30} alt={item.name} />
        </div>
    </div>
}


export default SKillCard;