import { Link } from "react-router-dom";
import { TrendingUp, Briefcase, Calendar, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SuccessStoryCardProps {
  story: {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    author_name: string;
    read_time_minutes: number;
    published_at: string;
    prompts_used?: Array<{
      prompt: string;
      purpose: string;
      result: string;
    }>;
    outcomes?: {
      before_score: number;
      after_score: number;
      interviews_landed: number;
      offers_received: number;
      time_to_offer: string;
      salary_increase?: string;
    };
  };
  className?: string;
}

export function SuccessStoryCard({ story, className }: SuccessStoryCardProps) {
  const scoreImprovement = story.outcomes 
    ? story.outcomes.after_score - story.outcomes.before_score 
    : 0;

  return (
    <Link to={`/blog/${story.slug}`}>
      <Card
        className={cn(
          "group overflow-hidden transition-all duration-300",
          "hover:border-success/50 hover:shadow-lg hover:shadow-success/5",
          "bg-gradient-to-br from-success/5 via-card to-card",
          "border-success/20",
          className
        )}
      >
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <Badge className="bg-success/20 text-success border-success/30">
              <Sparkles className="w-3 h-3 mr-1" />
              Success Story
            </Badge>
            <div className="text-right">
              <div className="text-2xl font-bold text-success">
                +{scoreImprovement}
              </div>
              <div className="text-xs text-muted-foreground">
                Score boost
              </div>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-success transition-colors">
            {story.title}
          </h3>

          {/* Excerpt */}
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {story.excerpt}
          </p>

          {/* Score Progress */}
          {story.outcomes && (
            <div className="mb-4 p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Score Progress</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-destructive">
                    {story.outcomes.before_score}
                  </span>
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-sm font-bold text-success">
                    {story.outcomes.after_score}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-destructive via-warning to-success rounded-full transition-all duration-1000"
                  style={{ width: `${story.outcomes.after_score}%` }}
                />
              </div>
            </div>
          )}

          {/* Outcome Stats */}
          {story.outcomes && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 rounded-lg bg-accent/30">
                <div className="text-lg font-bold text-foreground">
                  {story.outcomes.interviews_landed}
                </div>
                <div className="text-xs text-muted-foreground">Interviews</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-accent/30">
                <div className="text-lg font-bold text-foreground">
                  {story.outcomes.offers_received}
                </div>
                <div className="text-xs text-muted-foreground">Offers</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-accent/30">
                <div className="text-lg font-bold text-foreground">
                  {story.outcomes.time_to_offer}
                </div>
                <div className="text-xs text-muted-foreground">Timeline</div>
              </div>
            </div>
          )}

          {/* Prompts Preview */}
          {story.prompts_used && story.prompts_used.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-muted-foreground mb-2">
                Prompts used:
              </div>
              <div className="flex flex-wrap gap-1">
                {story.prompts_used.slice(0, 2).map((p, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs truncate max-w-[150px]"
                  >
                    "{p.prompt.substring(0, 25)}..."
                  </Badge>
                ))}
                {story.prompts_used.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{story.prompts_used.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{story.author_name}</span>
              <span>•</span>
              <span>{story.read_time_minutes} min read</span>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-success group-hover:gap-2 transition-all">
              Read story
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
