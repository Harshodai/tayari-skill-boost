"""AI Interactive Portfolio Generator — Tayari AI Engine.

Generates responsive, single-page HTML/CSS portfolio websites directly from candidate's
Knowledge Graph data, showcasing project metrics, skills, experience, and contact CTAs.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


PORTFOLIO_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VAR_FULL_NAME | VAR_HEADLINE</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <!-- Hero Section -->
  <header class="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
    <div class="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
      <span class="font-extrabold text-xl tracking-tight text-white">VAR_FULL_NAME</span>
      <a href="mailto:VAR_EMAIL" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all">Get in Touch</a>
    </div>
  </header>

  <main class="max-w-5xl mx-auto px-6 py-12 space-y-16">
    <!-- Intro Hero -->
    <section class="space-y-4">
      <div class="inline-block bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold px-3 py-1 rounded-full">Available for Roles</div>
      <h1 class="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">Hi, I'm VAR_FULL_NAME 👋</h1>
      <p class="text-xl text-slate-400 max-w-2xl">VAR_HEADLINE</p>
      <p class="text-slate-300 max-w-3xl leading-relaxed">VAR_SUMMARY</p>
    </section>

    <!-- Key Skills -->
    <section class="space-y-4">
      <h2 class="text-2xl font-bold text-white tracking-tight">Core Competencies</h2>
      <div class="flex flex-wrap gap-2.5">
        VAR_SKILLS_TAGS
      </div>
    </section>

    <!-- Experience Timeline -->
    <section class="space-y-6">
      <h2 class="text-2xl font-bold text-white tracking-tight">Featured Experience</h2>
      <div class="space-y-6">
        VAR_EXPERIENCE_BLOCKS
      </div>
    </section>

    <!-- Contact CTA -->
    <section class="p-8 rounded-2xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-800/50 text-center space-y-4">
      <h2 class="text-2xl font-bold text-white">Let's Build Something Great Together</h2>
      <p class="text-slate-300 max-w-md mx-auto">Open to senior engineering roles, technical leadership, and strategic advisory positions.</p>
      <div>
        <a href="mailto:VAR_EMAIL" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-lg transition-all">Contact VAR_FULL_NAME</a>
      </div>
    </section>
  </main>

  <footer class="border-t border-slate-800 py-8 text-center text-slate-500 text-sm">
    © 2026 VAR_FULL_NAME. Powered by Tayari AI Engine.
  </footer>
</body>
</html>
"""


def generate_portfolio_html(data: Dict[str, Any]) -> str:
    """Generate responsive HTML portfolio from candidate profile dictionary."""
    full_name = data.get("full_name") or data.get("name") or "Candidate Name"
    headline = data.get("headline") or "Software Engineer & AI Specialist"
    summary = data.get("summary") or "Passionate software engineer building high-impact web applications, microservices, and AI products."
    email = data.get("email") or "candidate@example.com"

    # Skills tags
    skills = data.get("skills") or ["Go", "Python", "React", "Docker", "Kubernetes", "TypeScript", "PostgreSQL", "AWS"]
    if isinstance(skills, str):
        skills = [s.strip() for s in skills.split(",")]

    skills_tags = "".join(
        f'<span class="bg-slate-800/80 text-slate-200 border border-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg">{s}</span>'
        for s in skills[:20]
    )

    # Experience blocks
    raw_exp = data.get("experience") or data.get("experiences") or []
    exp_html = []
    if isinstance(raw_exp, list) and raw_exp:
        for exp in raw_exp:
            if isinstance(exp, dict):
                title = exp.get("title") or exp.get("role") or "Software Engineer"
                company = exp.get("company") or "Technology Co"
                dates = exp.get("dates") or exp.get("duration") or "2023 - Present"
                bullets = exp.get("bullets") or exp.get("achievements") or ["Built scalable cloud services."]

                bullet_items = "".join(f'<li class="text-slate-300 text-sm">{b}</li>' for b in bullets[:4])
                exp_html.append(f"""
                <div class="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div class="flex justify-between items-start">
                    <div>
                      <h3 class="text-lg font-bold text-white">{title}</h3>
                      <div class="text-blue-400 font-medium text-sm">{company}</div>
                    </div>
                    <span class="text-xs text-slate-400 font-mono">{dates}</span>
                  </div>
                  <ul class="list-disc list-inside space-y-1.5">
                    {bullet_items}
                  </ul>
                </div>
                """)
    else:
        exp_html.append("""
        <div class="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 class="text-lg font-bold text-white">Senior Software Engineer</h3>
          <div class="text-blue-400 font-medium text-sm">Tech Platform Corp</div>
          <ul class="list-disc list-inside space-y-1.5 text-slate-300 text-sm">
            <li>Led the architecture and migration of microservices handling 10M+ daily events.</li>
            <li>Reduced latency by 45% using Redis caching and Go concurrency patterns.</li>
          </ul>
        </div>
        """)

    experience_blocks = "".join(exp_html)

    html = PORTFOLIO_HTML_TEMPLATE.replace("VAR_FULL_NAME", str(full_name))
    html = html.replace("VAR_HEADLINE", str(headline))
    html = html.replace("VAR_SUMMARY", str(summary))
    html = html.replace("VAR_EMAIL", str(email))
    html = html.replace("VAR_SKILLS_TAGS", skills_tags)
    html = html.replace("VAR_EXPERIENCE_BLOCKS", experience_blocks)

    return html
