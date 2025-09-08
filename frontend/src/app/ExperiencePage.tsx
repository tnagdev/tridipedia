import Page from "@/common/components/Page";
import Maze from "@/common/components/Maze";
import { M_PLUS_Code_Latin } from "next/font/google";
import { FunctionComponent } from "react";
import { twMerge } from "tailwind-merge";

interface ExperiencePageProps {

}

const codeText = M_PLUS_Code_Latin({ subsets: ["latin"], weight: '400' });

const ExperiencePage: FunctionComponent<ExperiencePageProps> = () => {
    const experiences = [
        {
            company: 'Aponiar Solutions Pvt. Ltd.',
            startDate: new Date('02-07-2018'),
            endDate: new Date('07-07-2020'),
            location: 'Kolkata, West Bengal',
            exp: 2,
            exp_unit: 'yrs',
            position: 'Software Engineer'
        },
        {
            company: 'CBNITS',
            startDate: new Date('05-08-2020'),
            endDate: new Date('31-08-2024'),
            location: 'Kolkata, West Bengal',
            exp: 4,
            exp_unit: 'yrs',
            position: 'Lead Frontend Developer'
        },
        {
            company: 'NextZen Minds',
            startDate: new Date('10-08-2024'),
            endDate: 'Present',
            location: 'Global Remote',
            exp: 1,
            exp_unit: 'yrs',
            position: 'Technical Lead'
        },
    ];

    return (
        <Page id='experience' className={twMerge("p-4 border-1 border-green-400 rounded-xl mt-3 h-full bg-black/90", codeText.className)}>
            <Maze experiences={experiences} className="w-full h-full" />
        </Page>
    );
}

export default ExperiencePage;