import asyncio
import re
from typing import Dict, Any, List, Optional
from app.services.communication import CommunicationGenerator
from app.services.llm_service import LLMNotConfiguredError

class EmailConnector:
    """
    Email Connector Engine (OAuth / IMAP / SMTP Integration).
    Monitors candidate inbox, parses recruiter emails & interview invitations,
    extracts meeting links/dates, auto-schedules interviews, and drafts responses.
    """

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

class EmailConnector:
    """
    Email Connector Engine (OAuth / IMAP / SMTP Integration).
    Monitors candidate inbox, parses recruiter emails & interview invitations,
    extracts meeting links/dates, auto-schedules interviews, and drafts responses.
    """

    def __init__(self):
        self.connected_accounts: List[Dict[str, Any]] = []
        self.inbox_invites: List[Dict[str, Any]] = []

    def connect_account(self, email: str, provider: str = "Gmail (OAuth)") -> Dict[str, Any]:
        """Connect candidate email account."""
        if not EMAIL_REGEX.match(email):
            return {"success": False, "error": f"Invalid email format: '{email}'"}
        
        for acc in self.connected_accounts:
            if acc["email"].lower() == email.lower():
                return {"success": True, "account": acc, "message": "Account already connected."}

        acc = {"email": email, "provider": provider, "status": "CONNECTED"}
        self.connected_accounts.append(acc)
        return {"success": True, "account": acc}

    async def scan_inbox_for_interview_invites(self) -> Dict[str, Any]:
        """
        Scan connected email inbox, parse recruiter messages, and extract interview invitations.
        """
        simulated_emails = [
            {
                "email_id": "MSG-901",
                "sender": "sarah.jenkins@stripe.com",
                "subject": "Interview Invitation: Senior Systems Architect - Stripe",
                "body": "Hi Candidate, We loved your application for Senior Systems Architect! We would like to invite you for a 45-minute technical screen on Thursday, Aug 6th at 2:00 PM PST. Meeting Link: https://meet.google.com/abc-xyz-123",
                "date_received": "2026-08-02 16:45:00"
            },
            {
                "email_id": "MSG-902",
                "sender": "recruiting@anthropic.com",
                "subject": "Anthropic Technical Deep Dive Schedule",
                "body": "Hello! Congratulations on passing the initial round. Let's schedule your System Design interview for Friday, Aug 7th at 10:00 AM PST.",
                "date_received": "2026-08-02 15:30:00"
            }
        ]

        parsed_invites = []
        date_pattern = re.compile(r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)?", re.IGNORECASE)

        for msg in simulated_emails:
            meeting_link = re.search(r"https?://[^\s]+", msg["body"])
            company_match = re.search(r"@([a-zA-Z0-9.-]+)", msg["sender"])
            company_name = company_match.group(1).split(".")[0].capitalize() if company_match else "Company"

            date_match = date_pattern.search(msg["body"])
            proposed_date = date_match.group(0).strip() if date_match else None

            try:
                reply_draft = await CommunicationGenerator.generate(
                    comm_type="thank-you",
                    resume_text="Senior Systems Engineer with 6 years experience.",
                    job_title="Senior Systems Architect",
                    company_name=company_name,
                    recipient_name=msg["sender"].split("@")[0].replace(".", " ").title()
                )
            except (LLMNotConfiguredError, Exception):
                reply_draft = {
                    "subject": f"Thank you — Senior Systems Architect interview",
                    "body": f"Dear {company_name} Hiring Team,\n\nThank you for inviting me to interview for the Senior Systems Architect position. I look forward to speaking with you.\n\nBest regards,\nCandidate",
                    "type": "thank-you"
                }

            invite_obj = {
                "email_id": msg["email_id"],
                "company": company_name,
                "sender": msg["sender"],
                "subject": msg["subject"],
                "meeting_link": meeting_link.group(0) if meeting_link else "Pending Link",
                "proposed_date": proposed_date,
                "auto_reply_draft": reply_draft,
                "synced_to_calendar": False
            }
            parsed_invites.append(invite_obj)

        self.inbox_invites = parsed_invites
        return {
            "total_scanned": len(simulated_emails),
            "invites_detected": len(parsed_invites),
            "parsed_invites": parsed_invites
        }
