import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is Job Tayari?",
    answer: "Job Tayari is an AI-assisted career preparation platform for software engineers. It helps you organize resumes, interview practice, job matching, and application review; it does not guarantee a particular interview or hiring outcome.",
  },
  {
    question: "How does the Resume Optimizer work?",
    answer: "Our AI analyzes your resume against job descriptions to calculate a match score. It provides section-by-section feedback on skills, experience, and formatting, with actionable suggestions to improve your resume's effectiveness.",
  },
  {
    question: "Is Job Tayari free to use?",
    answer: "Available plans are shown on the pricing page. Free tools have rate and feature limits, and paid features may depend on the deployment and configured provider. We do not describe a feature as unlimited unless the active plan and backend enforce that limit.",
  },
  {
    question: "What types of interviews can I practice?",
    answer: "The platform offers supported mock interview workflows, including behavioral and technical practice. Availability, model behavior, and feedback latency depend on the enabled feature and provider configuration.",
  },
  {
    question: "How does the job matching work?",
    answer: "Matching scores each role against your resume, stated preferences, and career goals, and shows you the reasoning behind the score. We don't publish a comparative accuracy figure — you can see the per-job breakdown and judge it yourself.",

  },
  {
    question: "Can I export my optimized resume?",
    answer: "Supported resume workflows can export PDF and DOCX artifacts. ATS behavior differs by vendor, so exports are designed for readable structure but are not a guarantee of ranking or recruiter response.",
  },
  {
    question: "How do I get started?",
    answer: "Simply create a free account, upload your resume, and start optimizing! Our onboarding process guides you through setting up your profile and making the most of our platform.",
  },
  {
    question: "Is my data secure?",
    answer: "Security and data residency depend on the deployment mode and integrations you enable. The product uses access controls and protected service boundaries, but remote AI, Gmail, browser, and analytics integrations can process data under their own terms. Review the privacy page and ledger before connecting them.",
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
