import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Swords, Code, Bell, ArrowRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const features = [
  {
    icon: Mic,
    title: "Mock Interview",
    description: "Practice with AI interviewers that simulate real technical and behavioral interviews. Get instant feedback on your responses.",
    gradient: "from-primary to-primary-dark",
  },
  {
    icon: Swords,
    title: "Clash of Code",
    description: "Compete in real-time coding battles against other developers. Climb the leaderboard and sharpen your skills under pressure.",
    gradient: "from-secondary to-success",
  },
  {
    icon: Code,
    title: "Practice Problems",
    description: "Master data structures and algorithms with 500+ curated challenges. Filter by company, difficulty, and topic.",
    gradient: "from-warning to-destructive",
  },
];

const InterviewComingSoon = () => {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubscribed(true);
      toast({
        title: "You're on the list!",
        description: "We'll notify you when Interview Mode launches.",
      });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warning/10 border border-warning/20 text-warning text-sm font-medium mb-6">
            Coming Soon
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Interview Prep Mode
          </h1>
          <p className="text-muted-foreground text-lg">
            Practice technical interviews, compete in coding challenges, and master algorithms. All powered by AI and designed for software engineers.
          </p>
        </div>

        {/* Feature Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          {features.map((feature, index) => (
            <Card 
              key={feature.title} 
              className="overflow-hidden animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`bg-gradient-to-r ${feature.gradient} p-6`}>
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-background/20 backdrop-blur-sm">
                  <feature.icon className="w-7 h-7 text-primary-foreground" />
                </div>
              </div>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
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
            Get Notified When We Launch
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Be the first to know when Interview Mode is ready. No spam, just one email.
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

export default InterviewComingSoon;
