import Carousel from "@/common/components/Carousel";
import Page from "@/common/components/Page";
import SKillCard from "@/common/components/SkillCard";
import { M_PLUS_Code_Latin } from "next/font/google";
import { FunctionComponent } from "react";
import { twMerge } from "tailwind-merge";

interface SkillsPageProps {

}

export const Skills = [
    {
        name: 'React Js',
        url: '/react.svg',
        proficiency: 85,
        exp: 5,
        exp_unit: 'yrs',
        color: '#61DBFB'
    },
    {
        name: 'Angular',
        url: '/angular.svg',
        proficiency: 85,
        exp: 5.5,
        exp_unit: 'yrs',
        color: '#DD0031'
    },
    {
        name: 'Next Js',
        url: '/next.svg',
        proficiency: 80,
        exp: 3,
        exp_unit: 'yrs',
        color: '#FFFFFF'
    },
    {
        name: 'Javascript',
        url: '/js.svg',
        proficiency: 90,
        exp: 6,
        exp_unit: 'yrs',
        color: '#F7DF1E'
    },
    {
        name: 'HTML',
        url: '/html5.svg',
        proficiency: 80,
        exp: 6,
        exp_unit: 'yrs',
        color: '#E34F26'
    },
    {
        name: 'CSS',
        url: '/css.svg',
        proficiency: 80,
        exp: 6,
        exp_unit: 'yrs',
        color: '#1572B6'
    },
    {
        name: 'Git',
        url: '/github.svg',
        proficiency: 70,
        exp: 6,
        exp_unit: 'yrs',
        color: '#F05032'
    },
    {
        name: 'Ionic',
        url: '/ionic.svg',
        proficiency: 70,
        exp: 6,
        exp_unit: 'yrs',
        color: '#4F8FF8'
    },
    {
        name: 'Firebase',
        url: '/firebase.svg',
        proficiency: 70,
        exp: 6,
        exp_unit: 'yrs',
        color: '#FFC107'
    },
]

const codeText = M_PLUS_Code_Latin({ subsets: ["latin"], weight: '400' });

const SkillsPage: FunctionComponent<SkillsPageProps> = () => {
    return (<Page
        id='skills'
        className={twMerge("p-3 border border-green-400 rounded-xl mt-3 h-full", codeText.className)}
    >
        <Carousel
            layout="skills"
            items={Skills.map((skill, i) => ({
                id: i,
                component: <SKillCard item={skill} />,
                skill: skill, // Add the skill data for the Carousel to use
                title: skill.name,
                description: `Master ${skill.name} with ${skill.exp} ${skill.exp_unit} of hands-on experience`,
                themeColor: skill.color,
                details: {
                    Proficiency: `${skill.proficiency}%`,
                    Experience: `${skill.exp} ${skill.exp_unit}`,
                    Category: 'Frontend Development',
                    'Skill Level': skill.proficiency >= 85 ? 'Expert' : skill.proficiency >= 70 ? 'Advanced' : 'Intermediate'
                }
            }))}
            autoRotate={true}
            autoRotateInterval={4000}
        />
    </Page>);
}

export default SkillsPage;