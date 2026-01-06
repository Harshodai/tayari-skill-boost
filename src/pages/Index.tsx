import { Layout } from "@/components/layout";
import {
  HeroSection,
  FeaturesSection,
  ProductsSection,
  SocialProofSection,
  CTASection,
} from "@/components/landing";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <FeaturesSection />
      <ProductsSection />
      <SocialProofSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
