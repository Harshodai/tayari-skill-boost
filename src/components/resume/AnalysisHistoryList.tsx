import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  FileText, 
  Clock, 
  MoreVertical, 
  Eye, 
  Trash2,
  Briefcase 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ResumeAnalysisRecord } from "@/types/resume";
import { format } from "date-fns";

interface AnalysisHistoryListProps {
  analyses: ResumeAnalysisRecord[];
  onDelete?: (id: string) => void;
  isLoading?: boolean;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
};

const getScoreBadge = (score: number) => {
  if (score >= 80) {
    return <Badge className="bg-success/20 text-success border-success/30">Excellent</Badge>;
  }
  if (score >= 50) {
    return <Badge className="bg-warning/20 text-warning border-warning/30">Good</Badge>;
  }
  return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Needs Work</Badge>;
};

export const AnalysisHistoryList = ({ 
  analyses, 
  onDelete,
  isLoading 
}: AnalysisHistoryListProps) => {
  const navigate = useNavigate();

  const handleView = (analysis: ResumeAnalysisRecord) => {
    navigate("/resume/results", {
      state: {
        analysisResults: analysis.analysis_data,
        resumeFileName: analysis.resume_filename,
        resumeText: analysis.resume_text,
        jobDescription: analysis.job_description,
        parsedResume: analysis.parsed_resume,
      },
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("resume_analyses")
        .delete()
        .eq("id", id);

      if (error) {
        // In self-hosted mode, the table may not exist; just update local UI
        console.warn("Supabase delete skipped:", error.message);
      } else {
        toast.success("Analysis deleted");
      }
    } catch (error) {
      console.error("Error deleting analysis:", error);
    }
    // Always update the parent UI regardless of backend availability
    onDelete?.(id);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-muted rounded" />
                  <div className="h-3 w-1/4 bg-muted rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <Card className="py-12 text-center">
        <CardContent>
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No analysis history
          </h3>
          <p className="text-muted-foreground mb-4">
            Your resume analyses will appear here
          </p>
          <Button onClick={() => navigate("/resume")}>
            Analyze a Resume
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {analyses.map((analysis, index) => (
        <Card
          key={analysis.id}
          className="animate-fade-in-up card-hover"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {analysis.resume_filename}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {analysis.job_title && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {analysis.job_title}
                        {analysis.company_name && ` at ${analysis.company_name}`}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(analysis.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`text-lg font-bold ${getScoreColor(analysis.overall_score)}`}>
                    {analysis.overall_score}%
                  </p>
                  {getScoreBadge(analysis.overall_score)}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleView(analysis)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Results
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => handleDelete(analysis.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AnalysisHistoryList;