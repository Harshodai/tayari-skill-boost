import { Seo } from "@/components/seo/Seo";
import { Layout } from "@/components/layout";

const Terms = () => {
  return (
    <Layout>
      <Seo
        title="Terms of Service — Job Tayari"
        description="The terms governing your use of Job Tayari's resume, job search, and application assistance services."
        path="/terms"
      />
      <div className="min-h-screen bg-gradient-hero py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Terms of <span className="text-gradient">Service</span>
            </h1>
            <p className="text-muted-foreground">
              Last updated: January 7, 2026
            </p>
          </div>

          <div className="space-y-8 text-foreground/90">
            <section className="glass rounded-xl p-6 border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-primary">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using Job Tayari's services, you accept and agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our services. We reserve the right to modify these 
                terms at any time, and your continued use of our services constitutes acceptance of any changes.
              </p>
            </section>

            <section className="glass rounded-xl p-6 border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-primary">2. Description of Services</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Job Tayari provides AI-powered career development tools including:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Resume optimization and ATS scoring</li>
                <li>AI-powered interview preparation</li>
                <li>Job matching and recommendations</li>
                <li>Career guidance and resources</li>
              </ul>
            </section>

            <section className="glass rounded-xl p-6 border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-primary">3. User Accounts</h2>
              <p className="text-muted-foreground leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities 
                that occur under your account. You must provide accurate and complete information when creating an account. 
                You agree to notify us immediately of any unauthorized use of your account or any other security breach.
              </p>
            </section>

            <section className="glass rounded-xl p-6 border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-primary">4. User Content</h2>
              <p className="text-muted-foreground leading-relaxed">
                You retain ownership of any content you upload to our platform, including resumes and personal information. 
                By uploading content, you grant Job Tayari a non-exclusive license to process and analyze your content 
                solely for the purpose of providing our services. We will not share your personal documents with third 
                parties without your explicit consent.
              </p>
            </section>

            <section className="glass rounded-xl p-6 border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-primary">5. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All content, features, and functionality of Job Tayari's services, including but not limited to software, 
                algorithms, designs, and trademarks, are owned by Job Tayari and are protected by international copyright, 
                trademark, and other intellectual property laws.
              </p>
            </section>

            <section className="glass rounded-xl p-6 border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-primary">6. Prohibited Uses</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Use the service for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Transmit malware or malicious code</li>
                <li>Scrape or collect data without permission</li>
                <li>Interfere with other users' access to the service</li>
              </ul>
            </section>

            <section className="glass rounded-xl p-6 border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-primary">7. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                Job Tayari provides its services "as is" without warranties of any kind. We are not liable for any indirect, 
                incidental, special, consequential, or punitive damages arising from your use of our services. Our AI 
                recommendations are suggestions and should not be considered as professional career advice.
              </p>
            </section>

            <section className="glass rounded-xl p-6 border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-primary">8. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at{" "}
                <a href="mailto:legal@jobtayari.com" className="text-primary hover:underline">
                  legal@jobtayari.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Terms;
