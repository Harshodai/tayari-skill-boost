import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is Job Tayari?",
    answer: "Job Tayari is an AI-powered job preparation platform designed specifically for software engineers. We help you optimize your resume, practice for interviews, and find personalized job matches to land your dream tech role.",
  },
  {
    question: "How does the Resume Optimizer work?",
    answer: "Our AI analyzes your resume against job descriptions to calculate a match score. It provides section-by-section feedback on skills, experience, and formatting, with actionable suggestions to improve your resume's effectiveness.",
  },
  {
    question: "Is Job Tayari free to use?",
    answer: "We offer a free tier that includes basic resume analysis and limited interview practice. Premium features like advanced AI feedback, unlimited practice sessions, and priority job matching are available with a paid subscription.",
  },
  {
    question: "What types of interviews can I practice?",
    answer: "Our platform offers mock behavioral interviews, system design discussions, and coding challenges. The AI adapts to your experience level and provides real-time feedback to help you improve.",
  },
  {
    question: "How does the job matching work?",
    answer: "Matching scores each role against your resume, stated preferences, and career goals, and shows you the reasoning behind the score. We don't publish a comparative accuracy figure — you can see the per-job breakdown and judge it yourself.",

  },
  {
    question: "Can I export my optimized resume?",
    answer: "Yes! You can export your resume in multiple formats including PDF and DOCX. We also offer professional templates that are ATS-friendly and designed to get noticed by recruiters.",
  },
  {
    question: "How do I get started?",
    answer: "Simply create a free account, upload your resume, and start optimizing! Our onboarding process guides you through setting up your profile and making the most of our platform.",
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use industry-standard encryption and never share your personal information with third parties without your consent. Your resume and interview data are kept private and secure.",
  },
];

export function FAQSection() {
  return (
    <section className="py-20 lg:py-28 bg-card/50">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-section font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-lg">
            Got questions? We've got answers. If you can't find what you're looking for, feel free to contact us.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-card border border-border/50 rounded-lg px-6 animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
