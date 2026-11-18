import base64
import os
import smtplib
from email.message import EmailMessage
from typing import Any, Dict
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter(tags=["reports"])


class ReportPdfRequest(BaseModel):
    report: Dict[str, Any]


class EmailReportPdfRequest(BaseModel):
    to_email: str
    report: Dict[str, Any]


@router.post("/api/reports/pdf")
async def generate_report_pdf_endpoint(req: ReportPdfRequest):
    from services.pdf_report import build_property_report_pdf
    pdf_bytes = build_property_report_pdf(req.report)
    raw_id = str(req.report.get("id") or "listing").replace("/", "-")
    filename = f"homeseek-report-{raw_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/api/reports/email-pdf")
async def email_report_pdf_endpoint(req: EmailReportPdfRequest):
    from services.pdf_report import build_property_report_pdf

    to_email = (req.to_email or "").strip()
    if "@" not in to_email or "." not in to_email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Please enter a valid recipient email address.")

    pdf_bytes = build_property_report_pdf(req.report)
    raw_id = str(req.report.get("id") or "listing").replace("/", "-")
    filename = f"homeseek-report-{raw_id}.pdf"
    title = str(req.report.get("title") or "Property Report")
    address = str(req.report.get("address") or "")
    subject = f"HomeSeek Property Report: {title}"
    html_body = (
        f"<p>Attached is your <strong>HomeSeek Forensic Property & Viewing Report</strong> for "
        f"<strong>{title}</strong> ({address}).</p>"
    )

    resend_key = os.getenv("RESEND_API_KEY")
    if resend_key:
        import httpx
        from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
        payload = {
            "from": f"HomeSeek Intelligence <{from_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_body,
            "attachments": [
                {
                    "filename": filename,
                    "content": base64.b64encode(pdf_bytes).decode("ascii"),
                }
            ],
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://api.resend.com/emails",
                json=payload,
                headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
            )
            if res.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Resend email error: {res.text[:200]}")
        return {"status": "success", "to_email": to_email, "provider": "resend"}

    smtp_host = os.getenv("SMTP_HOST")
    if smtp_host:
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass = os.getenv("SMTP_PASSWORD", "")
        from_addr = os.getenv("SMTP_FROM_EMAIL") or smtp_user or "noreply@homeseek.local"
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to_email
        msg.set_content(f"Attached is your HomeSeek Property Report for {title} ({address}).")
        msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=filename)
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return {"status": "success", "to_email": to_email, "provider": "smtp"}

    raise HTTPException(
        status_code=400,
        detail="Email delivery is not configured yet (set RESEND_API_KEY or SMTP_HOST in api/.env). You can still save the PDF directly.",
    )
