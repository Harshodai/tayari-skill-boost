import { describe, it, expect } from "bun:test";
import { loginSchema, signupSchema, contactSchema, passwordSchema } from "./schemas";

describe("Validation Schemas", () => {
    describe("Password Schema", () => {
        it("should reject short passwords", () => {
            const result = passwordSchema.safeParse("Short1!");
            expect(result.success).toBe(false);
        });

        it("should reject passwords without uppercase", () => {
            const result = passwordSchema.safeParse("lowercase1!");
            expect(result.success).toBe(false);
        });

        it("should reject passwords without special char", () => {
            const result = passwordSchema.safeParse("NoSpecial1");
            expect(result.success).toBe(false);
        });

        it("should accept valid passwords", () => {
            const result = passwordSchema.safeParse("ValidPass1!");
            expect(result.success).toBe(true);
        });
    });

    describe("Login Schema", () => {
        it("should validate correct email", () => {
            const result = loginSchema.safeParse({ email: "test@example.com", password: "password" });
            expect(result.success).toBe(true);
        });

        it("should reject invalid email", () => {
            const result = loginSchema.safeParse({ email: "invalid-email", password: "password" });
            expect(result.success).toBe(false);
        });
    });

    describe("Signup Schema", () => {
        it("should reject weak password in signup", () => {
            const result = signupSchema.safeParse({
                email: "test@example.com",
                password: "weak",
                fullName: "John Doe"
            });
            expect(result.success).toBe(false);
        });
    });
});
