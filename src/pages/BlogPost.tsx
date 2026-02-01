import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Clock,
  Calendar,
  User,
  ChevronRight,
  TrendingUp,
  Briefcase,
  Trophy,
  DollarSign,
  Sparkles,
  MessageSquare,
  Target,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Share2,
  BookmarkPlus
} from "lucide-react";
import { marked } from "marked";
import { BlogPostCard } from "@/components/blog";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  is_featured: boolean;
  is_success_story: boolean;
  author_name: string;
  read_time_minutes: number;
  published_at: string;
  featured_image: string | null;
  outcomes?: {
    before_score: number;
    after_score: number;
    interviews_landed: number;
    offers_received: number;
    time_to_offer: string;
    salary_increase?: string;
  };
  prompts_used?: Array<{
    prompt: string;
    purpose: string;
    result: string;
  }>;
}

const categoryLabels: Record<string, string> = {
  "resume-tips": "Resume Tips",
  "interview-prep": "Interview Prep",
  "career-tips": "Career Tips",
  "success-stories": "Success Story",
};

import { sanitize } from "@/lib/utils";

// ...

// Simple markdown to HTML converter
function renderMarkdown(content: string): string {
  // 1. Parse markdown using marked
  const html = marked.parse(content, { async: false }) as string;

  // 2. Sanitize using helper
  return sanitize(html);
}

