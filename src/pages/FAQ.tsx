import { Layout } from "@/components/layout";
import { FAQSection, faqs } from "@/components/landing/FAQSection";
import { Seo } from "@/components/seo/Seo";

const FAQ = () => {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <Layout>
      <Seo
        title="Job Tayari FAQ — Resume, ATS & Apply Assist Answers"
        description="Answers about Job Tayari's resume optimizer, ATS scoring, job matching, apply assist guardrails, pricing, exports, and data security."
        path="/faq"
        jsonLd={faqJsonLd}
      />
      <div className="py-8">
        <h1 className="sr-only">Job Tayari frequently asked questions</h1>
        <FAQSection />
      </div>
    </Layout>
  );
};

export default FAQ;
