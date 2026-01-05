import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScoreDisplay } from "@/components/ui/score-display";
import { 
  ArrowLeft, 
  Download, 
  Edit, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Check,
  Lightbulb,
  Target,
  Briefcase,
  GraduationCap,
  FileText
} from "lucide-react";

// Mock data - in production this would come from API
const mockResults = {
  overallScore: 78,
  sections: [
    {
      name: "Skills Match",
      score: 85,
      icon: Target,
      suggestions: [
        "Add 'TypeScript' - mentioned 3 times in job description",
        "Include 'AWS' experience - listed as required skill",
        "Highlight 'React Testing Library' knowledge",
      ],
    },
    {
      name: "Experience Relevance",
      score: 72,
      icon: Briefcase,
      suggestions: [
        "Quantify your achievements with metrics (e.g., 'Improved load time by 40%')",
        "Add more details about your team leadership experience",
        "Mention experience with agile methodologies",
      ],
    },
    {
      name: "Education Fit",
      score: 90,
      icon: GraduationCap,
      suggestions: [
        "Your CS degree aligns well with requirements",
        "Consider adding relevant certifications",
      ],
    },
    {
      name: "Formatting",
      score: 65,
      icon: FileText,
      suggestions: [
        "Use consistent bullet point formatting",
        "Reduce resume to 2 pages or less",
        "Add more white space between sections",
        "Use stronger action verbs at the start of bullet points",
      ],
    },
  ],
};

const ResumeResults = () => {
  const [expandedSections, setExpandedSections] = useState<string[]>(["Skills Match"]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<string[]>([]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((s) => s !== sectionName)
        : [...prev, sectionName]
    );
  };

  const applySuggestion = (suggestion: string) => {
    setAppliedSuggestions((prev) =>
      prev.includes(suggestion)
        ? prev.filter((s) => s !== suggestion)
        : [...prev, suggestion]
    );
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return { text: "Excellent", color: "text-success" };
    if (score >= 60) return { text: "Good", color: "text-warning" };
    return { text: "Needs Work", color: "text-destructive" };
  };

  const overallLabel = getScoreLabel(mockResults.overallScore);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Button variant="ghost" asChild className="mb-2">
              <Link to="/resume">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Upload
              </Link>
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Resume Analysis Results
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <Link to="/resume/templates">
                <Edit className="w-4 h-4 mr-2" />
                Choose Template
              </Link>
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/resume">
                <RotateCcw className="w-4 h-4 mr-2" />
                Start Over
              </Link>
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Overall Score Card */}
          <Card className="lg:col-span-1 animate-fade-in-up">
            <CardHeader className="text-center">
              <CardTitle>Overall Match Score</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <ScoreDisplay 
                score={mockResults.overallScore} 
                size="lg" 
                showBar 
                animated 
              />
              <div className={`mt-4 text-lg font-semibold ${overallLabel.color}`}>
                {overallLabel.text}
              </div>
              <p className="text-muted-foreground text-sm text-center mt-2">
                Your resume matches {mockResults.overallScore}% of the job requirements
              </p>
            </CardContent>
          </Card>

          {/* Section Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Detailed Breakdown
            </h2>

            {mockResults.sections.map((section, index) => {
              const isExpanded = expandedSections.includes(section.name);
              const scoreLabel = getScoreLabel(section.score);
              const Icon = section.icon;

              return (
                <Card 
                  key={section.name} 
                  className="animate-fade-in-up overflow-hidden"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <button
                    onClick={() => toggleSection(section.name)}
                    className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-foreground">{section.name}</h3>
                        <p className={`text-sm ${scoreLabel.color}`}>{scoreLabel.text}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <ScoreDisplay score={section.score} size="sm" animated={false} />
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-4 px-4 border-t border-border/50">
                      <div className="pt-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                          <Lightbulb className="w-4 h-4" />
                          Suggestions to Improve
                        </div>
                        <ul className="space-y-2">
                          {section.suggestions.map((suggestion) => {
                            const isApplied = appliedSuggestions.includes(suggestion);
                            return (
                              <li 
                                key={suggestion}
                                className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                                  isApplied 
                                    ? "bg-success/10 border border-success/20" 
                                    : "bg-accent/50"
                                }`}
                              >
                                <span className={`flex-1 text-sm ${isApplied ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                  {suggestion}
                                </span>
                                <Button
                                  size="sm"
                                  variant={isApplied ? "ghost" : "outline"}
                                  onClick={() => applySuggestion(suggestion)}
                                  className="flex-shrink-0"
                                >
                                  {isApplied ? (
                                    <>
                                      <Check className="w-4 h-4 mr-1 text-success" />
                                      Applied
                                    </>
                                  ) : (
                                    "Apply"
                                  )}
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
          <Button size="lg" variant="glow" asChild>
            <Link to="/resume/templates">
              Choose a Template & Download
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/resume">
              Analyze Another Resume
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default ResumeResults;
