import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, ArrowRight, Tag } from "lucide-react";

const Blog = () => {
  const featuredPost = {
    title: "10 Resume Mistakes That Are Costing You Interviews",
    excerpt: "Learn the most common resume errors that ATS systems and recruiters flag, and how to fix them to increase your callback rate by up to 85%.",
    category: "Resume Tips",
    date: "Jan 5, 2026",
    readTime: "8 min read",
    image: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&auto=format&fit=crop"
  };

  const posts = [
    {
      title: "How to Prepare for AI-Powered Interviews",
      excerpt: "The rise of AI in hiring means new challenges for candidates. Here's how to ace them.",
      category: "Interview Prep",
      date: "Jan 3, 2026",
      readTime: "6 min read"
    },
    {
      title: "Understanding ATS: A Complete Guide",
      excerpt: "What is an Applicant Tracking System and how does it affect your job applications?",
      category: "Career Tips",
      date: "Dec 28, 2025",
      readTime: "10 min read"
    },
    {
      title: "Remote Work in 2026: Trends & Opportunities",
      excerpt: "The remote work landscape continues to evolve. Discover the latest trends and how to position yourself.",
      category: "Career Tips",
      date: "Dec 22, 2025",
      readTime: "7 min read"
    },
    {
      title: "How to Negotiate Your Salary: A Step-by-Step Guide",
      excerpt: "Don't leave money on the table. Learn proven strategies to negotiate the compensation you deserve.",
      category: "Career Tips",
      date: "Dec 18, 2025",
      readTime: "9 min read"
    },
    {
      title: "Building a LinkedIn Profile That Gets Noticed",
      excerpt: "Recruiters spend hours on LinkedIn. Make sure your profile stands out from the crowd.",
      category: "Resume Tips",
      date: "Dec 15, 2025",
      readTime: "5 min read"
    }
  ];

  const categories = ["All", "Resume Tips", "Interview Prep", "Career Tips", "Industry Insights"];

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

          {/* Categories */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((category, index) => (
              <Button
                key={index}
                variant={index === 0 ? "default" : "outline"}
                size="sm"
                className="rounded-full"
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Featured Post */}
          <div className="max-w-5xl mx-auto mb-16">
            <div className="glass rounded-2xl overflow-hidden border border-border card-hover">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="aspect-video md:aspect-auto">
                  <img
                    src={featuredPost.image}
                    alt={featuredPost.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full">
                      Featured
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {featuredPost.category}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-4 hover:text-primary transition-colors cursor-pointer">
                    {featuredPost.title}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {featuredPost.excerpt}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {featuredPost.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {featuredPost.readTime}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Post Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
            {posts.map((post, index) => (
              <article
                key={index}
                className="glass rounded-xl p-6 border border-border card-hover group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded">
                    {post.category}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-3 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {post.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.readTime}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </article>
            ))}
          </div>

          {/* Newsletter Signup */}
          <div className="max-w-2xl mx-auto">
            <div className="glass rounded-2xl p-8 border border-border text-center">
              <h3 className="text-2xl font-bold mb-3">Stay Updated</h3>
              <p className="text-muted-foreground mb-6">
                Get the latest career tips and job market insights delivered to your inbox.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1"
                />
                <Button>Subscribe</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                No spam. Unsubscribe anytime.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Blog;
