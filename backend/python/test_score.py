import sys
import os

from app.analysis.similarity import KeywordAnalyzer
from app.analysis.ngram_analyzer import NGramAnalyzer
from app.scoring.ats_scorer import ATSScorer

# Read from files inside /app (mounted workspace)
resume_path = "/app/backend/python/extracted_resume_text.txt"
jd_path = "/app/backend/python/stripe_jd.txt"

if not os.path.exists(resume_path):
    print(f"Error: {resume_path} does not exist")
    sys.exit(1)

if not os.path.exists(jd_path):
    print(f"Error: {jd_path} does not exist")
    sys.exit(1)

with open(resume_path, "r") as f:
    resume_text = f.read()

with open(jd_path, "r") as f:
    jd_text = f.read()

keyword_analyzer = KeywordAnalyzer()
ngram_analyzer = NGramAnalyzer()
ats_scorer = ATSScorer()

keywords = keyword_analyzer.analyze(resume_text, jd_text)
ngrams = ngram_analyzer.analyze(resume_text, jd_text)

print(f"Total JD keywords: {keywords.total_jd_keywords}")
print(f"Matched count: {keywords.matched_count}")
print(f"Matched keywords: {keywords.found[:10]}...")

result = ats_scorer.score(keywords, ngrams, None, resume_text)
print(f"Composite Score: {result.score}")
print(f"Breakdown: {result.breakdown}")
