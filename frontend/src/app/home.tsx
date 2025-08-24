"use client"
import { useEffect } from "react";
import Effect from "@/common/particlesystem/Effect";
import SkillsPage from "./SkillsPage";
import AboutMePage from "./AboutMe";
import ExperiencePage from "./ExperiencePage";
import ContactsPage from "./ContactsPage";
import ProjectsPage from "@/app/ProjectsPage";



const HomePage = ({ container }: any) => {
    useEffect(() => {
    }, [])

    return <>
        <AboutMePage container={container} />
        <SkillsPage />
        <ExperiencePage />
        <ProjectsPage />
        <ContactsPage />
    </>
}

export default HomePage;