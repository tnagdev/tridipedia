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

const codeText = M_PLUS_Code_Latin({ subsets: ["latin"], weight: '400' });

const SkillsPage: FunctionComponent<SkillsPageProps> = () => {
    return (<Page
        id='skills'
        className={twMerge("p-3 border-1 border-green-400 rounded-xl mt-3 h-full", codeText.className)}
    >
        <div className="text-[12px] flex">
            <div className="flex flex-col gap-3 flex-1">
                <span className="text-lg">Skills</span>
                <div className="flex flex-wrap gap-3">
                    {Skills.map((skill, i) => <SKillCard item={skill} key={skill.name} />)}
                </div>
            </div>
        </div>
    </Page>);
}

export default SkillsPage;