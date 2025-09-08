import AsciiArt from "@/common/components/AsciiArt";
import Page from "@/common/components/Page";
import { TextGlobe } from '@/common/components/TextGlobe';
import CareerTV from '@/common/components/CareerTV';
import Rotating3DObject from '@/common/components/Rotating3DObject';
import { M_PLUS_Code_Latin } from "next/font/google";
import { FunctionComponent } from "react";
import { Typewriter } from "react-simple-typewriter";
import { Skills } from "./SkillsPage";
import { twMerge } from "tailwind-merge";

interface AboutMePageProps {
    container: any
}

const codeText = M_PLUS_Code_Latin({ subsets: ["latin"], weight: '200' });

const AboutMePage: FunctionComponent<AboutMePageProps> = ({ container }) => {
    return <Page container={container} id='home' className="flex w-full gap-3 flex-col lg:flex-row">
        <div className="flex flex-1 gap-3 flex-col">
            <div className="h-full flex flex-col gap-3">
                <div className="flex h-fit border-1 border-green-400 p-3 rounded-xl gap-3 items-start justify-between flex-col lg:flex-row">
                    <div className="rounded-md w-[240px] h-[230px] border-green-400 tracking-[0.6px] border-animation">
                        <AsciiArt className='text-[3px] text-green-300 leading-relaxed rounded-md overflow-hidden' />
                    </div>
                    <div className="flex-1 text-green-400 flex flex-col gap-5 h-full justify-center">
                        <div>
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
                        </div>
                        <div className={twMerge(['text-[15px] text-justify', codeText.className])}>
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
                <div className="border-1 border-green-400 p-1 rounded-xl flex-1 relative overflow-hidden" id='home-canvas-1'>
                    <CareerTV />
                </div>
            </div>
        </div>
        <div className="flex flex-col gap-3">
            <div className="w-full lg:w-[350px] h-[350px] relative z-50 border-4 bg-green-950 rounded-xl bg-opacity-50 border-green-400">
                <TextGlobe texts={Skills.map(skill => ({ text: skill.name, url: skill.url }))} />
            </div>
            <div className="rounded-xl flex-1 border-1 border-green-400 p-3">
                <Rotating3DObject />
            </div>
        </div>
    </Page>;
}

export default AboutMePage;