const BlogPost = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  // Fetch post by slug
  const { data: post, isLoading, error, refetch } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw error;
      return data as unknown as BlogPost;
    },
    enabled: !!slug,
  });

  // Fetch related posts
  const { data: relatedPosts } = useQuery({
    queryKey: ["related-posts", post?.category, post?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("category", post!.category)
        .neq("id", post!.id)
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      return data as unknown as BlogPost[];
    },
    enabled: !!post,
  });

  const formattedDate = post
    ? new Date(post.published_at).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    : "";

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: post?.title,
        text: post?.excerpt,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      // Show toast notification
    }
  };

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-hero py-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="glass rounded-xl p-12 border border-destructive/30 text-center">
              <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-6" />
              <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
              <p className="text-muted-foreground mb-6">
                The article you're looking for doesn't exist or has been removed.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button onClick={() => refetch()} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={() => navigate("/blog")}>
                  Back to Blog
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-hero">
        {/* Loading State */}
        {isLoading && (
          <div className="container mx-auto px-4 py-20 max-w-4xl">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-12 w-full mb-4" />
            <Skeleton className="h-6 w-96 mb-8" />
            <Skeleton className="h-64 w-full rounded-xl mb-8" />
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {post && (
          <>
            {/* Hero Section */}
            <div className="pt-20 pb-12">
              <div className="container mx-auto px-4 max-w-4xl">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                  <Link to="/blog" className="hover:text-foreground transition-colors">
                    Blog
                  </Link>
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-foreground">{post.title}</span>
                </nav>

                {/* Back Button */}
                <Button variant="ghost" asChild className="mb-6">
                  <Link to="/blog">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Blog
                  </Link>
                </Button>

                {/* Category & Featured Badge */}
                <div className="flex items-center gap-3 mb-4">
                  <Badge
                    variant="outline"
                    className={
                      post.is_success_story
                        ? "bg-success/20 text-success border-success/30"
                        : "bg-primary/20 text-primary border-primary/30"
                    }
                  >
                    {post.is_success_story && <Sparkles className="w-3 h-3 mr-1" />}
                    {categoryLabels[post.category] || post.category}
                  </Badge>
                  {post.is_featured && (
                    <Badge className="bg-warning text-warning-foreground">Featured</Badge>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
                  {post.title}
                </h1>

                {/* Excerpt */}
                <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                  {post.excerpt}
                </p>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground pb-8 border-b border-border">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{post.author_name || "Job Tayari Team"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formattedDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{post.read_time_minutes || 5} min read</span>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleShare}>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                    <Button variant="ghost" size="sm">
                      <BookmarkPlus className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Success Story Outcomes */}
            {post.is_success_story && post.outcomes && (
              <div className="container mx-auto px-4 max-w-4xl mb-12">
                <Card className="overflow-hidden border-success/30 bg-gradient-to-br from-success/5 via-card to-card">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-center gap-2 mb-6">
                      <Trophy className="w-5 h-5 text-success" />
                      <h2 className="text-xl font-bold">Results Achieved</h2>
                    </div>

                    {/* Score Progress */}
                    <div className="mb-6 p-4 rounded-xl bg-background/50 border border-border/50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-muted-foreground">Resume Score Progress</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-destructive">
                            {post.outcomes.before_score}
                          </span>
                          <TrendingUp className="w-5 h-5 text-success" />
                          <span className="text-2xl font-bold text-success">
                            {post.outcomes.after_score}
                          </span>
                        </div>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-destructive via-warning to-success rounded-full transition-all duration-1000"
                          style={{ width: `${post.outcomes.after_score}%` }}
                        />
                      </div>
                      <div className="text-right mt-2">
                        <span className="text-sm font-medium text-success">
                          +{post.outcomes.after_score - post.outcomes.before_score} points improvement
                        </span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-xl bg-accent/30 border border-border/50">
                        <Briefcase className="w-6 h-6 text-primary mx-auto mb-2" />
                        <div className="text-2xl font-bold text-foreground">
                          {post.outcomes.interviews_landed}
                        </div>
                        <div className="text-xs text-muted-foreground">Interviews Landed</div>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-accent/30 border border-border/50">
                        <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-2" />
                        <div className="text-2xl font-bold text-foreground">
                          {post.outcomes.offers_received}
                        </div>
                        <div className="text-xs text-muted-foreground">Offers Received</div>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-accent/30 border border-border/50">
                        <Calendar className="w-6 h-6 text-secondary mx-auto mb-2" />
                        <div className="text-2xl font-bold text-foreground">
                          {post.outcomes.time_to_offer}
                        </div>
                        <div className="text-xs text-muted-foreground">Time to Offer</div>
                      </div>
                      {post.outcomes.salary_increase && (
                        <div className="text-center p-4 rounded-xl bg-success/10 border border-success/30">
                          <DollarSign className="w-6 h-6 text-success mx-auto mb-2" />
                          <div className="text-2xl font-bold text-success">
                            {post.outcomes.salary_increase}
                          </div>
                          <div className="text-xs text-muted-foreground">Salary Increase</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Article Content */}
            <div className="container mx-auto px-4 max-w-4xl mb-12">
              <article
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
              />
            </div>

            {/* Prompts Used Section (Success Stories) */}
            {post.is_success_story && post.prompts_used && post.prompts_used.length > 0 && (
              <div className="container mx-auto px-4 max-w-4xl mb-12">
                <Card className="overflow-hidden border-primary/30">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-center gap-2 mb-6">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-bold">Prompts & Strategies Used</h2>
                    </div>
                    <Accordion type="single" collapsible className="space-y-2">
                      {post.prompts_used.map((prompt, index) => (
                        <AccordionItem
                          key={index}
                          value={`prompt-${index}`}
                          className="border border-border/50 rounded-lg px-4 bg-card/50"
                        >
                          <AccordionTrigger className="text-left hover:no-underline">
                            <div className="flex items-start gap-3">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-medium mt-0.5">
                                {index + 1}
                              </span>
                              <span className="text-foreground font-medium">
                                "{prompt.prompt}"
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pl-9 space-y-3">
                            <div className="flex items-start gap-2">
                              <Target className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                              <div>
                                <span className="text-sm font-medium text-foreground">Purpose:</span>
                                <p className="text-sm text-muted-foreground">{prompt.purpose}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-success mt-1 flex-shrink-0" />
                              <div>
                                <span className="text-sm font-medium text-foreground">Result:</span>
                                <p className="text-sm text-muted-foreground">{prompt.result}</p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="container mx-auto px-4 max-w-4xl mb-12">
                <div className="flex flex-wrap gap-2 pt-6 border-t border-border">
                  {post.tags.map((tag) => (
                    <Link key={tag} to={`/blog?tag=${tag}`}>
                      <Badge
                        variant="secondary"
                        className="text-sm hover:bg-accent transition-colors cursor-pointer"
                      >
                        #{tag}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Related Posts */}
            {relatedPosts && relatedPosts.length > 0 && (
              <div className="container mx-auto px-4 max-w-6xl pb-20">
                <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {relatedPosts.map((relatedPost) => (
                    <BlogPostCard
                      key={relatedPost.id}
                      post={{
                        ...relatedPost,
                        tags: relatedPost.tags || [],
                        is_featured: false,
                        is_success_story: relatedPost.is_success_story || false,
                        author_name: relatedPost.author_name || "Job Tayari Team",
                        read_time_minutes: relatedPost.read_time_minutes || 5,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="container mx-auto px-4 max-w-4xl pb-20">
              <Card className="overflow-hidden bg-gradient-to-r from-primary/10 via-card to-secondary/10 border-primary/30">
                <CardContent className="p-8 text-center">
                  <h3 className="text-2xl font-bold mb-3">Ready to Optimize Your Resume?</h3>
                  <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                    Use our AI-powered resume optimizer to boost your score and land more interviews.
                  </p>
                  <Button asChild size="lg" variant="glow">
                    <Link to="/resume">
                      Get Started Free
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default BlogPost;
