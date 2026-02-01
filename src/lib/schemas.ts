import { z } from "zod";

export const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: passwordSchema,
    fullName: z.string().min(2, "Full name must be at least 2 characters").max(50, "Full name must be less than 50 characters"),
});

export const contactSchema = z.object({
    name: z.string().min(2, "Name is too short").max(50, "Name is too long"),
    email: z.string().email("Invalid email address"),
    message: z.string().min(10, "Message must be at least 10 characters").max(1000, "Message is too long"),
});

export const resumeUploadSchema = z.object({
    file: z.instanceof(File)
        .refine((file) => file.size <= 5 * 1024 * 1024, "File size limit is 5MB")
        .refine(
            (file) => ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type),
            "Only PDF and DOCX files are allowed"
        ),
});

export const blogPostSchema = z.object({
    title: z.string().min(5).max(100),
    excerpt: z.string().min(10).max(200),
    content: z.string().min(50),
    category: z.string(),
    tags: z.array(z.string()).optional(),
});

export const profileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be less than 50 characters"),
    phone: z.string().optional(),
    location: z.string().optional(),
    bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});
