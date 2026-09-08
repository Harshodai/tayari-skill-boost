export interface CourseRecommendation {
  id: string;
  skill: string;
  title: string;
  provider: "Coursera" | "Udemy" | "DeepLearning.AI" | "Educative";
  duration: string;
  rating: number;
  reviewCount: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  description: string;
  affiliateUrl: string;
  badgeColor?: string;
}

export const COURSE_RECOMMENDATIONS: CourseRecommendation[] = [
  {
    id: "k8s-cka",
    skill: "Kubernetes",
    title: "Certified Kubernetes Administrator (CKA) with Practice Tests",
    provider: "Udemy",
    duration: "23 hours",
    rating: 4.8,
    reviewCount: "84,000+",
    level: "Intermediate",
    description: "Hands-on labs covering pods, deployments, ingress, RBAC, networking, and production cluster architecture.",
    affiliateUrl: "https://www.udemy.com/course/certified-kubernetes-administrator-with-practice-tests/?couponCode=TAYARIBOOST",
  },
  {
    id: "kafka-complete",
    skill: "Kafka",
    title: "Apache Kafka Series - Learn Apache Kafka for Beginners v3",
    provider: "Udemy",
    duration: "9.5 hours",
    rating: 4.7,
    reviewCount: "42,000+",
    level: "Intermediate",
    description: "Master event-driven architecture, partition rebalancing, consumer groups, brokers, and Kafka Connect.",
    affiliateUrl: "https://www.udemy.com/course/apache-kafka/?couponCode=TAYARIBOOST",
  },
  {
    id: "sys-design-interview",
    skill: "System Design",
    title: "Grokking Modern System Design for Software Engineers & Managers",
    provider: "Educative",
    duration: "30 hours",
    rating: 4.9,
    reviewCount: "28,000+",
    level: "Advanced",
    description: "Battle-tested blueprints: distributed caches, load balancers, rate limiters, sharding, and high-availability patterns.",
    affiliateUrl: "https://www.educative.io/courses/grokking-modern-system-design-for-software-engineers-managers?aff=tayari",
  },
  {
    id: "graphql-complete",
    skill: "GraphQL",
    title: "GraphQL with React: The Complete Developers Guide",
    provider: "Udemy",
    duration: "13.5 hours",
    rating: 4.7,
    reviewCount: "16,000+",
    level: "Intermediate",
    description: "Build robust GraphQL schemas, queries, mutations, resolvers, and Apollo Client caching architectures.",
    affiliateUrl: "https://www.udemy.com/course/graphql-with-react-course/?couponCode=TAYARIBOOST",
  },
  {
    id: "nextjs-mastery",
    skill: "Next.js",
    title: "Next.js 15 & React - The Complete Guide",
    provider: "Udemy",
    duration: "32 hours",
    rating: 4.8,
    reviewCount: "53,000+",
    level: "Intermediate",
    description: "App Router, Server Components (RSC), Server Actions, ISR, streaming, SEO optimization, and auth workflows.",
    affiliateUrl: "https://www.udemy.com/course/nextjs-react-the-complete-guide/?couponCode=TAYARIBOOST",
  },
  {
    id: "pytorch-dl",
    skill: "PyTorch",
    title: "Deep Learning Specialization with PyTorch",
    provider: "DeepLearning.AI",
    duration: "3 months (5h/week)",
    rating: 4.9,
    reviewCount: "120,000+",
    level: "Intermediate",
    description: "Taught by Andrew Ng. Build neural networks, CNNs, Transformers, and modern deep learning models in PyTorch.",
    affiliateUrl: "https://www.deeplearning.ai/courses/deep-learning-specialization/?partner=tayari",
  },
  {
    id: "golang-mastery",
    skill: "Golang",
    title: "Go: The Complete Developer's Guide (Golang)",
    provider: "Udemy",
    duration: "11 hours",
    rating: 4.7,
    reviewCount: "37,000+",
    level: "Beginner",
    description: "Idiomatic Go: goroutines, channels, interfaces, pointers, HTTP microservices, and concurrent system patterns.",
    affiliateUrl: "https://www.udemy.com/course/go-the-complete-developers-guide/?couponCode=TAYARIBOOST",
  },
  {
    id: "aws-solutions-architect",
    skill: "AWS",
    title: "Ultimate AWS Certified Solutions Architect Associate (SAA-C03)",
    provider: "Udemy",
    duration: "27 hours",
    rating: 4.8,
    reviewCount: "210,000+",
    level: "Intermediate",
    description: "Full mastery of AWS VPC, EC2, ECS/EKS, S3, RDS, DynamoDB, Lambda, IAM, and cost-effective cloud architectures.",
    affiliateUrl: "https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/?couponCode=TAYARIBOOST",
  },
  {
    id: "docker-devops",
    skill: "Docker",
    title: "Docker & Kubernetes: The Practical Guide",
    provider: "Udemy",
    duration: "23.5 hours",
    rating: 4.8,
    reviewCount: "75,000+",
    level: "Intermediate",
    description: "Multi-stage builds, container security, Docker Compose microservices orchestration, and deployment workflows.",
    affiliateUrl: "https://www.udemy.com/course/docker-kubernetes-the-practical-guide/?couponCode=TAYARIBOOST",
  },
  {
    id: "distributed-systems",
    skill: "Distributed Systems",
    title: "Cloud Computing Specialization: Distributed Systems in Practice",
    provider: "Coursera",
    duration: "4 months (4h/week)",
    rating: 4.8,
    reviewCount: "19,000+",
    level: "Advanced",
    description: "Consensus algorithms (Raft, Paxos), replication, CAP theorem, gossip protocols, and fault tolerance at scale.",
    affiliateUrl: "https://www.coursera.org/specializations/cloud-computing?partner=tayari",
  },
  {
    id: "genai-llm",
    skill: "Generative AI",
    title: "Generative AI with Large Language Models",
    provider: "DeepLearning.AI",
    duration: "3 weeks",
    rating: 4.9,
    reviewCount: "45,000+",
    level: "Advanced",
    description: "Instruction fine-tuning, PEFT/LoRA, RLHF, vector embeddings, RAG architectures, and LLM evaluation.",
    affiliateUrl: "https://www.deeplearning.ai/courses/generative-ai-with-llms/?partner=tayari",
  },
  {
    id: "redis-caching",
    skill: "Redis",
    title: "Redis: The Complete Developer's Guide",
    provider: "Udemy",
    duration: "15 hours",
    rating: 4.7,
    reviewCount: "9,500+",
    level: "Intermediate",
    description: "In-memory caching architectures, Redis Streams, pub/sub, Lua scripting, transactions, and distributed locks.",
    affiliateUrl: "https://www.udemy.com/course/redis-the-complete-developers-guide-p/?couponCode=TAYARIBOOST",
  },
];

