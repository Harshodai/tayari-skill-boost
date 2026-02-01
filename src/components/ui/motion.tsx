import { motion, HTMLMotionProps, Variants } from "framer-motion";
import React from "react";

// Types
interface MotionProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    className?: string;
}

// Fade In Component
export const FadeIn = ({ children, delay = 0, duration = 0.5, className, ...props }: MotionProps) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration, delay, ease: "easeOut" }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
};

// Slide Up Component
export const SlideUp = ({ children, delay = 0, duration = 0.5, className, ...props }: MotionProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }} // Apple-like ease
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
};

// Stagger Container
interface StaggerProps extends MotionProps {
    staggerDelay?: number;
}

export const StaggerContainer = ({
    children,
    staggerDelay = 0.1,
    className,
    ...props
}: StaggerProps) => {
    const container: Variants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: staggerDelay
            }
        }
    };

    const item: Variants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1] } }
    };

    return (
        <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
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

// Scale In Component
export const ScaleIn = ({ children, delay = 0, duration = 0.4, className, ...props }: MotionProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
};
