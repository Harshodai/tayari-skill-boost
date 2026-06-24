import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { 
  Menu, 
  X, 
  LogOut, 
  LayoutDashboard, 
  Settings, 
  ChevronDown,
  FileText,
  Mail,
  Brain,
  Calendar,
  MessageSquare,
  Zap,
  Briefcase,
  Target,
  BookOpen,
  HelpCircle,
  Send
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { features } from "@/config/features";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ActivityButton } from "@/components/automation/ActivityButton";

function ListItem({ 
  to, 
  title, 
  children, 
  icon: Icon, 
  onClick 
}: { 
  to: string; 
  title: string; 
  children: React.ReactNode; 
  icon: React.ComponentType<any>; 
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block select-none rounded-lg p-2.5 leading-none no-underline outline-none transition-all duration-200 hover:bg-muted/80 focus:bg-muted/80 group/item"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/10 bg-primary/5 text-primary group-hover/item:border-primary/25 group-hover/item:bg-primary/10 transition-colors">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold text-foreground group-hover/item:text-primary transition-colors leading-tight">
          {title}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground/80 line-clamp-2 pl-[38px] leading-normal font-normal">
        {children}
      </p>
    </Link>
  );
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"features" | "resources" | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMouseEnter = (menu: "features" | "resources") => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(menu);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 150);
  };

  const handleToggleClick = (menu: "features" | "resources", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  // Close dropdown on navigation
  useEffect(() => {
    setActiveMenu(null);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
    navigate("/");
  };

  const getUserDisplayName = () => {
    if (!user) return "";
    return user.user_metadata?.name || user.email?.split("@")[0] || "User";
  };

  const getUserInitials = () => {
    const name = getUserDisplayName();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border/40 py-2.5 shadow-sm"
          : "bg-transparent py-4"
      )}
    >
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-12">
          {/* Column 1: Logo */}
          <Logo className="shrink-0" />

          {/* Column 2: Centered Desktop Navigation */}
          <nav className="hidden lg:flex items-center justify-center flex-1 mx-6 gap-1.5">
            {/* Features Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter("features")}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={(e) => handleToggleClick("features", e)}
                className={cn(
                  "inline-flex items-center gap-1.5 bg-transparent hover:bg-muted/50 rounded-full h-9 px-3.5 text-sm font-medium transition-all duration-200 outline-none select-none",
                  activeMenu === "features" || 
                  location.pathname.startsWith("/resume") || 
                  location.pathname.startsWith("/interview") || 
                  location.pathname.startsWith("/cover-letter") || 
                  location.pathname.startsWith("/communication")
                    ? "text-primary bg-primary/5 font-semibold"
                    : "text-muted-foreground/80 hover:text-foreground"
                )}
              >
                <span>Features</span>
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground/80 transition-transform duration-200", activeMenu === "features" && "rotate-180")} />
              </button>

              {/* Features Dropdown Card */}
              {activeMenu === "features" && (
                <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-[550px] bg-gradient-to-br from-card via-card to-primary/[0.03] backdrop-blur-lg border border-border/45 rounded-xl shadow-xl p-4 z-50 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    {features.resumeOptimizer && (
                      <ListItem to="/resume" title="Resume Optimizer" icon={FileText}>
                        Score and tailor your resume to clear applicant tracking systems.
                      </ListItem>
                    )}
                    {features.interviewAI && (
                      <ListItem to="/interview/prep" title="Interview Prep AI" icon={Brain}>
                        Practice live mock technical and behavioral interviews with real-time feedback.
                      </ListItem>
                    )}
                    {features.jobSearch && (
                      <ListItem to="/jobs/autopilot" title="AutoPilot Agent" icon={Zap}>
                        Automate background application workflows and outreach trackers.
                      </ListItem>
                    )}
                    {features.coverLetter && (
                      <ListItem to="/cover-letter" title="Cover Letter Writer" icon={Mail}>
                        Generate highly tailored, role-specific cover letters in seconds.
                      </ListItem>
                    )}
                    {features.interviewPrep && (
                      <ListItem to="/interview" title="Interview Board" icon={Calendar}>
                        Manage your applications, schedules, and historical review notes.
                      </ListItem>
                    )}
                    {features.communicationHub && (
                      <ListItem to="/communication" title="Communication Hub" icon={MessageSquare}>
                        Draft scripts for recruiter outreach, check-ins, and salary negotiations.
                      </ListItem>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Job Search Direct Link */}
            {features.jobSearch && (
              <Link
                to="/jobs"
                className={cn(
                  "inline-flex h-9 w-max items-center justify-center rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200 outline-none select-none",
                  location.pathname === "/jobs"
                    ? "text-primary bg-primary/5 font-semibold"
                    : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/50"
                )}
              >
                Job Search
              </Link>
            )}

            {/* Career Roadmap Direct Link */}
            {features.careerRoadmap && (
              <Link
                to="/roadmap"
                className={cn(
                  "inline-flex h-9 w-max items-center justify-center rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200 outline-none select-none",
                  location.pathname === "/roadmap"
                    ? "text-primary bg-primary/5 font-semibold"
                    : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/50"
                )}
              >
                Roadmap
              </Link>
            )}

            {/* Resources Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter("resources")}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={(e) => handleToggleClick("resources", e)}
                className={cn(
                  "inline-flex items-center gap-1.5 bg-transparent hover:bg-muted/50 rounded-full h-9 px-3.5 text-sm font-medium transition-all duration-200 outline-none select-none",
                  activeMenu === "resources" || 
                  location.pathname.startsWith("/blog") || 
                  location.pathname.startsWith("/faq") || 
                  location.pathname.startsWith("/contact")
                    ? "text-primary bg-primary/5 font-semibold"
                    : "text-muted-foreground/80 hover:text-foreground"
                )}
              >
                <span>Resources</span>
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground/80 transition-transform duration-200", activeMenu === "resources" && "rotate-180")} />
              </button>

              {/* Resources Dropdown Card */}
              {activeMenu === "resources" && (
                <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-[280px] bg-gradient-to-br from-card via-card to-primary/[0.03] backdrop-blur-lg border border-border/45 rounded-xl shadow-xl p-3 z-50 animate-fade-in">
                  <div className="flex flex-col gap-2">
                    {features.blog && (
                      <ListItem to="/blog" title="Career Blog" icon={BookOpen}>
                        Insights, guides, and tips on cracking interviews.
                      </ListItem>
                    )}
                    <ListItem to="/faq" title="FAQ" icon={HelpCircle}>
                      Frequently asked questions.
                    </ListItem>
                    <ListItem to="/contact" title="Contact Support" icon={Send}>
                      Get in touch with our team.
                    </ListItem>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Column 3: Actions */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <ThemeToggle />
            {user && <ActivityButton />}
            {user && (
              <div className="h-4 w-[1px] bg-border/40" aria-hidden="true" />
            )}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2.5 rounded-full hover:bg-muted border border-transparent hover:border-border/30">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[100px] truncate font-semibold text-xs tracking-tight text-foreground/90">
                      {getUserDisplayName()}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-1 border-border/40 shadow-lg rounded-xl">
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-semibold">{getUserDisplayName()}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-border/40" />
                  <DropdownMenuItem asChild>
                    <Link to="/review-queue" className="cursor-pointer py-2">
                      <LayoutDashboard className="w-4 h-4 mr-2.5 text-muted-foreground" />
                      Review Queue
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="cursor-pointer py-2">
                      <LayoutDashboard className="w-4 h-4 mr-2.5 text-muted-foreground" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer py-2">
                      <Settings className="w-4 h-4 mr-2.5 text-muted-foreground" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/40" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive focus:text-destructive cursor-pointer py-2"
                  >
                    <LogOut className="w-4 h-4 mr-2.5" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild className="rounded-full font-medium text-muted-foreground/80 hover:text-foreground text-sm">
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button size="sm" asChild className="rounded-full bg-foreground text-background hover:bg-foreground/90 text-sm font-medium px-4">
                  <Link to="/auth?mode=signup">Get Started</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="lg:hidden flex items-center gap-1.5">
            <ThemeToggle />
            <button
              className={cn(
                "p-2 rounded-full text-foreground transition-colors",
                "hover:bg-muted focus-visible:outline-none"
              )}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border/40 animate-fade-in bg-background/95 backdrop-blur-md absolute top-full left-0 right-0 shadow-lg max-h-[85vh] overflow-y-auto">
            <nav className="flex flex-col gap-5 px-4 pb-4">
              {/* Group 1: Features */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest px-3 mb-2">
                  Features
                </p>
                <div className="flex flex-col gap-1">
                  {features.resumeOptimizer && (
                    <Link
                      to="/resume"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5",
                        location.pathname === "/resume"
                          ? "text-primary bg-primary/5 font-semibold"
                          : "text-foreground/90 hover:bg-muted"
                      )}
                    >
                      <FileText className="w-4 h-4 text-primary" />
                      <span>Resume Optimizer</span>
                    </Link>
                  )}
                  {features.interviewAI && (
                    <Link
                      to="/interview/prep"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5",
                        location.pathname === "/interview/prep"
                          ? "text-primary bg-primary/5 font-semibold"
                          : "text-foreground/90 hover:bg-muted"
                      )}
                    >
                      <Brain className="w-4 h-4 text-primary" />
                      <span>Interview Prep AI</span>
                    </Link>
                  )}
                  {features.jobSearch && (
                    <Link
                      to="/jobs/autopilot"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5",
                        location.pathname === "/jobs/autopilot"
                          ? "text-primary bg-primary/5 font-semibold"
                          : "text-foreground/90 hover:bg-muted"
                      )}
                    >
                      <Zap className="w-4 h-4 text-primary" />
                      <span>AutoPilot Agent</span>
                    </Link>
                  )}
                  {features.coverLetter && (
                    <Link
                      to="/cover-letter"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5",
                        location.pathname === "/cover-letter"
                          ? "text-primary bg-primary/5 font-semibold"
                          : "text-foreground/90 hover:bg-muted"
                      )}
                    >
                      <Mail className="w-4 h-4 text-primary" />
                      <span>Cover Letter Writer</span>
                    </Link>
                  )}
                  {features.interviewPrep && (
                    <Link
                      to="/interview"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5",
                        location.pathname === "/interview"
                          ? "text-primary bg-primary/5 font-semibold"
                          : "text-foreground/90 hover:bg-muted"
                      )}
                    >
                      <Calendar className="w-4 h-4 text-primary" />
                      <span>Interview Board</span>
                    </Link>
                  )}
                  {features.communicationHub && (
                    <Link
                      to="/communication"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5",
                        location.pathname === "/communication"
                          ? "text-primary bg-primary/5 font-semibold"
                          : "text-foreground/90 hover:bg-muted"
                      )}
                    >
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <span>Communication Hub</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Group 2: Core Paths */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest px-3 mb-2">
                  Explore
                </p>
                <div className="flex flex-col gap-1">
                  {features.jobSearch && (
                    <Link
                      to="/jobs"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5",
                        location.pathname === "/jobs"
                          ? "text-primary bg-primary/5 font-semibold"
                          : "text-foreground/90 hover:bg-muted"
                      )}
                    >
                      <Briefcase className="w-4 h-4 text-primary" />
                      <span>Job Search</span>
                    </Link>
                  )}
                  {features.careerRoadmap && (
                    <Link
                      to="/roadmap"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5",
                        location.pathname === "/roadmap"
                          ? "text-primary bg-primary/5 font-semibold"
                          : "text-foreground/90 hover:bg-muted"
                      )}
                    >
                      <Target className="w-4 h-4 text-primary" />
                      <span>Career Roadmap</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Group 3: Resources */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest px-3 mb-2">
                  Resources
                </p>
                <div className="flex flex-col gap-1">
                  {features.blog && (
                    <Link
                      to="/blog"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5",
                        location.pathname === "/blog"
                          ? "text-primary bg-primary/5 font-semibold"
                          : "text-foreground/90 hover:bg-muted"
                      )}
                    >
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span>Career Blog</span>
                    </Link>
                  )}
                  <Link
                    to="/faq"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5",
                      location.pathname === "/faq"
                        ? "text-primary bg-primary/5 font-semibold"
                        : "text-foreground/90 hover:bg-muted"
                    )}
                  >
                    <HelpCircle className="w-4 h-4 text-primary" />
                    <span>FAQ</span>
                  </Link>
                  <Link
                    to="/contact"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5",
                      location.pathname === "/contact"
                        ? "text-primary bg-primary/5 font-semibold"
                        : "text-foreground/90 hover:bg-muted"
                    )}
                  >
                    <Send className="w-4 h-4 text-primary" />
                    <span>Contact Support</span>
                  </Link>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col gap-2 pt-4 mt-2 border-t border-border/40">
                {user ? (
                  <>
                    <div className="px-3 py-2 flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{getUserDisplayName()}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Link
                      to="/review-queue"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2.5"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Review Queue
                    </Link>
                    <Link
                      to="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2.5"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2.5"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        handleSignOut();
                        setMobileMenuOpen(false);
                      }}
                      className="justify-start text-destructive hover:text-destructive hover:bg-destructive/5 rounded-lg px-3 py-2 h-auto text-sm font-medium flex items-center gap-2.5"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 px-1">
                    <Button variant="ghost" asChild className="justify-center rounded-lg text-sm">
                      <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                    </Button>
                    <Button asChild className="justify-center rounded-lg bg-foreground text-background hover:bg-foreground/90 text-sm">
                      <Link to="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
