"""Unit tests for Phase 17 multi-modal resume layout parser."""

import pytest
from app.extraction.multimodal_resume_parser import MultiModalResumeParser


def test_multimodal_resume_parser():
    doc = """Harshodai - Software Engineer

Experience
Built distributed backend microservices in Go and Python.

Education
BS in Computer Science.

Skills
Go, Python, React, Kubernetes
"""

    blocks = MultiModalResumeParser.parse_structural_blocks(doc)

    assert "Harshodai" in blocks["header_block"]
    assert "distributed backend" in blocks["experience_block"]
    assert "BS in Computer Science" in blocks["education_block"]
    assert "Go, Python" in blocks["skills_block"]
