export interface ResumeSection {
  name: string;
  score: number;
  suggestions: string[];
}

export interface ResumeAnalysisResult {
  overallScore: number;
  sections: ResumeSection[];
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryRecommendation: string;
}

export interface AnalyzeResumeRequest {
  resumeText: string;
  jobDescription: string;
  customInstructions?: string;
  aiOptions: {
    emphasizeKeywords: boolean;
    quantifyAchievements: boolean;
    optimizeFormat: boolean;
    tailorSummary: boolean;
  };
}

export interface AnalyzeResumeResponse {
  success: boolean;
  data?: ResumeAnalysisResult;
  error?: string;
}
