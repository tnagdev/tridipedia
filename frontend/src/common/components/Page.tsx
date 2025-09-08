import { FunctionComponent } from "react";
import { motion } from 'framer-motion'
import { twMerge } from "tailwind-merge";

type PageProps = {
    container?: any,
} & any;

const Page: FunctionComponent<PageProps> = ({ container, children, className, ...props }) => {

    return (<motion.div
        id="home"
        className={twMerge(["relative flex lg:h-full p-0", className])}
        {...props}
    >
        {children}
    </motion.div>);
}

export default Page;