import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Database, Plus, Trash2, ShieldCheck, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface CustomQA {
  id: string;
  question: string;
  answer: string;
}

export const CandidateAnswerBank = () => {
  const [workAuth, setWorkAuth] = useState("Authorized to work in US without sponsorship");
  const [sponsorshipNeeded, setSponsorshipNeeded] = useState("No");
  const [noticePeriod, setNoticePeriod] = useState("2 weeks");
  const [desiredSalary, setDesiredSalary] = useState("$160,000 - $190,000 USD");
  const [linkedinUrl, setLinkedinUrl] = useState("https://linkedin.com/in/alexmercer");
  const [githubUrl, setGithubUrl] = useState("https://github.com/alexmercer");
  const [portfolioUrl, setPortfolioUrl] = useState("https://alexmercer.dev");
  const [locationPreference, setLocationPreference] = useState("Remote / Hybrid (San Francisco)");
  const [raceEthnicity, setRaceEthnicity] = useState("Decline to specify");
  const [genderIdentity, setGenderIdentity] = useState("Decline to specify");
  const [veteranStatus, setVeteranStatus] = useState("Not a veteran");
  const [disabilityStatus, setDisabilityStatus] = useState("No disability");

  const [customQAs, setCustomQAs] = useState<CustomQA[]>([
    { id: "1", question: "Why do you want to work here?", answer: "I am passionate about building high-availability AI systems and mission-critical software products that scale to millions of users." },
    { id: "2", question: "What is your biggest engineering achievement?", answer: "Architected a low-latency caching layer reducing backend API response time from 350ms to 45ms across 2M daily requests." },
  ]);

  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  const isCustomQAArray = (v: unknown): v is CustomQA[] =>
    Array.isArray(v) && v.every((item) =>
      typeof item === "object" && item !== null &&
      typeof (item as CustomQA).id === "string" &&
      typeof (item as CustomQA).question === "string" &&
      typeof (item as CustomQA).answer === "string"
    );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tayari_candidate_answer_bank");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.workAuth === "string") setWorkAuth(parsed.workAuth);
        if (typeof parsed.sponsorshipNeeded === "string") setSponsorshipNeeded(parsed.sponsorshipNeeded);
        if (typeof parsed.noticePeriod === "string") setNoticePeriod(parsed.noticePeriod);
        if (typeof parsed.desiredSalary === "string") setDesiredSalary(parsed.desiredSalary);
        if (typeof parsed.linkedinUrl === "string") setLinkedinUrl(parsed.linkedinUrl);
        if (typeof parsed.githubUrl === "string") setGithubUrl(parsed.githubUrl);
        if (typeof parsed.portfolioUrl === "string") setPortfolioUrl(parsed.portfolioUrl);
        if (typeof parsed.locationPreference === "string") setLocationPreference(parsed.locationPreference);
        if (typeof parsed.raceEthnicity === "string") setRaceEthnicity(parsed.raceEthnicity);
        if (typeof parsed.genderIdentity === "string") setGenderIdentity(parsed.genderIdentity);
        if (typeof parsed.veteranStatus === "string") setVeteranStatus(parsed.veteranStatus);
        if (typeof parsed.disabilityStatus === "string") setDisabilityStatus(parsed.disabilityStatus);
        if (isCustomQAArray(parsed.customQAs)) setCustomQAs(parsed.customQAs);
      }
    } catch {
      // ignore corrupt data
    }
  }, []);

  const handleSaveBank = () => {
    const payload = {
      workAuth,
      sponsorshipNeeded,
      noticePeriod,
      desiredSalary,
      linkedinUrl,
      githubUrl,
      portfolioUrl,
      locationPreference,
      raceEthnicity,
      genderIdentity,
      veteranStatus,
      disabilityStatus,
      customQAs,
    };
    localStorage.setItem("tayari_candidate_answer_bank", JSON.stringify(payload));
    toast.success("Candidate Answer Bank Saved!", {
      description: "Extension Auto-Fill will now use these validated master answers on application forms.",
    });
  };

  const handleAddCustomQA = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast.error("Please provide both question pattern and answer.");
      return;
    }
    setCustomQAs([...customQAs, { id: Date.now().toString(), question: newQuestion, answer: newAnswer }]);
    setNewQuestion("");
    setNewAnswer("");
    toast.success("Custom Q&A Added");
  };

  const handleRemoveCustomQA = (id: string) => {
    setCustomQAs(customQAs.filter((q) => q.id !== id));
  };

  return (
    <AppShell>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Candidate Answer Bank</h1>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Auto-Fill Memory
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Store standardized, high-conversion answers for complex job application portals (Workday, Greenhouse, Lever, Ashby).
            </p>
          </div>
          <Button onClick={handleSaveBank} className="gap-2">
            <Save className="w-4 h-4" /> Save Answer Bank
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Work Eligibility & Compensation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" /> Work Eligibility & Compensation
              </CardTitle>
              <CardDescription className="text-xs">
                Standard questions asked on 95% of job applications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Work Authorization Status</label>
                <Input value={workAuth} onChange={(e) => setWorkAuth(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Sponsorship Required?</label>
                  <Select value={sponsorshipNeeded} onValueChange={setSponsorshipNeeded}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="In Future">In Future</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Notice Period / Availability</label>
                  <Input value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Desired Annual Compensation</label>
                <Input value={desiredSalary} onChange={(e) => setDesiredSalary(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Location Preference</label>
                <Input value={locationPreference} onChange={(e) => setLocationPreference(e.target.value)} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Social Profiles & Web Links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" /> Web Links & Professional Profiles
              </CardTitle>
              <CardDescription className="text-xs">
                Links auto-inserted into ATS social fields.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <label className="text-xs font-medium text-muted-foreground">LinkedIn URL</label>
                <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">GitHub Profile</label>
                <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Personal Portfolio Website</label>
                <Input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Custom Behavioral Q&A Bank */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Custom Application Q&A Bank
              </CardTitle>
              <CardDescription className="text-xs">
                Add custom question keywords (e.g. "why work here", "biggest project") and preferred answers for smart extension matching.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                <div className="font-semibold text-xs text-foreground">Add Custom Question Rule</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="Question pattern (e.g. 'Why do you want to join us?')"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                  />
                  <Input
                    placeholder="Preferred Master Answer"
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={handleAddCustomQA} className="gap-2 mt-2">
                  <Plus className="w-4 h-4" /> Add Answer Rule
                </Button>
              </div>

              <div className="space-y-2">
                {customQAs.map((qa) => (
                  <div key={qa.id} className="flex items-start justify-between p-3 border rounded-lg bg-card text-sm">
                    <div className="space-y-1 pr-4">
                      <div className="font-semibold text-xs text-primary">{qa.question}</div>
                      <div className="text-xs text-muted-foreground">{qa.answer}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveCustomQA(qa.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default CandidateAnswerBank;
