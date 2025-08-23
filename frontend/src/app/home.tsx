"use client"
import { useEffect } from "react";
import Effect from "@/common/particlesystem/Effect";
import SkillsPage from "./SkillsPage";
import AboutMePage from "./AboutMe";
import ExperiencePage from "./ExperiencePage";
import ContactsPage from "./ContactsPage";



const HomePage = ({ container }: any) => {
    useEffect(() => {
    }, [])

    return <>
        <AboutMePage container={container} />
        <SkillsPage />
        <ExperiencePage />
        <ContactsPage />
    </>
}

export default HomePage;