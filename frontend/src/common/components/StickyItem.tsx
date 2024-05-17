import { CursorContext } from "@/app/SpotlightBackground";
import { motion } from "framer-motion"
import { DetailedHTMLProps, HTMLAttributes, MouseEvent, MutableRefObject, useContext, useLayoutEffect, useRef, useState } from "react"



const StickyItem = ({ children, className, ...props }: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => {
    const ref: MutableRefObject<HTMLDivElement | undefined> = useRef();
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const { setIsHovered, isHovered } = useContext(CursorContext)
    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (ref.current) {
            const { clientX, clientY } = e;
            const { width, height, left, top } = ref.current.getBoundingClientRect();
            const x = (clientX - (left + width / 2)) * 0.1;
            const y = (clientY - (top + height / 2)) * 0.1;
            setPosition({ x, y });
        }
    }

    const handleMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
        setPosition({ x: 0, y: 0 });
    }

    useLayoutEffect(() => {
        const onMouseEnter = () => {
            setIsHovered(true);
        }

        const onMouseLeave = () => {
            setIsHovered(false);
        }
        ref.current?.addEventListener('mouseenter', onMouseEnter);
        ref.current?.addEventListener('mouseleave', onMouseLeave);
        () => {
            ref.current?.removeEventListener('mouseenter', onMouseEnter);
            ref.current?.addEventListener('mouseleave', onMouseLeave);
        }
    }, [])

    return <motion.div
        ref={ref as any}
        className={"relative p-5 cursor-pointer " + className}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={{ x: position.x, y: position.y }}
        transition={{ type: 'spring', damping: 20, stiffness: 2000, mass: 1 }}
        {...props as any}
    >
        <div className="bounds absolute left-0 top-0 h-full w-full"></div>
        {children}
    </motion.div>
}

export default StickyItem;