import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Software Engineer at Google",
    avatar: "SC",
    content: "Job Tayari helped me optimize my resume and land interviews at FAANG companies. The AI suggestions were incredibly accurate!",
    rating: 5,
  },
  {
    name: "Marcus Johnson",
    role: "Senior Developer at Stripe",
    avatar: "MJ",
    content: "The mock interview feature is a game-changer. I felt so much more confident going into my actual interviews after practicing here.",
    rating: 5,
  },
  {
    name: "Priya Patel",
    role: "Full Stack Developer at Airbnb",
    avatar: "PP",
    content: "Found my dream job through the personalized job matching. The platform understood exactly what I was looking for.",
    rating: 5,
  },
];

const stats = [
  { value: "10,000+", label: "Engineers Helped" },
  { value: "95%", label: "Satisfaction Rate" },
  { value: "2.5x", label: "More Interview Calls" },
  { value: "45%", label: "Higher Offers" },
];

export function SocialProofSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-20">
          {stats.map((stat, index) => (
            <div 
              key={stat.label} 
              className="text-center p-6 rounded-xl bg-card border border-border/50 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="text-3xl lg:text-4xl font-bold text-primary mb-2">
                {stat.value}
              </div>
              <div className="text-muted-foreground text-sm">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-section font-bold text-foreground mb-4">
            Loved by Engineers Worldwide
          </h2>
          <p className="text-muted-foreground text-lg">
            Join thousands of software engineers who've accelerated their careers with Job Tayari.
          </p>
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={testimonial.name} 
              className="relative animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="pt-6">
                {/* Quote Icon */}
                <Quote className="w-8 h-8 text-primary/20 mb-4" />

                {/* Rating */}
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>

                {/* Content */}
                <p className="text-foreground mb-6">
                  "{testimonial.content}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary font-semibold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">
                      {testimonial.name}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
