"use client"

import { TextGlobe } from "@/common/components/TextGlobe";
import { Character } from "@/common/components/Character";
import { Typewriter } from 'react-simple-typewriter';
import { M_PLUS_Code_Latin, Press_Start_2P } from "next/font/google";
import Image from "next/image";
import SKillCard from "@/common/components/SkillCard";
import moment from "moment";

const codeText = M_PLUS_Code_Latin({ subsets: ["latin"], weight: '400' });



const HomePage = () => {
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
        <div id="home" className="flex justify-center h-[100vh]">
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
                        new JS libraries as they keep popping up every now and then. I have also built a number of Cross-platform Mobile Applications
                        using Ionic and React Native. 
                        I love creative coding with JS and also love to build delightful interactive and animated user interfaces.
                    </div>
                </div>
            </div>
        </div>
        <div id='skills' className="flex h-[100vh] items-center p-5\
        ">
            <div className="flex-1 flex items-start text-[12px] flex-col">
                <div className="flex items-center py-5 justify-center">
                    <Image src={require('./../../public/pika.gif')} height={90} width={90} alt='pikachu' />
                    <span>Skills are pokemons<br />Gotta catch&apos;em all</span>
                </div>
                <div className="flex flex-row gap-3 flex-wrap">
                    {skills.map((skill, i) => <SKillCard item={skill} key={skill.name}/>)}
                </div>
            </div>
            <div className="w-[30vw] h-[30vw]">
                <TextGlobe texts={skills.map(skill => ({ text: skill.name, url: skill.url }))} />
            </div>
        </div>
        <div id='experience' className="flex h-[100vh] items-center p-5">
            
        </div>
        <div id='project' className="flex h-[100vh]">
            
        </div>
        <div id='contact' className="flex h-[100vh]">
            
        </div>
    </>
}

export default HomePage;