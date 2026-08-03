
import { Layout } from "@/components/layout";
import {
  HeroSection,
  FeaturesSection,
  ProductsSection,
  SocialProofSection,
  CTASection,
} from "@/components/landing";
import { TayariPet } from "@/components/pet";
import { features, settings } from "@/config/features";

const Index = () => {
  return (
    <Layout>
      <HeroSection />

      <FeaturesSection />

      {/* Products Section - Only visible in Preview mode */}
      {settings.showFullProductsSection && (
        <ProductsSection />
      )}

      <SocialProofSection />

      <CTASection />
    </Layout>
  );
};

export default Index;
