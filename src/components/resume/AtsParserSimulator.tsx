import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Building2,
  Briefcase,
  GraduationCap,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  User,
  Layers,
  Terminal,
  FileText,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  simulateAtsParsing,
  ATS_ENGINES,
  type AtsEngineType,
  type ContactField,
  type ParsedExperience,
  type ParsedEducation,
  type HazardFlag,
} from "@/lib/ats-simulator/parser";

interface AtsParserSimulatorProps {
  resumeText: string;
  benchmarkRole?: string;
}

const ENGINE_KEYS: AtsEngineType[] = ["workday", "greenhouse", "lever"];

export function AtsParserSimulator({ resumeText, benchmarkRole }: AtsParserSimulatorProps) {
  const [selectedEngine, setSelectedEngine] = useState<AtsEngineType>("workday");
  const [showRawBuffer, setShowRawBuffer] = useState(false);

  const simulation = useMemo(() => {
    return simulateAtsParsing(resumeText, selectedEngine);
  }, [resumeText, selectedEngine]);

  const {
    config,
    fidelityScore,
    overallStatus,
    identity,
    experiences,
    education,
    skillsBag,
    hazards,
    rawTextPreview,
  } = simulation;

  const activeHazards = hazards.filter((h) => h.detected);
  const cleanHazards = hazards.filter((h) => !h.detected);

  const getStatusBadge = (status: "clean" | "warning" | "failed", labelPrefix?: string) => {
    switch (status) {
      case "clean":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-medium inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> {labelPrefix ? `${labelPrefix}: Clean Extraction` : "Clean Extraction"}
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-medium inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {labelPrefix ? `${labelPrefix}: Warning` : "Warning"}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-xs font-medium inline-flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {labelPrefix ? `${labelPrefix}: Failed Field` : "Failed Field"}
          </Badge>
        );
    }
  };

  const getFidelityColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Strategic Value Header */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Enterprise Semantic Parser Simulation</span>
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold font-display">
                ATS Parser Simulator
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm max-w-2xl">
                Keywords alone don't guarantee interviews. This simulator evaluates whether Workday, Greenhouse, or Lever can cleanly extract your candidate identity, timeline milestones, and education without layout degradation.
              </CardDescription>
            </div>
            {benchmarkRole && (
              <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">
                Benchmarking: {benchmarkRole}
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Engine Selector Tabs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Select ATS Engine to Simulate:
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {config.vendor}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {ENGINE_KEYS.map((key) => {
            const engineConfig = ATS_ENGINES[key];
            const isSelected = selectedEngine === key;
            return (
              <Button
                key={key}
                type="button"
                variant={isSelected ? "default" : "outline"}
                onClick={() => setSelectedEngine(key)}
                className={`h-auto py-3 px-4 flex flex-col items-start text-left justify-start transition-all ${
                  isSelected
                    ? "shadow-md ring-2 ring-primary/30"
                    : "hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-semibold text-xs sm:text-sm">
                    {engineConfig.label}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary-foreground/20 text-primary-foreground">
                      Active
                    </span>
                  )}
                </div>
                <span className={`text-[11px] line-clamp-2 ${isSelected ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                  {engineConfig.vendor}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Engine Overview & Extraction Fidelity Score */}
      <Card className="border-border/80 bg-card/80 backdrop-blur-sm shadow-md">
        <CardContent className="pt-6 pb-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {config.label}
                </span>
                {getStatusBadge(overallStatus)}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {config.description}
              </p>
            </div>

            {/* Fidelity Score Gauge */}
            <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border/60 shrink-0">
              <div className="text-center">
                <div className={`text-3xl sm:text-4xl font-black font-mono tabular-nums ${getFidelityColor(fidelityScore)}`}>
                  {fidelityScore}%
                </div>
                <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  Parser Fidelity
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground border-l border-border/80 pl-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Contact Header: <strong>{identity.cleanlinessPercent}%</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Roles Extracted: <strong>{experiences.length}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Hazards Flagged: <strong>{activeHazards.length}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">Overall Extraction Health</span>
              <span className="font-mono">{fidelityScore}/100</span>
            </div>
            <Progress value={fidelityScore} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* ATS Parsing Hazard Flags */}
      <Card className="border-border/80 bg-card/70">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" /> ATS Parsing Hazard Flags
            </CardTitle>
            <Badge variant="outline" className={`text-xs font-mono ${activeHazards.length > 0 ? "border-amber-500/40 text-amber-600 dark:text-amber-400" : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"}`}>
              {activeHazards.length} Risk{activeHazards.length === 1 ? "" : "s"} Detected
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Formatting anomalies that cause ATS engines to drop candidate information or fail screening algorithms:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeHazards.length > 0 ? (
            activeHazards.map((hazard) => (
              <div
                key={hazard.id}
                className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-foreground">
                      {hazard.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/60 text-muted-foreground">
                      Affects: {hazard.affectedEngine}
                    </span>
                    <Badge variant="outline" className={`text-[10px] font-mono uppercase ${hazard.severity === "high" ? "bg-red-500/10 text-red-600 border-red-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}`}>
                      {hazard.severity} severity
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  {hazard.description}
                </p>
                <div className="pl-6 text-[11px] text-foreground font-medium flex items-start gap-1.5 bg-background/50 p-2 rounded border border-border/50">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span><strong>Fix:</strong> {hazard.recommendation}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Zero critical parsing hazards detected! Your layout conforms cleanly to ATS single-column specifications.</span>
            </div>
          )}

          {cleanHazards.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <div className="text-[11px] text-muted-foreground mb-2 font-medium">
                Passed Structural Verifications:
              </div>
              <div className="flex flex-wrap gap-2">
                {cleanHazards.map((h) => (
                  <span
                    key={h.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] bg-muted/40 text-muted-foreground border border-border/40"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {h.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Structured Entities Section 1: Candidate Identity & Contact Header */}
      <Card className="border-border/80 bg-card/70">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Candidate Identity & Contact Header
            </CardTitle>
            {getStatusBadge(identity.sectionStatus, `${identity.cleanlinessPercent}% Parsed`)}
          </div>
          <CardDescription className="text-xs">
            How cleanly the ATS extracts personal identification to populate recruiter candidate records:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ContactCard
              icon={<User className="h-4 w-4 text-muted-foreground" />}
              field={identity.name}
              getStatusBadge={getStatusBadge}
            />
            <ContactCard
              icon={<Mail className="h-4 w-4 text-muted-foreground" />}
              field={identity.email}
              getStatusBadge={getStatusBadge}
            />
            <ContactCard
              icon={<Phone className="h-4 w-4 text-muted-foreground" />}
              field={identity.phone}
              getStatusBadge={getStatusBadge}
            />
            <ContactCard
              icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
              field={identity.location}
              getStatusBadge={getStatusBadge}
            />
            <ContactCard
              icon={<Linkedin className="h-4 w-4 text-muted-foreground" />}
              field={identity.linkedin}
              getStatusBadge={getStatusBadge}
            />
            <ContactCard
              icon={<Github className="h-4 w-4 text-muted-foreground" />}
              field={identity.github}
              getStatusBadge={getStatusBadge}
            />
          </div>
        </CardContent>
      </Card>

      {/* Structured Entities Section 2: Experience Timeline */}
      <Card className="border-border/80 bg-card/70">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" /> Experience Timeline ({experiences.length} Detected)
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono">
              Chronological Extraction
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Job titles, companies, employment dates, and accomplishments segmented into database milestones:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {experiences.map((exp, idx) => (
            <div
              key={exp.id || idx}
              className="p-4 rounded-xl border border-border/80 bg-background/50 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {exp.title}
                    </span>
                    <span className="text-xs text-muted-foreground">at</span>
                    <span className="font-semibold text-xs text-primary flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> {exp.company}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground mt-0.5">
                    {exp.dateSpan}
                  </div>
                </div>
                <div>{getStatusBadge(exp.status)}</div>
              </div>

              {/* Bullet points extracted */}
              {exp.bullets.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Parsed Bullets ({exp.bullets.length})</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {exp.bullets.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2 leading-relaxed bg-muted/20 p-2 rounded border border-border/40">
                        <span className="text-primary font-bold mt-0.5">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                  No bullet points were extracted for this position. Duties may have been merged into a single paragraph.
                </div>
              )}

              {/* Engine extraction note */}
              <div className="text-[11px] text-muted-foreground font-mono bg-muted/40 px-2.5 py-1.5 rounded border border-border/50 flex items-center gap-1.5">
                <Info className="h-3 w-3 text-primary shrink-0" />
                <span>{exp.engineNote}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Structured Entities Section 3: Education */}
      <Card className="border-border/80 bg-card/70">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" /> Education ({education.length} Detected)
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono">
              Academic Credentials
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Degrees, educational institutions, and graduation cohorts detected by the parser:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {education.map((edu, idx) => (
            <div
              key={edu.id || idx}
              className="p-3.5 rounded-xl border border-border/80 bg-background/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">
                    {edu.degree}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" /> {edu.institution}
                  </span>
                  <span>•</span>
                  <span className="font-mono">Graduation: {edu.graduationYear}</span>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground pt-1">
                  {edu.engineNote}
                </div>
              </div>
              <div className="shrink-0">
                {getStatusBadge(edu.status)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Structured Entities Section 4: Skills Bag */}
      <Card className="border-border/80 bg-card/70">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Normalized Skills Bag ({skillsBag.length} Indexed)
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono text-primary border-primary/30">
              Taxonomy Normalized
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Normalized competencies recognized by enterprise ontology dictionaries:
          </CardDescription>
        </CardHeader>
        <CardContent>
          {skillsBag.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skillsBag.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs border border-primary/20 font-medium inline-flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3 w-3 text-primary" /> {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No normalized skills recognized from input text.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Raw Parser Stream / Buffer Inspection Toggle */}
      <Card className="border-border/80 bg-card/70">
        <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setShowRawBuffer(!showRawBuffer)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" /> Inspect Raw {config.label} Plaintext Buffer
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-muted-foreground">
              {showRawBuffer ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5 mr-1" /> Hide Buffer
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 mr-1" /> View Buffer
                </>
              )}
            </Button>
          </div>
          <CardDescription className="text-xs">
            View the serialized text stream as ingested by {config.label} before candidate scoring:
          </CardDescription>
        </CardHeader>
        {showRawBuffer && (
          <CardContent className="pt-0">
            <pre className="text-[11px] font-mono leading-relaxed bg-muted/60 p-4 rounded-xl border border-border/60 text-foreground overflow-x-auto max-h-72 whitespace-pre-wrap">
              {rawTextPreview}
            </pre>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function ContactCard({
  icon,
  field,
  getStatusBadge,
}: {
  icon: React.ReactNode;
  field: ContactField;
  getStatusBadge: (status: "clean" | "warning" | "failed") => React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-lg border border-border/70 bg-background/50 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          {icon} {field.label}
        </span>
        {getStatusBadge(field.status)}
      </div>
      <div className="text-xs font-medium text-foreground truncate">
        {field.value || <span className="text-muted-foreground italic font-normal">Not detected</span>}
      </div>
      <div className="text-[10px] text-muted-foreground font-mono truncate">
        {field.note}
      </div>
    </div>
  );
}
