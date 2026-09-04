import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FadeIn, StaggerContainer } from "@/components/ui/motion";
import {
    Map,
    Target,
    Briefcase,
    ArrowRight,
    Check,
    Loader2,
    BookOpen,
    DollarSign,
    TrendingUp,
    Sparkles,
    Trophy,
    Award,
    AlertCircle,
    ArrowUpRight,
    Search,
    MapPin,
    BookmarkCheck,
    Compass
} from "lucide-react";
import { ScenarioPlanner } from "@/components/career/ScenarioPlanner";
import {
    listResumes,
    getSkillsGap,
    getLearningPath,
    getSalaryBenchmark,
    Resume,
    SkillsGapResponse,
    LearningRecommendation,
    SalaryBenchmarkResponse
} from "@/api";

const CareerRoadmap = () => {
    const { toast } = useToast();

    // Form inputs
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [selectedResumeId, setSelectedResumeId] = useState<string>("");
    const [targetRole, setTargetRole] = useState<string>("");
    const [location, setLocation] = useState<string>("");
    const [jobDescription, setJobDescription] = useState<string>("");

    // Loading & state
    const [loadingResumes, setLoadingResumes] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisStep, setAnalysisStep] = useState("");
    const [activeTab, setActiveTab] = useState<"skills" | "learning" | "salary" | "scenarios">("skills");

    // Analysis results
    const [skillsGap, setSkillsGap] = useState<SkillsGapResponse | null>(null);
    const [learningPath, setLearningPath] = useState<LearningRecommendation[]>([]);
    const [salaryBenchmark, setSalaryBenchmark] = useState<SalaryBenchmarkResponse | null>(null);

    // Load user's resumes on mount
    useEffect(() => {
        const fetchResumes = async () => {
            try {
                const list = await listResumes();
                setResumes(list);
                if (list.length > 0) {
                    // Set latest resume as default
                    setSelectedResumeId(String(list[0].id));
                }
            } catch (err: any) {
                console.error("Failed to fetch resumes:", err);
                toast({
                    variant: "destructive",
                    title: "Error fetching resumes",
                    description: err.message || "Failed to load resumes. Please check connection.",
                });
            } finally {
                setLoadingResumes(false);
            }
        };

        fetchResumes();
    }, [toast]);

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedResumeId) {
            toast({
                variant: "destructive",
                title: "Resume required",
                description: "Please select or upload a resume to run the skills gap analysis.",
            });
            return;
        }
        if (!targetRole.trim()) {
            toast({
                variant: "destructive",
                title: "Target role required",
                description: "Enter the role you want to evaluate before running the roadmap analysis.",
            });
            return;
        }

        setAnalyzing(true);
        setAnalysisStep("Fetching resume content...");

        try {
            const payload = {
                resume_id: parseInt(selectedResumeId),
                target_role: targetRole,
                location: location,
                job_description_text: jobDescription || undefined
            };

            setAnalysisStep("Comparing skills with standard O*NET & ESCO taxonomy...");
            const gapRes = await getSkillsGap(payload);
            setSkillsGap(gapRes);

            setAnalysisStep("Mapping high-quality learning resources to bridge your gaps...");
            const learnRes = await getLearningPath(payload);
            setLearningPath(learnRes.recommendations);

            setAnalysisStep("Retrieving real-time market salary benchmarks...");
            const salaryRes = await getSalaryBenchmark(payload);
            setSalaryBenchmark(salaryRes);

            toast({
                title: "Analysis complete!",
                description: `Successfully analyzed roadmap for ${targetRole}.`,
            });
            setActiveTab("skills");
        } catch (err: any) {
            console.error("Analysis error:", err);
            toast({
                variant: "destructive",
                title: "Analysis failed",
                description: err.message || "Something went wrong during the intelligence analysis.",
            });
        } finally {
            setAnalyzing(false);
            setAnalysisStep("");
        }
    };

    // Calculate dynamic matching level assessments
    const getMatchDescription = (score: number) => {
        if (score >= 80) return "Excellent fit! You possess the vast majority of core competencies for this role.";
        if (score >= 50) return "Good potential. You have solid adjacent skills but need to bridge a few key gaps.";
        return "Growth opportunity. Focusing on the missing core technical skills will significantly boost your readiness.";
    };

    // Helper for formatting salaries
    const formatCurrency = (val: number, curr: string) => {
        const symbol = curr === "USD" ? "$" : curr === "INR" ? "₹" : curr + " ";
        return symbol + val.toLocaleString();
    };

    // Group learning recommendations by skill
    const learningBySkill = learningPath.reduce((acc, curr) => {
        const key = curr.skill || "General Tech Skills";
        if (!acc[key]) acc[key] = [];
        acc[key].push(curr);
        return acc;
    }, {} as Record<string, LearningRecommendation[]>);

    return (
        <AppShell>
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Header section */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-3">
                            <Sparkles className="w-3.5 h-3.5" /> Intelligence Engine v1.2
                        </div>
                        <h1 className="text-3xl font-extrabold text-foreground tracking-tight font-display">
                            Career Intelligence Roadmap
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Analyze skills gaps against roles and job descriptions, unlock curated paths, and master salary benchmarks.
                        </p>
                    </div>
                </div>

                {/* Main grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: Input parameters */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <Card className="glass border-border/40 shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Target className="w-5 h-5 text-primary" /> Roadmap Setup
                                </CardTitle>
                                <CardDescription>Configure your career target variables.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingResumes ? (
                                    <div className="flex flex-col items-center justify-center py-8">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                                        <span className="text-sm text-muted-foreground">Loading resumes...</span>
                                    </div>
                                ) : resumes.length === 0 ? (
                                    <div className="text-center py-6 border border-dashed rounded-lg bg-muted/40 px-4">
                                        <AlertCircle className="w-8 h-8 text-warning mx-auto mb-2" />
                                        <h3 className="font-semibold text-sm text-foreground">No Resumes Found</h3>
                                        <p className="text-xs text-muted-foreground mt-1 mb-4">
                                            You must upload a resume to run the skills gap analysis.
                                        </p>
                                        <Button asChild size="sm" className="w-full">
                                            <Link to="/resume">Upload Resume</Link>
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleAnalyze} className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                Select Resume
                                            </label>
                                            <select
                                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                value={selectedResumeId}
                                                onChange={(e) => setSelectedResumeId(e.target.value)}
                                            >
                                                {resumes.map((r) => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.title} ({new Date(r.created_at).toLocaleDateString()})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                Target Role
                                            </label>
                                            <div className="relative">
                                                <Briefcase className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    className="pl-9"
                                                    placeholder="e.g. Backend Developer"
                                                    value={targetRole}
                                                    onChange={(e) => setTargetRole(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                Target Location
                                            </label>
                                            <div className="relative">
                                                <MapPin className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    className="pl-9"
                                                    placeholder="e.g. US, IN, remote"
                                                    value={location}
                                                    onChange={(e) => setLocation(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex gap-1.5 flex-wrap mt-1">
                                                {["US", "IN", "remote", "Europe"].map((loc) => (
                                                    <button
                                                        key={loc}
                                                        type="button"
                                                        onClick={() => setLocation(loc)}
                                                        className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted-hover text-muted-foreground border border-border/40"
                                                    >
                                                        {loc}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                Job Description (Optional)
                                            </label>
                                            <Textarea
                                                placeholder="Paste the target job description to match against exact requirements..."
                                                rows={4}
                                                value={jobDescription}
                                                onChange={(e) => setJobDescription(e.target.value)}
                                            />
                                        </div>

                                        <Button type="submit" className="w-full font-semibold shadow-md gap-2" disabled={analyzing}>
                                            {analyzing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Analyzing...
                                                </>
                                            ) : (
                                                <>
                                                    Analyze & Build Roadmap
                                                    <ArrowRight className="w-4 h-4" />
                                                </>
                                            )}
                                        </Button>

                                        {analyzing && (
                                            <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg animate-pulse">
                                                <p className="text-xs text-primary font-medium text-center">
                                                    {analysisStep}
                                                </p>
                                            </div>
                                        )}
                                    </form>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Analysis findings */}
                    <div className="lg:col-span-8">
                        {!skillsGap ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed rounded-xl bg-card/40 min-h-[400px]">
                                <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10 mb-4 animate-float">
                                    <Map className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-2">Ready to Map Your Career?</h3>
                                <p className="text-muted-foreground text-sm max-w-sm mb-6">
                                    Select your resume, type in your target job role, and build an automated skills-gap analysis report instantly.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Match Indicator Header */}
                                <Card className="border border-border/40 shadow-lg overflow-hidden bg-gradient-to-br from-card to-card/95">
                                    <div className="h-1.5 bg-gradient-to-r from-success via-warning to-destructive" style={{ transform: "scaleX(1)" }}></div>
                                    <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
                                        {/* Radial Meter */}
                                        <div className="relative flex items-center justify-center w-28 h-28 flex-shrink-0">
                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    r="42"
                                                    stroke="currentColor"
                                                    strokeWidth="8"
                                                    fill="transparent"
                                                    className="text-border opacity-25"
                                                />
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    r="42"
                                                    stroke="currentColor"
                                                    strokeWidth="8"
                                                    fill="transparent"
                                                    strokeDasharray={`${2 * Math.PI * 42}`}
                                                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - skillsGap.match_score / 100)}`}
                                                    className="text-primary transition-all duration-1000 ease-out"
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-2xl font-black text-foreground">{skillsGap.match_score}%</span>
                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Match</span>
                                            </div>
                                        </div>

                                        <div className="flex-1 text-center sm:text-left">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2 justify-center sm:justify-start">
                                                <h2 className="text-2xl font-bold tracking-tight text-foreground">{targetRole}</h2>
                                                <Badge variant="outline" className="w-fit mx-auto sm:mx-0">
                                                    {location}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                                                {getMatchDescription(skillsGap.match_score)}
                                            </p>
                                            <div className="flex gap-4 mt-4 text-xs text-muted-foreground justify-center sm:justify-start">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-success"></div>
                                                    <span>{skillsGap.matched_skills.length} Matched</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-warning"></div>
                                                    <span>{skillsGap.adjacent_skills.length} Adjacent</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-destructive"></div>
                                                    <span>{skillsGap.missing_skills.length} Missing</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Tabs Navigation */}
                                <div className="flex border-b border-border/80">
                                    {[
                                        { id: "skills", label: "Skills Gap Analysis", icon: Target },
                                        { id: "scenarios", label: "Scenario Roadmaps (WP-10)", icon: Compass },
                                        { id: "learning", label: "Personalized Course tracks", icon: BookOpen },
                                        { id: "salary", label: "Salary Benchmarking", icon: DollarSign },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setActiveTab(t.id as any)}
                                            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                                                activeTab === t.id
                                                    ? "border-primary text-primary"
                                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            <t.icon className="w-4 h-4" />
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Contents */}
                                <div className="min-h-[300px]">
                                    {activeTab === "skills" && (
                                        <FadeIn className="space-y-6">
                                            {/* Missing Skills Alert */}
                                            {skillsGap.missing_skills.length > 0 && (
                                                <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-start gap-3">
                                                    <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <h4 className="font-bold text-destructive text-sm">Critical Skill Gaps Identified</h4>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            To be competitive for {targetRole} roles, prioritize learning these missing core skills. Check the course tracks for curated resources.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Skills categorizations */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Matched skills */}
                                                <Card className="border border-border/40">
                                                    <CardHeader className="pb-3">
                                                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-success">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-success"></div> Matched Skills ({skillsGap.matched_skills.length})
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {skillsGap.matched_skills.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground italic">No exact skill matches detected yet.</p>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-2">
                                                                {skillsGap.matched_skills.map((skill) => (
                                                                    <Badge key={skill} variant="secondary" className="bg-success/10 text-success border border-success/20 hover:bg-success/15 font-mono text-xs">
                                                                        {skill}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>

                                                {/* Adjacent skills */}
                                                <Card className="border border-border/40">
                                                    <CardHeader className="pb-3">
                                                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-warning">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-warning"></div> Adjacent Skills ({skillsGap.adjacent_skills.length})
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {skillsGap.adjacent_skills.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground italic">No adjacent skills identified.</p>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-2">
                                                                {skillsGap.adjacent_skills.map((skill) => (
                                                                    <Badge key={skill} variant="secondary" className="bg-warning/10 text-warning border border-warning/20 hover:bg-warning/15 font-mono text-xs">
                                                                        {skill}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>

                                                {/* Missing skills */}
                                                <Card className="border border-border/40">
                                                    <CardHeader className="pb-3">
                                                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-destructive">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-destructive"></div> Missing Skills ({skillsGap.missing_skills.length})
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {skillsGap.missing_skills.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground italic">Amazing! No missing skills detected.</p>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-2">
                                                                {skillsGap.missing_skills.map((skill) => (
                                                                    <Badge key={skill} variant="secondary" className="bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 font-mono text-xs">
                                                                        {skill}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>

                                                {/* All required skills */}
                                                <Card className="border border-border/40">
                                                    <CardHeader className="pb-3">
                                                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-primary"></div> Target Competencies ({skillsGap.required_skills.length})
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {skillsGap.required_skills.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground italic">No competency requirements mapped.</p>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-2">
                                                                {skillsGap.required_skills.map((skill) => (
                                                                    <Badge key={skill} variant="secondary" className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 font-mono text-xs">
                                                                        {skill}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </FadeIn>
                                    )}

                                    {activeTab === "learning" && (
                                        <FadeIn className="space-y-6">
                                            {learningPath.length === 0 ? (
                                                <div className="text-center py-12 border border-dashed rounded-lg bg-card">
                                                    <BookmarkCheck className="w-12 h-12 text-success mx-auto mb-2" />
                                                    <h4 className="font-bold text-foreground">All Caught Up!</h4>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        No learning courses needed since you have no missing skill gaps.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    {Object.entries(learningBySkill).map(([skillName, resources]) => (
                                                        <div key={skillName} className="space-y-3">
                                                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-l-2 border-primary pl-2.5">
                                                                Resources for <span className="text-primary font-mono lowercase">{skillName}</span>
                                                            </h3>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {resources.map((res, i) => (
                                                                    <Card key={i} className="border border-border/30 hover:border-primary/20 card-hover overflow-hidden">
                                                                        <CardContent className="p-4 flex flex-col h-full justify-between">
                                                                            <div>
                                                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                                                    <span className="text-xs text-muted-foreground font-semibold">{res.provider}</span>
                                                                                    <div className="flex gap-1.5">
                                                                                        <Badge variant="outline" className={`text-[10px] uppercase font-bold py-0 ${
                                                                                            res.difficulty === "beginner" ? "text-success border-success/20 bg-success/5" :
                                                                                            res.difficulty === "intermediate" ? "text-warning border-warning/20 bg-warning/5" :
                                                                                            "text-destructive border-destructive/20 bg-destructive/5"
                                                                                        }`}>
                                                                                            {res.difficulty}
                                                                                        </Badge>
                                                                                        <Badge variant="outline" className={`text-[10px] uppercase font-bold py-0 ${
                                                                                            res.cost_type === "free" ? "text-success border-success/20 bg-success/5" : "text-primary border-primary/20 bg-primary/5"
                                                                                        }`}>
                                                                                            {res.cost_type}
                                                                                        </Badge>
                                                                                    </div>
                                                                                </div>
                                                                                <h4 className="font-bold text-foreground text-sm line-clamp-2 mb-3">
                                                                                    {res.title}
                                                                                </h4>
                                                                            </div>
                                                                            <Button asChild size="sm" variant="outline" className="w-full mt-2 text-xs font-semibold gap-1">
                                                                                <a href={res.url} target="_blank" rel="noopener noreferrer">
                                                                                    Start Learning
                                                                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                                                                </a>
                                                                            </Button>
                                                                        </CardContent>
                                                                    </Card>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </FadeIn>
                                    )}

                                    {activeTab === "salary" && salaryBenchmark && (
                                        <FadeIn className="space-y-6">
                                            <Card className="border border-border/40">
                                                <CardHeader>
                                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                                        <DollarSign className="w-5 h-5 text-primary" /> Market Salary Benchmark
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Historical range mappings for <strong className="text-foreground">{salaryBenchmark.role}</strong> in <strong className="text-foreground">{salaryBenchmark.location}</strong>.
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-8">
                                                    {/* Salary figures grid */}
                                                    <div className="grid grid-cols-3 gap-4 text-center">
                                                        <div className="p-3 bg-muted/40 border rounded-lg">
                                                            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Minimum</div>
                                                            <div className="text-lg md:text-xl font-bold text-foreground mt-1">
                                                                {formatCurrency(salaryBenchmark.salary_min, salaryBenchmark.currency)}
                                                            </div>
                                                        </div>
                                                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                                                            <div className="text-xs text-primary font-bold uppercase tracking-wider">Median</div>
                                                            <div className="text-lg md:text-xl font-extrabold text-primary mt-1">
                                                                {formatCurrency(salaryBenchmark.salary_median, salaryBenchmark.currency)}
                                                            </div>
                                                        </div>
                                                        <div className="p-3 bg-muted/40 border rounded-lg">
                                                            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Maximum</div>
                                                            <div className="text-lg md:text-xl font-bold text-foreground mt-1">
                                                                {formatCurrency(salaryBenchmark.salary_max, salaryBenchmark.currency)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Visual range bar */}
                                                    <div className="space-y-2 pt-2">
                                                        <div className="relative h-3 rounded-full bg-muted overflow-hidden border border-border/50">
                                                            <div
                                                                className="absolute h-full bg-gradient-to-r from-primary to-accent"
                                                                style={{
                                                                    left: "15%",
                                                                    right: "15%"
                                                                }}
                                                            ></div>
                                                            {/* Median tick */}
                                                            <div
                                                                className="absolute top-0 bottom-0 w-1.5 bg-foreground border border-background shadow-md"
                                                                style={{ left: "50%", transform: "translateX(-50%)" }}
                                                            ></div>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] text-muted-foreground px-1 font-mono">
                                                            <span>10th Percentile</span>
                                                            <span className="text-primary font-semibold">Median Target</span>
                                                            <span>90th Percentile</span>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 rounded-lg bg-muted/30 border text-xs text-muted-foreground space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <span>Currency:</span>
                                                            <strong className="text-foreground font-mono">{salaryBenchmark.currency}</strong>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span>Confidence Score:</span>
                                                            <strong className="text-foreground">{salaryBenchmark.confidence}</strong>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span>Data Origin:</span>
                                                            <strong className="text-foreground">Taxonomy & Market Scraper Engine (Aggregated Stats)</strong>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </FadeIn>
                                    )}

                                    {activeTab === "scenarios" && (
                                        <FadeIn>
                                            <div className="mt-4">
                                                <ScenarioPlanner />
                                            </div>
                                        </FadeIn>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
};

export default CareerRoadmap;
