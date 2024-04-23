"use client"

import { useWindowSize } from "@/common/hooks/useDocumentSize";
import { motion, useMotionTemplate, useMotionValue, useTransform } from "framer-motion";
import Image from "next/image";
import resolveConfig from 'tailwindcss/resolveConfig'
import tailwindConfig from './../../tailwind.config';
import { useLayoutEffect } from "react";
import Lottie from "lottie-react";
import animation from './../../public/lazy_developer.json';
import { TextGlobe } from "@/common/components/TextGlobe";
import { Character } from "@/common/components/Character";
import { Typewriter } from 'react-simple-typewriter';
import { M_PLUS_Code_Latin, Press_Start_2P } from "next/font/google";

const codeText = M_PLUS_Code_Latin({ subsets: ["latin"], weight: '400' });

export default function Home() {
  const styleConfig = resolveConfig(tailwindConfig)
  const { height, width } = useWindowSize();
  const mouseX = useMotionValue(Math.floor(width / 2));
  const mouseY = useMotionValue(Math.floor(height / 2));
  const x = useTransform(mouseX, [0, width], [0, 100]);
  const y = useTransform(mouseY, [0, height], [0, 100]);
  const background = useMotionTemplate`radial-gradient(600px at ${x}% ${y}%, ${styleConfig.theme.colors.sky[900]}, transparent 80%)`;
  const skills = [
    { name: 'React Js', url: '/react.svg' },
    { name: 'Angular', url: '/angular.svg' },
    { name: 'Next Js', url: '/next.svg' },
    { name: 'JavaScript', url: '/js.svg' },
    { name: 'HTML', url: '/html5.svg' },
    { name: 'CSS', url: '/css.svg' },
    { name: 'Git', url: '/github.svg' },
  ]

  useLayoutEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mouseX.set(event.x);
      mouseY.set(event.y);
    }
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    }
  })

  return (
    <main className="h-full w-full bg-sky-950">
      <motion.div className="h-full w-full overflow-auto" style={{ background: background }}>
        <div className="flex w-100 justify-center">
          <div className="flex items-start w-[70vw]">
            <div className="w-[40vw] h-[40vw] ml-[-14vw] mr-[-12vw] mt-[-6vh]">
              <Character />
            </div>
            <div className="flex-1 mt-20">
              <div className="text-[35px]"><Typewriter
                words={['Welcome to Tridipedia', 'Hello! I am Tridibesh']}
                cursor
                cursorBlinking={true}
                loop={1 }
                cursorStyle={'_'}
                typeSpeed={80}
              />!</div>
              <div className={"text-[20px]"}>I am a <Typewriter
                words={['Web', 'JavaScript', 'Frontend', 'FullStack', 'Mobile Application'].map(e => e + ' Developer')}
                cursor
                cursorBlinking={true}
                loop={false}
                cursorStyle={'_'}
                typeSpeed={120}
              /></div>
              <div className={codeText.className + ' text-[15px] mt-10 w-[50vw]'}>
                Working as a Frontend Web and Hybrid Mobile Application Developer for past 5½
                years. I am experienced in working with SAAS product-based company
                (Netskope) as a full stack UI Engineer. I always like to learn and keep myself
                updated with modern technologies. I am looking for opportunities where I can
                learn and also will get opportunities to try out new technologies to promote my
                organizational goals as well as personal ones.
              </div>
            </div>
          </div>
        </div>
        <div className="h-[30vw] w-[30vw]">
          <TextGlobe texts={skills.map(skill => ({ text: skill.name, url: skill.url }))} />
        </div>
      </motion.div>
    </main>
  );
}