/**
 * Finds curated course recommendations matching candidate skill gaps.
 * Performs case-insensitive fuzzy keyword matching and deduplicates.
 * Falls back to foundational high-leverage courses if no specific match is found.
 */
export function getCourseRecommendationsForGaps(
  skillGaps: string[],
  limit = 4
): CourseRecommendation[] {
  if (!skillGaps || skillGaps.length === 0) {
    return COURSE_RECOMMENDATIONS.slice(0, limit);
  }

  const normalizedGaps = skillGaps.map((g) => g.trim().toLowerCase()).filter(Boolean);
  const matchedCourses: CourseRecommendation[] = [];
  const seenIds = new Set<string>();

  for (const gap of normalizedGaps) {
    const gapTokens = new Set(gap.split(/[^a-z0-9+#]+/).filter(Boolean));
    const hasToken = (...tokens: string[]) => tokens.some((t) => gapTokens.has(t));
    for (const course of COURSE_RECOMMENDATIONS) {
      if (seenIds.has(course.id)) continue;

      const skillLower = course.skill.toLowerCase();
      const skillTokens = new Set(skillLower.split(/[^a-z0-9+#]+/).filter(Boolean));
      const sharesToken = [...skillTokens].some((t) => t.length >= 2 && gapTokens.has(t));
      // Check exact match, whole-token overlap, or longer-substring match (min 4 chars)
      if (
        gap === skillLower ||
        sharesToken ||
        (skillLower.length >= 4 && gap.includes(skillLower)) ||
        (gap.length >= 4 && skillLower.includes(gap)) ||
        (skillLower === "system design" && hasToken("architecture", "distributed", "design", "systems")) ||
        (skillLower === "golang" && hasToken("go", "golang")) ||
        (skillLower === "kubernetes" && hasToken("k8s", "kubernetes", "container", "containers")) ||
        (skillLower === "aws" && hasToken("cloud", "amazon", "aws")) ||
        (skillLower === "generative ai" && hasToken("ai", "llm", "nlp", "rag", "genai", "generative"))
      ) {
        matchedCourses.push(course);
        seenIds.add(course.id);
        if (matchedCourses.length >= limit) break;
      }
    }
    if (matchedCourses.length >= limit) break;
  }

  // Fallback to top-rated general courses if fewer than 2 matched
  if (matchedCourses.length < 2) {
    for (const fallback of COURSE_RECOMMENDATIONS) {
      if (!seenIds.has(fallback.id)) {
        matchedCourses.push(fallback);
        seenIds.add(fallback.id);
        if (matchedCourses.length >= limit) break;
      }
    }
  }

  return matchedCourses.slice(0, limit);
}
