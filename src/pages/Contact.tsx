import { Layout } from "@/components/layout";
import { ContactSection } from "@/components/landing/ContactSection";
import { Seo } from "@/components/seo/Seo";

const Contact = () => {
  return (
    <Layout>
      <Seo
        title="Contact Job Tayari — Support & Sales"
        description="Get in touch with the Job Tayari team about support, self-hosting, partnerships, or feedback on the AI career pipeline."
        path="/contact"
      />
      <div className="py-8">
        <h1 className="sr-only">Contact the Job Tayari team</h1>
        <ContactSection />
      </div>
    </Layout>
  );
};

export default Contact;
