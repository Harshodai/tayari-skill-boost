
import { Layout } from "@/components/layout";
import {
  HeroSection,
  FeaturesSection,
  ProductsSection,
  SocialProofSection,
  CTASection,
} from "@/components/landing";
import { FEATURE_FLAGS } from "@/config/features";

const Index = () => {
  return (
    <Layout>
      <HeroSection />

      <FeaturesSection />

      {/* Products Section - Only visible in Preview mode */}
      {FEATURE_FLAGS.showFullProductsSection && (
        <ProductsSection />
      )}

      <SocialProofSection />

      <CTASection />
    </Layout>
  );
};

export default Index;
