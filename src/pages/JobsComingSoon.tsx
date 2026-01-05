import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Target, Building, Bell, ArrowRight, Check, MapPin, DollarSign, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const features = [
  {
    icon: Target,
    title: "Personalized Matching",
    description: "Our AI analyzes your skills, experience, and preferences to find jobs that are truly right for you.",
  },
  {
    icon: Building,
    title: "Company Insights",
    description: "Get detailed information about company culture, interview process, and employee reviews.",
  },
  {
    icon: DollarSign,
    title: "Salary Intelligence",
    description: "Access real salary data and negotiate with confidence using our compensation insights.",
  },
  {
    icon: Wifi,
    title: "Remote Filters",
    description: "Easily filter for remote, hybrid, or on-site positions that match your work preferences.",
  },
];

const stats = [
  { value: "50K+", label: "Active Jobs" },
  { value: "5K+", label: "Companies" },
  { value: "2.5x", label: "Better Match Rate" },
];

const JobsComingSoon = () => {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubscribed(true);
      toast({
        title: "You're on the list!",
        description: "We'll notify you when Job Search launches.",
      });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warning/10 border border-warning/20 text-warning text-sm font-medium mb-6">
            Coming Soon
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Smart Job Search
          </h1>
          <p className="text-muted-foreground text-lg">
            Find software engineering jobs that match your skills, experience, and career goals. Powered by AI for smarter matches.
          </p>
        </div>

        {/* Preview Search Bar */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search jobs by title, company, or skills..."
              className="pl-12 h-14 text-base"
              disabled
            />
            <Button className="absolute right-2 top-1/2 -translate-y-1/2" disabled>
              Search
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4 justify-center">
            {["React", "Python", "Remote", "Senior", "Startup"].map((tag) => (
              <span 
                key={tag}
                className="px-3 py-1 rounded-full bg-accent text-muted-foreground text-sm cursor-not-allowed opacity-50"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto mb-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
              <div className="text-muted-foreground text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto mb-16">
          {features.map((feature, index) => (
            <Card 
              key={feature.title}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mx-auto mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Email Signup */}
        <div className="max-w-md mx-auto text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto mb-6">
            <Bell className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Be First to Access Job Search
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Join the waitlist and get early access when we launch.
          </p>

          {isSubscribed ? (
            <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-success/10 border border-success/20 text-success">
              <Check className="w-5 h-5" />
              <span className="font-medium">You're on the list!</span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex gap-3">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit">
                Notify Me
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default JobsComingSoon;
