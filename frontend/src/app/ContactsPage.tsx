import Page from "@/common/components/Page";
import { M_PLUS_Code_Latin } from "next/font/google";
import { FunctionComponent } from "react";
import { twMerge } from "tailwind-merge";

interface ContactsPageProps {

}

const codeText = M_PLUS_Code_Latin({ subsets: ["latin"], weight: '400' });
const ContactsPage: FunctionComponent<ContactsPageProps> = () => {
    return (<Page id='contacts' className={twMerge("p-3 border-1 border-green-400 rounded-xl mt-3 h-full", codeText.className)}>

    </Page>);
}

export default ContactsPage;