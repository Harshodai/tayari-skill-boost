import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Github, Twitter, Linkedin, Mail } from "lucide-react";
import { features } from "@/config/features";
import { FadeIn } from "@/components/ui/motion";

export function Footer() {
  const footerSections = {
    solutions: [
      { label: "Resume Optimizer", href: "/resume", visible: true },
      { label: "Mock Interviews", href: "/interview", visible: features.interviewPrep },
      { label: "Job Search", href: "/jobs", visible: features.jobSearch },
      { label: "AutoPilot Chain", href: "/jobs/autopilot", visible: features.jobSearch },
    ],
    platform: [
      { label: "Desktop App", href: "/downloads", visible: true },
      { label: "Omnisave Reader", href: "/omnisave", visible: true },
      { label: "Pricing & Packs", href: "/pricing", visible: features.pricing },
      { label: "ATS Scan Tool", href: "/free-scan", visible: true },
    ],
    company: [
      { label: "About Us", href: "/about", visible: true },
      { label: "Careers", href: "/careers", visible: features.careers },
      { label: "Engineering Blog", href: "/blog", visible: features.blog },
      { label: "Privacy Policy", href: "/privacy", visible: true },
    ],
    support: [
      { label: "Help Center", href: "/help", visible: features.help },
      { label: "FAQ", href: "/faq", visible: true },
      { label: "Terms of Service", href: "/terms", visible: true },
      { label: "Contact Us", href: "/contact", visible: true },
    ],
  };

  const socialLinks = [
    { icon: Twitter, href: "https://twitter.com/jobtayari", label: "Twitter" },
    { icon: Linkedin, href: "https://linkedin.com/company/jobtayari", label: "LinkedIn" },
    { icon: Github, href: "https://github.com/jobtayari", label: "GitHub" },
    { icon: Mail, href: "mailto:hello@jobtayari.com", label: "Email" },
  ];

  return (
    <footer className="bg-card border-t border-border/50">
      <div className="container mx-auto px-4 py-12">
        <FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
            {/* Brand */}
            <div className="lg:col-span-2">
              <Logo className="mb-4" />
              <p className="text-muted-foreground text-sm max-w-xs mb-6 leading-relaxed">
                AI-assisted career operations for software engineers. Transparent, inspectable review steps before every submission.
              </p>
              <div className="flex items-center gap-3">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-9 h-9 rounded-lg border border-border/60 bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
                    aria-label={social.label}
                  >
                    <social.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Solutions Links */}
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-foreground mb-4">Solutions</h4>
              <ul className="space-y-2.5">
                {footerSections.solutions
                  .filter(link => link.visible)
                  .map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="text-muted-foreground hover:text-primary transition-colors text-sm"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>

            {/* Platform Links */}
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-foreground mb-4">Platform</h4>
              <ul className="space-y-2.5">
                {footerSections.platform
                  .filter(link => link.visible)
                  .map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="text-muted-foreground hover:text-primary transition-colors text-sm"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-foreground mb-4">Company</h4>
              <ul className="space-y-2.5">
                {footerSections.company
                  .filter(link => link.visible)
                  .map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="text-muted-foreground hover:text-primary transition-colors text-sm"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>

            {/* Support Links */}
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-foreground mb-4">Support</h4>
              <ul className="space-y-2.5">
                {footerSections.support
                  .filter(link => link.visible)
                  .map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="text-muted-foreground hover:text-primary transition-colors text-sm"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground text-xs">
              © {new Date().getFullYear()} Job Tayari. All rights reserved.
            </p>
            <p className="text-muted-foreground text-xs font-mono">
              Candidate-in-the-loop career platform
            </p>
          </div>
        </FadeIn>
      </div>
    </footer>
  );
}
