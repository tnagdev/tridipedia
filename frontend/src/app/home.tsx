"use client"

import { TextGlobe } from "@/common/components/TextGlobe";
import { Typewriter } from 'react-simple-typewriter';
import { M_PLUS_Code_Latin } from "next/font/google";
import Image from "next/image";
import SKillCard from "@/common/components/SkillCard";
import AsciiArt from "@/common/components/AsciiArt";
import { motion, useMotionTemplate, useScroll, useTransform } from 'framer-motion'
import { useEffect, useMemo, useRef } from "react";
import Effect from "@/common/particlesystem/Effect";

const codeText = M_PLUS_Code_Latin({ subsets: ["latin"], weight: '400' });

const HomePage = ({ container }: any) => {
    const { scrollYProgress } = useScroll({ container: container as any });
    const angle = useTransform(scrollYProgress, [0, 1], [0, 180]);
    angle.on('change', console.log)
    const template = useMotionTemplate`rotateX(${angle}deg)`;

    useEffect(() => {
        const effect = new Effect('home-canvas-1');
    }, [])

    const skills = [
        {
            name: 'React Js',
            url: '/react.svg',
            proficiency: 85,
            exp: 5,
            exp_unit: 'yrs'
        },
        {
            name: 'Angular',
            url: '/angular.svg',
            proficiency: 85,
            exp: 5.5,
            exp_unit: 'yrs'
        },
        {
            name: 'Next Js',
            url: '/next.svg',
            proficiency: 80,
            exp: 3,
            exp_unit: 'yrs'
        },
        {
            name: 'Javascript',
            url: '/js.svg',
            proficiency: 90,
            exp: 6,
            exp_unit: 'yrs'
        },
        {
            name: 'HTML',
            url: '/html5.svg',
            proficiency: 80,
            exp: 6,
            exp_unit: 'yrs'
        },
        {
            name: 'CSS',
            url: '/css.svg',
            proficiency: 80,
            exp: 6,
            exp_unit: 'yrs'
        },
        {
            name: 'Git',
            url: '/github.svg',
            proficiency: 70,
            exp: 6,
            exp_unit: 'yrs'
        },
        {
            name: 'Ionic',
            url: '/ionic.svg',
            proficiency: 70,
            exp: 6,
            exp_unit: 'yrs'
        },
        {
            name: 'Firebase',
            url: '/firebase.svg',
            proficiency: 70,
            exp: 6,
            exp_unit: 'yrs'
        },
    ]

    const experiences = [
        {
            company: 'CBNITS',
            startDate: new Date('05-08-2020'),
            endDate: 'Present',
            location: 'Kolkata, West Bengal',
            exp: 4,
            exp_unit: 'yrs',
            position: 'Lead Frontend Developer'
        },
        {
            company: 'Aponiar Solutions Pvt. Ltd.',
            startDate: new Date('02-07-2020'),
            endDate: new Date('07-07-2020'),
            location: 'Kolkata, West Bengal',
            exp: 2,
            exp_unit: 'yrs',
            position: 'Software Engineer'
        }
    ]

    const SocialProfiles = {

    }

    return <>
        <motion.div style={{ transform: template }} id="home" className="relative flex lg:h-full p-0">
            <div className="flex w-full gap-3 flex-col lg:flex-row">
                <div className="flex flex-1 gap-3 flex-col">
                    <div >
                        <div className="flex border-1 border-green-400 p-3 rounded-xl gap-3 items-start lg:items-center flex-col lg:flex-row">
                            <div className="rounded-md border-green-400 tracking-[0.6px] border-animation">
                                <AsciiArt className='text-[2px] leading-relaxed bg-green-900 bg-opacity-20 rounded-xl overflow-hidden' />
                            </div>
                            <div className="flex-1">
                                <div className="text-[15px]">{'> '}<Typewriter
                                    words={['Welcome to Tridipedia', 'Hello! I am Tridibesh']}
                                    cursor
                                    cursorBlinking={true}
                                    loop={1}
                                    cursorStyle={'_'}
                                    typeSpeed={80}
                                />!</div>
                                <div className={"text-[15px]"}>{'> '}I am a <Typewriter
                                    words={['Web', 'JS', 'Frontend', 'FullStack', 'App']}
                                    cursor
                                    cursorBlinking={true}
                                    loop={false}
                                    cursorStyle={'_'}
                                    typeSpeed={120}
                                />Developer</div>
                                <div className={codeText.className + ' text-[15px] mt-5 text-justify'}>
                                    {`>`} I am a passionate FrontEnd Developer from India, currently working at NextZen Minds as a Tech Lead.
                                    I&apos;ve been building stuff on the web since 2018 ({new Date().getFullYear() - 2018} yrs). I am a fan of JavaScript and it gives me immense joy to try out
                                    new JS libraries as they keep popping up every now and then. I have also built a number of Cross-platform Mobile Applications
                                    using Ionic and React Native.
                                    I love creative coding with JS and also love to build delightful interactive and animated user interfaces for fun!
                                    <Typewriter
                                        words={[]}
                                        cursor
                                        cursorBlinking={true}
                                        loop={1}
                                        cursorStyle={'_'}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="border-1 border-green-400 p-3 rounded-xl flex-1" id='home-canvas-1'>

                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="w-full lg:w-[350px] h-[350px] relative z-50 border-4 bg-green-950 rounded-xl bg-opacity-50 border-green-400">
                        <TextGlobe texts={skills.map(skill => ({ text: skill.name, url: skill.url }))} />
                    </div>
                    <div className="rounded-xl flex-1 border-1 border-green-400 p-3">
                        adkjahkj
                    </div>
                </div>
            </div>
        </motion.div>
        <div id='skills' className="p-3 border-1 border-green-400 rounded-xl mt-3 h-full">
            <div className="text-[12px]">
                <div className="flex items-center pb-5 justify-center">
                    <Image src={require('./../../public/pika.gif')} height={90} width={90} alt='pikachu' />
                    <span>Skills are pokemons<br />Gotta catch&apos;em all</span>
                </div>
                <div className="flex flex-wrap gap-3 max-w-3xl">
                    {skills.map((skill, i) => <SKillCard item={skill} key={skill.name} />)}
                </div>
            </div>
        </div>
        <div id='experience' className="flex items-center p-5 h-full">

        </div>
        <div id='project' className="flex h-full">

        </div>
        <div id='contact' className="flex h-full">

        </div>
    </>
}

export default HomePage;