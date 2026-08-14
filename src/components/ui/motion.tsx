import { motion, HTMLMotionProps, Variants, useReducedMotion } from "framer-motion";
import React from "react";

interface MotionProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

const easeOut = [0.22, 1, 0.36, 1] as const;

export const FadeIn = ({ children, delay = 0, duration = 0.42, className, ...props }: MotionProps) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ duration: reduceMotion ? 0 : duration, delay: reduceMotion ? 0 : delay, ease: easeOut }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const SlideUp = ({ children, delay = 0, duration = 0.46, className, ...props }: MotionProps) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ duration: reduceMotion ? 0 : duration, delay: reduceMotion ? 0 : delay, ease: easeOut }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

interface StaggerProps extends MotionProps {
  staggerDelay?: number;
}

export const StaggerContainer = ({
  children,
  staggerDelay = 0.07,
  className,
  ...props
}: StaggerProps) => {
  const reduceMotion = useReducedMotion();
  const container: Variants = {
    hidden: { opacity: reduceMotion ? 1 : 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: reduceMotion ? 0 : staggerDelay },
    },
  };
  const item: Variants = {
    hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.34, ease: easeOut } },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-48px" }}
      variants={container}
      className={className}
      {...props}
    >
      {React.Children.map(children, (child) => (
        <motion.div variants={item}>{child}</motion.div>
      ))}
    </motion.div>
  );
};

export const ScaleIn = ({ children, delay = 0, duration = 0.38, className, ...props }: MotionProps) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ duration: reduceMotion ? 0 : duration, delay: reduceMotion ? 0 : delay, ease: easeOut }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};
