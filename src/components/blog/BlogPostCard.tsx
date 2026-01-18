import { Link } from "react-router-dom";
import { Clock, ArrowRight, Star, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BlogPostCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    category: string;
    tags: string[];
    is_featured: boolean;
    is_success_story: boolean;
    author_name: string;
    read_time_minutes: number;
    published_at: string;
    outcomes?: {
      before_score?: number;
      after_score?: number;
      interviews_landed?: number;
      salary_increase?: string;
    };
  };
  variant?: "default" | "featured";
  className?: string;
}

const categoryColors: Record<string, string> = {
  "resume-tips": "bg-primary/20 text-primary border-primary/30",
  "interview-prep": "bg-secondary/20 text-secondary border-secondary/30",
  "career-tips": "bg-warning/20 text-warning border-warning/30",
  "success-stories": "bg-success/20 text-success border-success/30",
};

const categoryLabels: Record<string, string> = {
  "resume-tips": "Resume Tips",
  "interview-prep": "Interview Prep",
  "career-tips": "Career Tips",
  "success-stories": "Success Story",
};

export function BlogPostCard({ post, variant = "default", className }: BlogPostCardProps) {
  const isFeatured = variant === "featured" || post.is_featured;
  const formattedDate = new Date(post.published_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link to={`/blog/${post.slug}`}>
      <Card
        className={cn(
          "group overflow-hidden transition-all duration-300",
          "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
          "bg-card/50 backdrop-blur-sm border-border/50",
          isFeatured && "md:col-span-2 lg:col-span-3",
          className
        )}
      >
        <CardContent className={cn(
          "p-0",
          isFeatured && "md:flex"
        )}>
          {/* Image/Gradient Header */}
          <div
            className={cn(
              "relative overflow-hidden",
              isFeatured ? "md:w-1/2 h-48 md:h-auto" : "h-40"
            )}
          >
            <div
              className={cn(
                "absolute inset-0 transition-transform duration-500 group-hover:scale-105",
                post.is_success_story
                  ? "bg-gradient-to-br from-success/30 via-primary/20 to-secondary/30"
                  : "bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20"
              )}
            />
            
            {/* Category Badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-medium",
                  categoryColors[post.category]
                )}
              >
                {categoryLabels[post.category]}
              </Badge>
              {post.is_featured && (
                <Badge className="bg-warning text-warning-foreground">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  Featured
                </Badge>
              )}
            </div>

            {/* Success Story Stats */}
            {post.is_success_story && post.outcomes && (
              <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
                {post.outcomes.before_score && post.outcomes.after_score && (
                  <div className="flex items-center gap-1.5 bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-success" />
                    <span className="text-xs font-medium">
                      {post.outcomes.before_score} → {post.outcomes.after_score}
                    </span>
                  </div>
                )}
                {post.outcomes.interviews_landed && (
                  <div className="bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5">
                    <span className="text-xs font-medium">
                      {post.outcomes.interviews_landed} interviews
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className={cn(
            "p-6 flex flex-col",
            isFeatured && "md:w-1/2 md:justify-center"
          )}>
            <h3
              className={cn(
                "font-semibold text-foreground mb-2 line-clamp-2",
                "group-hover:text-primary transition-colors",
                isFeatured ? "text-xl md:text-2xl" : "text-lg"
              )}
            >
              {post.title}
            </h3>

            <p className={cn(
              "text-muted-foreground mb-4",
              isFeatured ? "line-clamp-3 text-base" : "line-clamp-2 text-sm"
            )}>
              {post.excerpt}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {post.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs bg-accent/50 text-muted-foreground"
                >
                  #{tag}
                </Badge>
              ))}
              {post.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs bg-accent/50 text-muted-foreground">
                  +{post.tags.length - 3}
                </Badge>
              )}
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{post.author_name}</span>
                <span>•</span>
                <span>{formattedDate}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {post.read_time_minutes} min read
                </span>
              </div>

              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
