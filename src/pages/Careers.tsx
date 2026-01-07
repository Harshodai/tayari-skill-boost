import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  Heart, 
  Laptop, 
  GraduationCap, 
  Coffee, 
  Plane,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";

const Careers = () => {
  const benefits = [
    { icon: Laptop, title: "Remote First", description: "Work from anywhere in the world" },
    { icon: Heart, title: "Health Coverage", description: "Comprehensive health insurance" },
    { icon: GraduationCap, title: "Learning Budget", description: "Annual budget for courses & conferences" },
    { icon: Coffee, title: "Flexible Hours", description: "Work when you're most productive" },
    { icon: Plane, title: "Unlimited PTO", description: "Take the time you need to recharge" },
    { icon: Briefcase, title: "Equity", description: "Own a piece of what you're building" }
  ];

  const openings = [
    {
      title: "Senior Full-Stack Engineer",
      department: "Engineering",
      location: "Remote",
      type: "Full-time"
    },
    {
      title: "AI/ML Engineer",
      department: "Engineering",
      location: "Remote",
      type: "Full-time"
    },
    {
      title: "Product Designer",
      department: "Design",
      location: "Remote",
      type: "Full-time"
    },
    {
      title: "Content Strategist",
      department: "Marketing",
      location: "Remote",
      type: "Full-time"
    },
    {
      title: "Customer Success Manager",
      department: "Operations",
      location: "Nairobi, Kenya",
      type: "Full-time"
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-hero">
        {/* Hero Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Join the <span className="text-gradient">Job Tayari</span> Team
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Help us build the future of career development. We're looking for passionate 
              people who want to make a real impact on job seekers worldwide.
            </p>
            <Button size="lg" asChild>
              <a href="#openings">View Open Positions</a>
            </Button>
          </div>
        </section>

        {/* Culture Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto glass rounded-2xl p-8 md:p-12 border border-border">
              <h2 className="text-3xl font-bold mb-6 text-center">Our Culture</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-primary">Impact First</h3>
                  <p className="text-muted-foreground">
                    Every line of code we write, every feature we ship, directly helps someone 
                    get closer to their dream job. We measure success by the lives we change.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-primary">Radical Transparency</h3>
                  <p className="text-muted-foreground">
                    We share openly, give honest feedback, and trust each other with information. 
                    Everyone has context to make great decisions.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-primary">Continuous Learning</h3>
                  <p className="text-muted-foreground">
                    We're building in a rapidly evolving space. Curiosity and growth mindset 
                    are essential to how we work.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-primary">Bias for Action</h3>
                  <p className="text-muted-foreground">
                    We ship fast, learn from real users, and iterate. Done is better than 
                    perfect, and we're not afraid to experiment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Perks & <span className="text-gradient">Benefits</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {benefits.map((benefit, index) => (
                <div 
                  key={index} 
                  className="glass rounded-xl p-6 border border-border card-hover"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground text-sm">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Open Positions Section */}
        <section id="openings" className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Open <span className="text-gradient">Positions</span>
            </h2>
            <div className="max-w-3xl mx-auto space-y-4">
              {openings.map((job, index) => (
                <div
                  key={index}
                  className="glass rounded-xl p-6 border border-border hover:border-primary/50 transition-all group cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-4 h-4" />
                          {job.department}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {job.type}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <p className="text-muted-foreground mb-4">
                Don't see a role that fits? We're always looking for talented people.
              </p>
              <Button variant="outline" asChild>
                <Link to="/contact">Send us your resume</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Careers;
