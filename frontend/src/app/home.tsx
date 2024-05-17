"use client"

import { TextGlobe } from "@/common/components/TextGlobe";
import { Character } from "@/common/components/Character";
import { Typewriter } from 'react-simple-typewriter';
import { M_PLUS_Code_Latin, Press_Start_2P } from "next/font/google";

const codeText = M_PLUS_Code_Latin({ subsets: ["latin"], weight: '400' });



const HomePage = () => {
    const skills = [
        { name: 'React Js', url: '/react.svg' },
        { name: 'Angular', url: '/angular.svg' },
        { name: 'Next Js', url: '/next.svg' },
        { name: 'JavaScript', url: '/js.svg' },
        { name: 'HTML', url: '/html5.svg' },
        { name: 'CSS', url: '/css.svg' },
        { name: 'Git', url: '/github.svg' },
    ]

    const SocialProfiles = {

    }

    return <>
        <div id="home" className="flex w-full justify-center h-[100vh]">
            <div className="flex items-center w-full">
                <div className="w-[15vw] h-[40vw] relative z-50">
                    <Character />
                </div>
                <div className="flex-1">
                    <div className="text-[20px]">{'> '}<Typewriter
                        words={['Welcome to Tridipedia', 'Hello! I am Tridibesh']}
                        cursor
                        cursorBlinking={true}
                        loop={1}
                        cursorStyle={'_'}
                        typeSpeed={80}
                    />!</div>
                    <div className={"text-[18px]"}>{'> '}I am a <Typewriter
                        words={['Web', 'JavaScript', 'Frontend', 'FullStack', 'Mobile Application']}
                        cursor
                        cursorBlinking={true}
                        loop={false}
                        cursorStyle={'_'}
                        typeSpeed={120}
                    />Developer</div>
                    <div className={codeText.className + ' text-[15px] mt-10 w-[50vw]'}>
                        I am a passionate FrontEnd Developer from India, currently working at CBNITS as Lead FrontEnd Developer. 
                        I&apos;ve been building stuff on the web since 2018 (6 yrs). I am a fan of JavaScript and it gives me immense joy to try out
                        new JS libraries as they keep popping up every now and then. I have also built a number of Cross-platform Mobile Application
                        Developer using Ionic and React Native. 
                        I love creative coding with JS and also love to build delightful interactive and animated user interfaces.
                    </div>
                </div>
            </div>
        </div>
        <div id='skills' className="flex h-[100vh]">
            <div className="flex-1"></div>
            <div className="h-[30vw] w-[30vw]">
                <TextGlobe texts={skills.map(skill => ({ text: skill.name, url: skill.url }))} />
            </div>
        </div>
        <div id='project' className="flex h-[100vh]">
            <div className="flex-1"></div>
            <div className="h-[30vw] w-[30vw]">
                <TextGlobe texts={skills.map(skill => ({ text: skill.name, url: skill.url }))} />
            </div>
        </div>
        <div id='contact' className="flex h-[100vh]">
            <div className="flex-1"></div>
            <div className="h-[30vw] w-[30vw]">
                <TextGlobe texts={skills.map(skill => ({ text: skill.name, url: skill.url }))} />
            </div>
        </div>
    </>
}

export default HomePage;