import AsciiArt from "@/common/components/AsciiArt";
import Page from "@/common/components/Page";
import { TextGlobe } from "@/common/components/TextGlobe";
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
            <div>
                <div className="flex border-1 border-red-400 p-3 rounded-xl gap-3 items-start lg:items-center flex-col lg:flex-row">
                    <div className="rounded-md border-red-400 tracking-[0.6px] border-animation">
                        <AsciiArt className='text-[2px] text-blue-400 leading-relaxed rounded-md overflow-hidden' />
                    </div>
                    <div className="flex-1 text-red-400">
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
                        <div className={twMerge(['text-[15px] mt-5 text-justify', codeText.className])}>
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
            <div className="border-1 border-red-400 p-3 rounded-xl flex-1" id='home-canvas-1'>

            </div>
        </div>
        <div className="flex flex-col gap-3">
            <div className="w-full lg:w-[350px] h-[350px] relative z-50 border-4 bg-blue-950 rounded-xl bg-opacity-50 border-blue-400">
                <TextGlobe texts={Skills.map(skill => ({ text: skill.name, url: skill.url }))} />
            </div>
            <div className="rounded-xl flex-1 border-1 border-red-400 p-3">
                adkjahkj
            </div>
        </div>
    </Page>;
}

export default AboutMePage;