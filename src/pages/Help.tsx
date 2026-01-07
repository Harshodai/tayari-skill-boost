import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  FileText, 
  Mic, 
  Briefcase, 
  CreditCard, 
  User, 
  HelpCircle,
  MessageCircle,
  Mail,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

const Help = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    {
      icon: FileText,
      title: "Resume Optimizer",
      description: "Learn how to upload, analyze, and improve your resume",
      articles: 12
    },
    {
      icon: Mic,
      title: "Interview Prep",
      description: "Get help with mock interviews and preparation tools",
      articles: 8
    },
    {
      icon: Briefcase,
      title: "Job Matching",
      description: "Understand how our job recommendations work",
      articles: 6
    },
    {
      icon: User,
      title: "Account & Profile",
      description: "Manage your account settings and preferences",
      articles: 10
    },
    {
      icon: CreditCard,
      title: "Billing & Plans",
      description: "Questions about subscriptions, payments, and upgrades",
      articles: 9
    },
    {
      icon: HelpCircle,
      title: "Getting Started",
      description: "New to Job Tayari? Start here for the basics",
      articles: 5
    }
  ];

  const popularArticles = [
    "How to upload and analyze my resume",
    "Understanding your ATS compatibility score",
    "How to export my optimized resume",
    "Canceling or changing my subscription",
    "Connecting my LinkedIn profile",
    "Tips for improving your resume score"
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-hero py-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Help <span className="text-gradient">Center</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Find answers to your questions and learn how to get the most out of Job Tayari.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-6 text-lg"
              />
            </div>
          </div>

          {/* Categories Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
            {categories.map((category, index) => (
              <div
                key={index}
                className="glass rounded-xl p-6 border border-border card-hover group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <category.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  {category.title}
                </h3>
                <p className="text-muted-foreground text-sm mb-3">
                  {category.description}
                </p>
                <span className="text-xs text-muted-foreground">
                  {category.articles} articles
                </span>
              </div>
            ))}
          </div>

          {/* Popular Articles */}
          <div className="max-w-3xl mx-auto mb-16">
            <h2 className="text-2xl font-bold mb-6 text-center">
              Popular <span className="text-gradient">Articles</span>
            </h2>
            <div className="glass rounded-xl border border-border overflow-hidden">
              {popularArticles.map((article, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors cursor-pointer group border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="group-hover:text-primary transition-colors">
                      {article}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              ))}
            </div>
          </div>

          {/* Contact Support */}
          <div className="max-w-3xl mx-auto">
            <div className="glass rounded-2xl p-8 border border-border">
              <h2 className="text-2xl font-bold mb-6 text-center">
                Still Need Help?
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="text-center p-6 rounded-xl bg-accent/30 border border-border">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Live Chat</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Chat with our support team in real-time
                  </p>
                  <Button variant="outline" size="sm">
                    Start Chat
                  </Button>
                </div>
                <div className="text-center p-6 rounded-xl bg-accent/30 border border-border">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Email Support</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    We'll respond within 24 hours
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/contact">Contact Us</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Help;
