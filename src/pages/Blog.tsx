import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BlogFilters, BlogPostCard, SuccessStoryCard, type BlogFiltersState } from "@/components/blog";
import { supabase } from "@/integrations/supabase/client";
import { apiFetchResponse } from "@/api";
import { toast } from "sonner";
import { AlertCircle, RefreshCw, Mail, ArrowRight, Sparkles } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

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
    before_score?: number;
    after_score?: number;
    interviews_landed?: number;
    offers_received?: number;
    time_to_offer?: string;
    salary_increase?: string;
  };
  prompts_used?: Array<{
    prompt: string;
    purpose: string;
    result: string;
  }>;
}

const POSTS_PER_PAGE = 6;

const Blog = () => {
  const [filters, setFilters] = useState<BlogFiltersState>({
    search: "",
    category: null,
    tag: null,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Fetch all posts
  const { data: postsData, isLoading, error, refetch } = useQuery({
    queryKey: ["blog-posts", filters],
    queryFn: async () => {
      let query = supabase
        .from("blog_posts")
        .select("*")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false });

      if (filters.category) {
        query = query.eq("category", filters.category);
      }

      if (filters.tag) {
        query = query.contains("tags", [filters.tag]);
      }

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,excerpt.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as BlogPost[];
    },
  });

  // Process posts
  const posts = postsData || [];
  const featuredPost = posts.find((p) => p.is_featured);
  const successStories = posts.filter((p) => p.is_success_story);
  const regularPosts = posts.filter((p) => !p.is_featured);

  // Extract all unique tags
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    posts.forEach((post) => {
      post.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [posts]);

  // Pagination
  const totalPages = Math.ceil(regularPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = regularPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  // Reset page when filters change
  const handleFiltersChange = (newFilters: BlogFiltersState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newsletterEmail.trim();
    if (!email) return;

    setIsSubscribing(true);
    try {
      const response = await apiFetchResponse("/v1/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tier: "newsletter" }),
      });
      if (!response.ok) {
        throw new Error("Newsletter service is unavailable; your email was not submitted.");
      }
      setNewsletterEmail("");
      toast.success("You’re subscribed to JobTayari updates.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Newsletter service is unavailable; your email was not submitted.");
    } finally {
      setIsSubscribing(false);
    }
  };

  // Helper to safely convert Json to expected types
  const convertToSuccessStory = (post: BlogPost) => ({
    ...post,
    outcomes: post.outcomes as {
      before_score: number;
      after_score: number;
      interviews_landed: number;
      offers_received: number;
      time_to_offer: string;
      salary_increase?: string;
    },
    prompts_used: post.prompts_used,
  });

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-hero py-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Career <span className="text-gradient">Insights</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Expert advice, tips, and strategies to help you navigate your career journey.
            </p>
          </div>

          {/* Filters */}
          <div className="max-w-5xl mx-auto mb-12">
            <BlogFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              availableTags={availableTags}
            />
          </div>

          {/* Error State */}
          {error && (
            <div className="max-w-2xl mx-auto mb-12">
              <div className="glass rounded-xl p-8 border border-destructive/30 text-center">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Failed to load articles</h3>
                <p className="text-muted-foreground mb-4">
                  Something went wrong while fetching blog posts.
                </p>
                <Button onClick={() => refetch()} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-8">
              {/* Featured Skeleton */}
              <div className="max-w-5xl mx-auto mb-16">
                <Skeleton className="h-80 rounded-2xl" />
              </div>

              {/* Grid Skeleton */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-72 rounded-xl" />
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          {!isLoading && !error && (
            <>
              {/* Featured Post */}
              {featuredPost && !filters.search && !filters.category && !filters.tag && (
                <div className="max-w-5xl mx-auto mb-16">
                  <BlogPostCard
                    post={{
                      ...featuredPost,
                      tags: featuredPost.tags || [],
                      is_featured: true,
                      is_success_story: featuredPost.is_success_story || false,
                      author_name: featuredPost.author_name || "Job Tayari Team",
                      read_time_minutes: featuredPost.read_time_minutes || 5,
                    }}
                    variant="featured"
                  />
                </div>
              )}

              {/* Success Stories Section */}
              {successStories.length > 0 && !filters.category && (
                <div className="mb-16">
                  <div className="flex items-center gap-3 mb-6">
                    <Sparkles className="w-6 h-6 text-success" />
                    <h2 className="text-2xl font-bold">Success Stories</h2>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {successStories.slice(0, 3).map((story) => (
                      <SuccessStoryCard
                        key={story.id}
                        story={convertToSuccessStory(story)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Posts Grid */}
              <div className="max-w-6xl mx-auto mb-16">
                <h2 className="text-2xl font-bold mb-6">
                  {filters.search || filters.category || filters.tag
                    ? `${posts.length} article${posts.length !== 1 ? "s" : ""} found`
                    : "All Articles"}
                </h2>

                {paginatedPosts.length === 0 ? (
                  <div className="glass rounded-xl p-12 border border-border text-center">
                    <p className="text-lg text-muted-foreground mb-4">
                      No articles found matching your criteria.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setFilters({ search: "", category: null, tag: null })}
                    >
                      Clear Filters
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                    {paginatedPosts.map((post) => (
                      <BlogPostCard
                        key={post.id}
                        post={{
                          ...post,
                          tags: post.tags || [],
                          is_featured: false,
                          is_success_story: post.is_success_story || false,
                          author_name: post.author_name || "Job Tayari Team",
                          read_time_minutes: post.read_time_minutes || 5,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-10"
                      >
                        {page}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>

              {/* Newsletter Signup */}
              <div className="max-w-2xl mx-auto">
                <div className="glass rounded-2xl p-8 border border-border text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Stay Updated</h3>
                  <p className="text-muted-foreground mb-6">
                    Get the latest career tips and job market insights delivered to your inbox.
                  </p>
                  <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      className="flex-1"
                      required
                    />
                    <Button type="submit" disabled={isSubscribing}>
                      {isSubscribing ? "Subscribing..." : "Subscribe"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                  <p className="text-xs text-muted-foreground mt-4">
                    No spam. Unsubscribe anytime.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Blog;
