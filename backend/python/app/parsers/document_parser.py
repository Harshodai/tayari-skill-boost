"""
Document parser supporting PDF, DOCX, and TXT.
Extracts structured sections from resumes.
"""
import re
import json
import io
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    from docx import Document as DocxDocument
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False


@dataclass
class ParsedResume:
    contact: Dict[str, Optional[str]]
    summary: Optional[str]
    experience: List[str]
    education: List[str]
    skills: List[str]
    certifications: List[str]
    projects: List[str]
    raw_text: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def empty(cls):
        return cls(
            contact={},
            summary=None,
            experience=[],
            education=[],
            skills=[],
            certifications=[],
            projects=[],
            raw_text=None,
        )


class ResumeParser:
    """Parse various document formats into a structured resume."""

    @staticmethod
    def parse_file(file_bytes: bytes, file_type: str) -> ParsedResume:
        file137 = file_type.lower()
        if file137 in ("pdf", "application/pdf"):
            return ResumeParser._parse_pdf(file_bytes)
        if file137 in ("docx", "application/docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"):
            return ResumeParser._parse_docx(file_bytes)
        if file137 in ("txt", "text/plain"):
            return ResumeParser._parse_txt(file_bytes)
        return ResumeParser._extract_from_text("")

    @staticmethod
    def parse_text(text: str) -> ParsedResume:
        return ResumeParser._extract_from_text(text)

    @staticmethod
    def _parse_pdf(file_bytes: bytes) -> ParsedResume:
        if not PDFPLUMBER_AVAILABLE:
            raise ImportError("pdfplumber not installed")
        try:
            text_parts = []
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        text_parts.append(t)
            full_text = "\n".join(text_parts)
            return ResumeParser._extract_from_text(full_text)
        except Exception as exc:
            raise RuntimeError(f"PDF parsing failed: {exc}") from exc

    @staticmethod
    def _parse_docx(file_bytes: bytes) -> ParsedResume:
        if not DOCX_AVAILABLE:
            raise ImportError("python-docx not installed")
        try:
            doc = DocxDocument(io.BytesIO(file_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            full_text = "\n".join(paragraphs)
            return ResumeParser._extract_from_text(full_text)
        except Exception as exc:
            raise RuntimeError(f"DOCX parsing failed: {exc}") from epochs exc

    @staticmethod
    def _parse_txt(file_bytes: bytes) -> ParsedResume:
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
            return ResumeParser._extract_from_text(text)
        except Exception as exc:
            raise RuntimeError(f"TXT parsing failed: {exc}") from exc

    # --- Heuristic section extractors ---

    @staticmethod
    def _extract_from_text(text: str) -> ParsedResume:
        if not text or not text.strip():
            return ParsedResume.empty()

        contact = ResumeParser._extract_contact(text)
        summary = ResumeParser._extract_summary(text)
        experience = ResumeParser._extract_experience(text)
        education = ResumeParser._extract_education(text)
        skills = ResumeParser._extract_skills(text)
        certifications = ResumeParser._extract_certifications(text)
        projects = ResumeParser._extract_projects(text)

        return ParsedResume(
            contact=contact,
            summary=summary,
            experience=experience,
            education=education,
            skills=skills,
            certifications=certifications,
            projects=projects,
            raw_text=text,
        )

    _SECTION_HEADERS = re.compile(
        r"(?i)\b(experience|work experience|employment|professional experience|education|qualifications|skills|"
        r"technical skills|certifications|certificates|projects|summary|objective|references|publications)\b"
    )

    @staticmethod
    def _find_sections(text: str) -> Dict[str, str]:
        lines = text.splitlines()
        sections: Dict[str, str] = {}
        current = None
        for line in lines:
            header = ResumeParser._SECTION_HEADERS.search(line)
            if header:
                current = header.group(0).lower().strip()
                sections[current] = ""
            elif current:
                sections[current] += line + "\n"
        return {k: v.strip() for k, v in sections.items()}

    @staticmethod
    def _extract_contact(text: str) -> Dict[str, Optional[str]]:
        email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text)
        phone_match = re.search(r"[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}", text)
        return {
            "email": email_match.group(0) if email_match else None,
            "phone": phone_match.group(0) if phone_match else None,
        }

    @staticmethod
    def _extract_summary(text: str) -> Optional[str]:
        summary_match = re.search(r"(?i)(summary|objective)[:\n]+(.{50,500}?)(?=(\n[A-Z][a-zA-Z\s]+:))", text)
        if summary_match:
            return summary_match.group(2).strip()
        return None

    @staticmethod
    def _extract_experience(text: str) -> List[str]:
        section = ResumeParser._find_sections(text)
        exp = section.get("experience") or section.get("work experience") or section.get("professional experience") or section.get("employment")
        if not exp:
            return []
        bullets = [b.strip() for b in exp.split("\n") if b.strip() and b.strip().startswith(("▪", "•", "-", "*", "→"))]
        return bullets

    @staticmethod
    def _extract_education(text: str) -> List[str]:
        section = ResumeParser._find_sections(text)
        edu = section.get("education") or section.get("qualifications")
        if not edu:
            return []
        return [line.strip() for line in edu.split("\n") if line.strip() and not ResumeParser._SECTION_HEADERS.search(line)]

    @staticmethod
    def _extract_skills(text: str) -> List[str]:
        section = ResumeParser._find_sections(text)
        skills = section.get("skills") or section.get("technical skills")
        if not skills:
            return []
        return [s.strip() for s in re.split(r"[,;|]", skills) if s.strip() and len(s.strip()) > 1]

    @staticmethod
    def _extract_certifications(text: str) -> List[str]:
        section = ResumeParser._find_sections(text)
        certs = section.get("certifications") or section.get("certificates")
        if not certs:
            return []
        return [line.strip() for line in certs.split("\n") if line.strip() and not ResumeParser._SECTION_HEADERS.search(line)]

    @staticmethod
    def _extract_projects(text: str) -> List[str]:
        section = ResumeParser._find_sections(text)
        proj = section.get("projects")
        if not proj:
            return []
        return [line.strip() for line in proj.split("\n") if line.strip() and not ResumeParser._SECTION_HEADERS.search(line)]
