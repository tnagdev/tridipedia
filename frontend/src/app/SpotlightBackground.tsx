"use client"

import { useWindowSize } from "@/common/hooks/useDocumentSize";
import { motion, transform, useAnimation, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import resolveConfig from 'tailwindcss/resolveConfig'
import tailwindConfig from '../../tailwind.config';
import { Dispatch, SetStateAction, createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { MathUtils } from "three";

const defaultContext: { isHovered: boolean, setIsHovered: any } = {
  isHovered: false,
  setIsHovered: (val: boolean) =>  null
}

export const CursorContext = createContext(defaultContext);

const SpotlightBackground = () => {
  const styleConfig = resolveConfig(tailwindConfig)
  const { height, width } = useWindowSize();
  const mouseX = useMotionValue(Math.floor(width / 2));
  const mouseY = useMotionValue(Math.floor(height / 2));
  const cursorAnimationOptions = { damping: 20, stiffness: 250, mass: 1 }
  const x = useSpring(useTransform(mouseX, [0, width], [0, 100]), cursorAnimationOptions);
  const y = useSpring(useTransform(mouseY, [0, height], [0, 100]), cursorAnimationOptions);
  const background = useMotionTemplate`radial-gradient(600px at ${x}% ${y}%, ${styleConfig.theme.colors.sky[900]}, transparent 80%)`;
  const { isHovered } = useContext(CursorContext);
  const pointerSize = isHovered ? 60 : 10;
  const cursorX = useSpring(useTransform(mouseX, (val) => val - pointerSize / 2), cursorAnimationOptions);
  const cursorY = useSpring(useTransform(mouseY, (val) => val - pointerSize / 2), cursorAnimationOptions);
  const stretchX = useMotionValue(1);
  const stretchY = useMotionValue(1);
  const rotateAngle = useMotionValue(0);

  useLayoutEffect(() => {
    const handleMouseMove = (event: any) => {
      if (isHovered) {
        const {left, top, width, height} = event.target?.getBoundingClientRect();
        const center = {x: left + width / 2, y: top + height / 2};
        const distance = {x: event.x - center.x, y: event.y - center.y};
        const absDistance = Math.max(Math.abs(distance.x), Math.abs(distance.y));
        const angle = MathUtils.radToDeg(Math.atan2(distance.y, distance.x))
        const scaleX = transform(absDistance, [0, width / 2], [1, 1.3])
        const scaleY = transform(absDistance, [0, height / 2], [1, 0.9])
        mouseX.set(center.x + distance.x * 0.1);
        mouseY.set(center.y + distance.y * 0.1);
        stretchX.set(scaleX);
        stretchY.set(scaleY);
        rotateAngle.set(angle);
      } else {
        mouseX.set(event.x);
        mouseY.set(event.y);
        stretchX.set(1);
        stretchY.set(1);
        rotateAngle.set(0);
      }
    }
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    }
  })

  return <motion.div className="absolute inset-0 z-0" style={{ background: background }}>
    <motion.div
      className="rounded-full bg-white absolute"
      style={{ top: cursorY, left: cursorX, scaleX: stretchX, scaleY: stretchY, rotate: rotateAngle  }}
      animate={{height: pointerSize, width: pointerSize }}
      transformTemplate={({rotate, scaleX, scaleY}) => `rotate(${rotate}) scaleX(${scaleX}) scaleY(${scaleY})`}
    ></motion.div>
  </motion.div>
}


export default SpotlightBackground;