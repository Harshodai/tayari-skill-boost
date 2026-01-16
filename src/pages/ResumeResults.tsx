import { useState } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import type { ResumeAnalysisResult } from "@/types/resume";

// Icon mapping for sections
const sectionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "Skills Match": Target,
  "Experience Relevance": Briefcase,
  "Education Fit": GraduationCap,
  "Formatting": FileText,
};

const ResumeResults = () => {
  const location = useLocation();
  const analysisResults = location.state?.analysisResults as ResumeAnalysisResult | undefined;
  const resumeFileName = location.state?.resumeFileName as string | undefined;
  
  const [expandedSections, setExpandedSections] = useState<string[]>(
    analysisResults?.sections?.[0]?.name ? [analysisResults.sections[0].name] : []
  );
  const [appliedSuggestions, setAppliedSuggestions] = useState<string[]>([]);

  // Redirect if no results
  if (!analysisResults) {
    return <Navigate to="/resume" replace />;
  }

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

  const overallLabel = getScoreLabel(analysisResults.overallScore);

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
            {resumeFileName && (
              <p className="text-muted-foreground text-sm mt-1">
                Analyzed: {resumeFileName}
              </p>
            )}
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
          {/* Left Column - Overall Score & Keywords */}
          <div className="space-y-6">
            {/* Overall Score Card */}
            <Card className="animate-fade-in-up">
              <CardHeader className="text-center">
                <CardTitle>Overall Match Score</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <ScoreDisplay 
                  score={analysisResults.overallScore} 
                  size="lg" 
                  showBar 
                  animated 
                />
                <div className={`mt-4 text-lg font-semibold ${overallLabel.color}`}>
                  {overallLabel.text}
                </div>
                <p className="text-muted-foreground text-sm text-center mt-2">
                  Your resume matches {analysisResults.overallScore}% of the job requirements
                </p>
              </CardContent>
            </Card>

            {/* Keywords Card */}
            <Card className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Keyword Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Matched Keywords */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-sm font-medium">Matched Keywords</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResults.matchedKeywords.length > 0 ? (
                      analysisResults.matchedKeywords.map((keyword) => (
                        <Badge key={keyword} variant="outline" className="bg-success/10 border-success/30 text-success">
                          {keyword}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">No matched keywords found</span>
                    )}
                  </div>
                </div>

                {/* Missing Keywords */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium">Missing Keywords</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResults.missingKeywords.length > 0 ? (
                      analysisResults.missingKeywords.map((keyword) => (
                        <Badge key={keyword} variant="outline" className="bg-destructive/10 border-destructive/30 text-destructive">
                          {keyword}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">Great! No critical keywords missing</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Recommendation */}
            <Card className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  AI Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {analysisResults.summaryRecommendation}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Section Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Detailed Breakdown
            </h2>

            {analysisResults.sections.map((section, index) => {
              const isExpanded = expandedSections.includes(section.name);
              const scoreLabel = getScoreLabel(section.score);
              const Icon = sectionIcons[section.name] || FileText;

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

                  {isExpanded && section.suggestions.length > 0 && (
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
