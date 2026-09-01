import { Seo } from "@/components/seo/Seo";
import { Layout } from "@/components/layout";
import { Shield, Lock, Eye, Database, UserCheck, Server } from "lucide-react";

const sections = [
  {
    icon: Server,
    title: "Self-hosted deployments",
    content:
      "When an operator runs Tayari on their own infrastructure, the operator controls the database, logs, backups, model endpoints, and network egress. Resume files and job details remain within that environment unless the operator enables an external provider or integration. Self-hosting is not a promise that every configured provider is local.",
  },
  {
    icon: Eye,
    title: "Hosted deployments and AI providers",
    content:
      "In a hosted deployment, account data is processed by the Tayari services that the operator has deployed. AI requests may be sent to the configured model provider. The provider, model, endpoint, and retention terms can differ by deployment, so review the provider disclosure and the privacy ledger before uploading sensitive material. Tayari does not claim that every provider has identical training or retention policies.",
  },
  {
    icon: Database,
    title: "Information the product can store",
    content:
      "Depending on the features you use, the service can store account and profile details, resumes, job descriptions, applications, interview or communication records, generated documents, approval and submission receipts, privacy-ledger entries, and connected browser-session artifacts. The product should collect only what is needed for the selected workflow.",
  },
  {
    icon: Lock,
    title: "Retention and deletion",
    content:
      "User-scoped records are retained until you delete them or the deployment operator applies a shorter retention policy. Account deletion requests remove user-owned application data, session records, audit entries, and runtime state where the configured cleanup paths succeed. Encrypted backups, provider-side copies, security logs, and legally required records may survive until their documented rotation or provider retention period; deletion is not instantaneous across every copy.",
  },
  {
    icon: Shield,
    title: "Security and sharing",
    content:
      "The project enforces authenticated access, tenant isolation, service-to-service authentication, bounded request budgets, and release security checks. We do not sell personal data. If you enable Gmail, browser automation, analytics, or a remote AI provider, data is shared only as required for that feature and is subject to the relevant connector or provider terms. Do not connect an account or upload a document unless you accept that workflow.",
  },
  {
    icon: UserCheck,
    title: "Your controls",
    content:
      "You can review the privacy ledger, export account data, disconnect supported integrations, clear the ledger where the deployment enables that control, and request account deletion. If a deployment does not expose a control or reports an incomplete cleanup, contact the operator before relying on it for sensitive data.",
  },
];

const Privacy = () => {
  return (
    <Layout>
      <Seo
        title="Privacy Policy — Job Tayari"
        description="How Job Tayari collects, stores, and protects your resume and application data, including self-hosting and data deletion options."
        path="/privacy"
      />
      <div className="min-h-screen bg-gradient-hero py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="mb-12 text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mb-4 text-4xl font-bold md:text-5xl">
              Privacy <span className="text-gradient">and data controls</span>
            </h1>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              This page describes what the product can process and which claims depend on deployment configuration. It is a product disclosure, not a substitute for the operator&apos;s complete legal policy.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: August 14, 2026</p>
          </div>

          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.title} className="glass rounded-xl border border-border p-6 card-hover">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="mb-3 text-xl font-semibold text-foreground">{section.title}</h2>
                    <p className="leading-relaxed text-muted-foreground">{section.content}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 glass rounded-xl border border-border p-6 text-center">
            <h2 className="mb-2 text-lg font-semibold">Questions about data handling?</h2>
            <p className="mb-4 text-muted-foreground">
              Contact the deployment operator or privacy team and include the deployment mode and integration involved.
            </p>
            <a href="mailto:privacy@jobtayari.com" className="font-medium text-primary hover:underline">
              privacy@jobtayari.com
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Privacy;
