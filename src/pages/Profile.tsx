
import { Layout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy,
  Target,
  Flame,
  TrendingUp,
  Calendar,
  Edit,
  Share2,
  MapPin,
  CheckCircle2,
  Circle,
  FileText,
  Briefcase
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Profile = () => {
  const { user } = useAuth();

  // Mock user profile data
  const profile = {
    name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Career Professional",
    title: "Full Stack Developer",
    location: "Hyderabad, India",
    email: user?.email || "",
    avatar: user?.user_metadata?.avatar_url,
    resumeScore: 85,
    careerPoints: 175,
    streak: 12,
    resumesOptimized: 8,
    applicationsSubmitted: 23,
    badges: [
      { id: "first-resume", name: "First Resume", icon: "📄", earned: true },
      { id: "streak-7", name: "7-Day Streak", icon: "🔥", earned: true },
      { id: "score-90", name: "Score Master", icon: "🏆", earned: false },
      { id: "10-apps", name: "Active Applicant", icon: "💼", earned: true },
    ],
    skills: [
      { name: "React", level: 85, target: 90 },
      { name: "TypeScript", level: 70, target: 85 },
      { name: "Node.js", level: 75, target: 80 },
      { name: "System Design", level: 45, target: 70 },
      { name: "Communication", level: 80, target: 85 },
    ],
    weeklyGoals: [
      { id: 1, text: "Submit 3 job applications", completed: true },
      { id: 2, text: "Update resume with new project", completed: false },
      { id: 3, text: "Practice 2 interview questions", completed: false },
      { id: 4, text: "Network with 1 new connection", completed: true },
    ],
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Profile Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <Avatar className="w-24 h-24 border-4 border-primary/20">
              <AvatarImage src={profile.avatar} />
              <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                {profile.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-1">
                <span className="text-gradient">{profile.name}</span>
              </h1>
              <p className="text-muted-foreground">{profile.title}</p>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{profile.location}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-1" /> Edit Profile
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-1" /> Share
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid - Same style as Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Resume Score", value: `${profile.resumeScore}%`, icon: FileText, color: "text-primary" },
            { label: "Day Streak", value: profile.streak, icon: Flame, color: "text-warning" },
            { label: "Resumes", value: profile.resumesOptimized, icon: TrendingUp, color: "text-success" },
            { label: "Applications", value: profile.applicationsSubmitted, icon: Briefcase, color: "text-secondary" },
          ].map((stat) => (
            <Card key={stat.label} className="animate-fade-in-up">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-card ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Skills Progress */}
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Skill Progress
                </CardTitle>
                <CardDescription>Your skills vs target role requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.skills.map((skill) => (
                  <div key={skill.name} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{skill.name}</span>
                      <span className="text-muted-foreground">{skill.level}%</span>
                    </div>
                    <Progress value={skill.level} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Center & Right Columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Weekly Goals */}
            <Card className="animate-fade-in-up">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Weekly Goals
                  </CardTitle>
                  <Badge variant="outline">
                    {profile.weeklyGoals.filter(g => g.completed).length}/{profile.weeklyGoals.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.weeklyGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${goal.completed ? "bg-success/10 border-success/20" : "border-border"
                        }`}
                    >
                      {goal.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground" />
                      )}
                      <span className={goal.completed ? "text-muted-foreground line-through" : "text-foreground"}>
                        {goal.text}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Achievements */}
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-warning" />
                  Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {profile.badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`flex flex-col items-center p-4 rounded-lg border ${badge.earned ? "border-border" : "border-border opacity-40"
                        }`}
                    >
                      <span className="text-3xl mb-2">{badge.icon}</span>
                      <span className="text-xs text-muted-foreground">{badge.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
