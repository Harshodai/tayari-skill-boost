import { Layout } from "@/components/layout";
import { Shield, Lock, Eye, Database, UserCheck, Bell } from "lucide-react";

const Privacy = () => {
  const sections = [
    {
      icon: Lock,
      title: "100% Local Self-Hosting Support",
      content: `Tayari supports local, on-premise execution (via Docker & Ollama). If you self-host Tayari on your own hardware, your resume files, API keys, and job details never leave your local machine. No external services are called, ensuring complete data residency and sovereignty.`
    },
    {
      icon: Shield,
      title: "No Public Model Training Guarantee",
      content: `We guarantee that your resume content, cover letters, and profile data are never sold, shared, or used to train public language models (such as OpenAI, Anthropic, or Google Gemini). Your data is processed strictly in-memory or securely stored in your isolated database instance.`
    },
    {
      icon: Database,
      title: "Information We Collect",
      content: `We collect information you provide directly, including your name, email address, and resume content. We also collect basic usage data such as browser type, device information, and interaction patterns to improve our services.`
    },
    {
      icon: Eye,
      title: "How We Use Your Information",
      content: `Your information is used to provide and improve our AI-powered career services, personalize your experience, and generate optimization suggestions and ATS scores. We process your resume data solely for optimization purposes.`
    },
    {
      icon: Lock,
      title: "Data Security",
      content: `We implement industry-standard security measures including encryption in transit and at rest, secure access controls, and regular security audits. Your resume data is stored in encrypted form and access is strictly limited.`
    },
    {
      icon: UserCheck,
      title: "Your Rights",
      content: `You have the right to access, correct, or delete your personal data at any time. You can export your data, withdraw consent for data processing, and request information about how your data is used.`
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-hero py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Privacy <span className="text-gradient">Policy</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Your privacy is important to us. This policy explains how Job Tayari collects, 
              uses, and protects your personal information.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Last updated: January 7, 2026
            </p>
          </div>

          <div className="space-y-6">
            {sections.map((section, index) => (
              <section 
                key={index} 
                className="glass rounded-xl p-6 border border-border card-hover"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <section.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold mb-3 text-foreground">
                      {section.title}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 glass rounded-xl p-6 border border-border text-center">
            <h3 className="text-lg font-semibold mb-2">Questions about your privacy?</h3>
            <p className="text-muted-foreground mb-4">
              Contact our privacy team for any concerns or requests.
            </p>
            <a 
              href="mailto:privacy@jobtayari.com" 
              className="text-primary hover:underline font-medium"
            >
              privacy@jobtayari.com
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Privacy;
