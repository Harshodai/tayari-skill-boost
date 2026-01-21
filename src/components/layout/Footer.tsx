import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Github, Twitter, Linkedin, Mail } from "lucide-react";
import { features } from "@/config/features";

export function Footer() {
  // Define links with visibility flags
  const footerSections = {
    product: [
      { label: "Resume Optimizer", href: "/resume", visible: true },
      { label: "Interview Prep", href: "/interview", visible: features.interviewPrep },
      { label: "Job Search", href: "/jobs", visible: features.jobSearch },
      { label: "Pricing", href: "/pricing", visible: features.pricing },
      { label: "Careers", href: "/careers", visible: features.careers },
      { label: "Blog", href: "/blog", visible: features.blog },
      { label: "Help Center", href: "/help", visible: features.help },
      { label: "Contact", href: "/contact", visible: true },
    ],
    company: [
      { label: "About Us", href: "/about", visible: true },
    ],
    support: [
      { label: "FAQ", href: "/faq", visible: true },
      { label: "Privacy Policy", href: "/privacy", visible: true },
      { label: "Terms of Service", href: "/terms", visible: true },
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Logo className="mb-4" />
            <p className="text-muted-foreground text-sm max-w-xs mb-6">
              AI-powered job preparation platform for software engineers. Land your dream job with optimized resumes, interview prep, and personalized job matching.
            </p>
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-accent hover:bg-primary/20 hover:text-primary transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-3">
              {footerSections.product
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
            <h4 className="font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-3">
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
            <h4 className="font-semibold text-foreground mb-4">Support</h4>
            <ul className="space-y-3">
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
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Job Tayari. All rights reserved.
          </p>
          <p className="text-muted-foreground text-sm">
            Made with ❤️ for software engineers
          </p>
        </div>
      </div>
    </footer>
  );
}
