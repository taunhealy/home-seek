import base64
import json
import os
import smtplib
import sqlite3
import time
import uuid
from email.message import EmailMessage
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter(tags=["inspections"])

_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "inspections.db")


def _init_db():
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS inspections (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                property_address TEXT,
                landlord_or_agent TEXT,
                lease_start_date TEXT,
                water_meter TEXT,
                electricity_meter TEXT,
                keys_notes TEXT,
                items_json TEXT NOT NULL,
                updated_at REAL NOT NULL
            )
            """
        )


_init_db()


class InspectionItemPayload(BaseModel):
    id: str
    room: str
    status: str = "defect"
    notes: str = ""
    captured_at: str = ""
    photo_data: str = ""


class SaveInspectionRequest(BaseModel):
    id: Optional[str] = None
    user_id: str
    property_address: str = ""
    landlord_or_agent: str = ""
    lease_start_date: str = ""
    water_meter: str = ""
    electricity_meter: str = ""
    keys_notes: str = ""
    items: List[InspectionItemPayload] = []


class EmailInspectionPdfRequest(BaseModel):
    to_email: str
    inspection: Dict[str, Any]


class AiDescribeSnagRequest(BaseModel):
    room: str = "General"
    photo_data: str
    existing_notes: str = ""


class GenerateCriteriaRequest(BaseModel):
    property_input: str
    property_address: str = ""


@router.get("/api/inspections")
async def list_inspections(user_id: str):
    uid = (user_id or "").strip()
    if not uid:
        return {"status": "success", "inspections": []}
    with sqlite3.connect(_DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM inspections WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20",
            (uid,),
        ).fetchall()
    out = []
    for r in rows:
        try:
            items = json.loads(r["items_json"] or "[]")
        except Exception:
            items = []
        out.append({
            "id": r["id"],
            "user_id": r["user_id"],
            "property_address": r["property_address"] or "",
            "landlord_or_agent": r["landlord_or_agent"] or "",
            "lease_start_date": r["lease_start_date"] or "",
            "water_meter": r["water_meter"] or "",
            "electricity_meter": r["electricity_meter"] or "",
            "keys_notes": r["keys_notes"] or "",
            "items": items,
            "updated_at": r["updated_at"],
        })
    return {"status": "success", "inspections": out}


@router.post("/api/inspections")
async def save_inspection(req: SaveInspectionRequest):
    uid = (req.user_id or "").strip()
    if not uid:
        raise HTTPException(status_code=400, detail="Missing user_id")
    insp_id = (req.id or "").strip() or f"insp-{uuid.uuid4().hex[:12]}"
    now = time.time()
    items_json = json.dumps([it.model_dump() for it in req.items])
    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO inspections
            (id, user_id, property_address, landlord_or_agent, lease_start_date, water_meter, electricity_meter, keys_notes, items_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                insp_id,
                uid,
                req.property_address,
                req.landlord_or_agent,
                req.lease_start_date,
                req.water_meter,
                req.electricity_meter,
                req.keys_notes,
                items_json,
                now,
            ),
        )
    return {"status": "success", "id": insp_id, "updated_at": now}


@router.post("/api/inspections/pdf")
async def export_inspection_pdf(payload: Dict[str, Any]):
    from services.inspection_pdf import build_inspection_pdf
    pdf_bytes = build_inspection_pdf(payload)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="homeseek-ingoing-inspection.pdf"'},
    )


@router.post("/api/inspections/email-pdf")
async def email_inspection_pdf(req: EmailInspectionPdfRequest):
    from services.inspection_pdf import build_inspection_pdf

    to_email = (req.to_email or "").strip()
    if "@" not in to_email or "." not in to_email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Please enter a valid recipient email address.")

    pdf_bytes = build_inspection_pdf(req.inspection)
    address = str(req.inspection.get("property_address") or "Rental Property")
    subject = f"Ingoing Move-In Inspection Record: {address}"
    filename = "homeseek-ingoing-inspection.pdf"
    html_body = (
        f"<p>Attached is the timestamped <strong>Ingoing Move-In Inspection Report</strong> for "
        f"<strong>{address}</strong>, including photo evidence and meter readings.</p>"
    )

    resend_key = os.getenv("RESEND_API_KEY")
    if resend_key:
        import httpx
        from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
        payload = {
            "from": f"HomeSeek Inspection <{from_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_body,
            "attachments": [{"filename": filename, "content": base64.b64encode(pdf_bytes).decode("ascii")}],
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
        msg.set_content(f"Attached is the timestamped Ingoing Move-In Inspection Report for {address}.")
        msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=filename)
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return {"status": "success", "to_email": to_email, "provider": "smtp"}

    raise HTTPException(
        status_code=400,
        detail="Email delivery is not configured yet (set RESEND_API_KEY or SMTP_HOST in api/.env). You can still download the PDF directly.",
    )


@router.post("/api/inspections/ai-describe")
async def ai_describe_inspection_photo(req: AiDescribeSnagRequest):
    if not req.photo_data or not req.photo_data.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Valid image data URL required.")
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {"status": "fallback", "description": req.existing_notes or "Pre-existing wear/condition documented on move-in.", "is_fallback": True}
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage

        prompt = (
            f"You are documenting a formal South African Rental Housing Act ingoing move-in inspection for the room '{req.room}'. "
            "Inspect this photo and write 1-2 concise, objective sentences describing any visible defects, scuffs, cracks, stains, damp, "
            "or general condition so the tenant has a clear, dispute-proof record. No markdown."
        )
        for m_name in ["gemini-4-neon", "gemini-3-flash-preview", "gemini-3.8-flash", "gemini-flash-latest"]:
            try:
                llm = ChatGoogleGenerativeAI(model=m_name, api_key=api_key, temperature=0.2, request_timeout=25, max_retries=0)
                resp = await llm.ainvoke([HumanMessage(content=[{"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": req.photo_data}}])])
                txt = (resp.content if isinstance(resp.content, str) else str(resp.content)).strip()
                if txt:
                    return {"status": "success", "description": txt, "is_fallback": False}
            except Exception as e:
                err_str = str(e)
                if any(k in err_str for k in ("RESOURCE_EXHAUSTED", "429", "402", "404", "NOT_FOUND", "503", "UNAVAILABLE")):
                    continue
                raise e
        return {"status": "fallback", "description": req.existing_notes or "AI quota unavailable; please enter defect notes manually.", "is_fallback": True}
    except Exception:
        return {"status": "fallback", "description": req.existing_notes or "Could not analyze photo; please enter defect notes manually.", "is_fallback": True}


@router.post("/api/inspections/generate-criteria")
async def generate_inspection_criteria(req: GenerateCriteriaRequest):
    """Analyzes a Property24 link, listing ID, or pasted property details to build tailored move-in inspection criteria."""
    import re
    raw_in = (req.property_input or "").strip()
    if not raw_in and not (req.property_address or "").strip():
        raise HTTPException(status_code=400, detail="Please enter a Property24 link, listing ID, or property details.")

    listing_ctx: Dict[str, Any] = {}
    pid_m = re.search(r"(\d{7,12})", raw_in)
    if pid_m:
        pid = pid_m.group(1)
        try:
            from services.listings_db import _get_connection
            with _get_connection() as conn:
                row = conn.execute(
                    "SELECT raw_json FROM listings WHERE p24_id = ? OR id = ? LIMIT 1",
                    (pid, f"p24-{pid}"),
                ).fetchone()
                if row and row["raw_json"]:
                    listing_ctx = json.loads(row["raw_json"])
        except Exception:
            pass

    if not listing_ctx and req.property_address.strip():
        try:
            from services.listings_db import _get_connection
            with _get_connection() as conn:
                row = conn.execute(
                    "SELECT raw_json FROM listings WHERE LOWER(address) LIKE ? LIMIT 1",
                    (f"%{req.property_address.strip().lower()[:40]}%",),
                ).fetchone()
                if row and row["raw_json"]:
                    listing_ctx = json.loads(row["raw_json"])
        except Exception:
            pass

    combined_text = (
        f"Title: {listing_ctx.get('title', '')}\n"
        f"Address: {listing_ctx.get('address') or req.property_address}\n"
        f"Beds: {listing_ctx.get('bedrooms', '')} | Baths: {listing_ctx.get('bathrooms', '')} | Size: {listing_ctx.get('sqm', '')} m2\n"
        f"Stove: {listing_ctx.get('stove_type', '')} | Garage: {listing_ctx.get('has_garage', '')} | Pet-friendly: {listing_ctx.get('pet_friendly', '')}\n"
        f"Description / User Notes: {(listing_ctx.get('description') or '')[:1800]}\n{raw_in[:1800]}"
    ).strip()

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if api_key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import HumanMessage

            prompt = f"""You are a South African Rental Housing Act move-in inspection specialist.
Analyze the property details below and generate a tailored ingoing inspection checklist so the tenant documents every feature and potential deposit-dispute risk specific to THIS property.

PROPERTY DETAILS:
{combined_text}

Return STRICT JSON only (no markdown fences):
{{
  "property_summary": "1 concise sentence summarizing what kind of property this is",
  "detected_address": "{(listing_ctx.get('address') or req.property_address or '').replace('\"', '')}",
  "rooms": [
    {{
      "room": "Specific Room or System Name (e.g. Kitchen (Gas Hob & Cabinetry), Balcony & Sliding Door, Parquet Floors, Prepaid Meter & Garage)",
      "checks": ["2 to 4 specific things to photograph & verify in this room based on the property details"]
    }}
  ]
}}"""
            for m_name in ["gemini-4-neon", "gemini-3-flash-preview", "gemini-3.8-flash", "gemini-flash-latest"]:
                try:
                    llm = ChatGoogleGenerativeAI(model=m_name, api_key=api_key, temperature=0.2, request_timeout=25, max_retries=0)
                    resp = await llm.ainvoke([HumanMessage(content=prompt)])
                    txt = (resp.content if isinstance(resp.content, str) else str(resp.content)).strip()
                    txt = re.sub(r"^```(?:json)?\s*", "", txt)
                    txt = re.sub(r"\s*```$", "", txt)
                    parsed = json.loads(txt)
                    if isinstance(parsed.get("rooms"), list) and parsed["rooms"]:
                        return {"status": "success", "criteria": parsed, "is_fallback": False}
                except Exception as e:
                    err_str = str(e)
                    if any(k in err_str for k in ("RESOURCE_EXHAUSTED", "429", "402", "404", "NOT_FOUND", "503", "UNAVAILABLE")):
                        continue
                    raise e
        except Exception:
            pass

    # Heuristic fallback
    lower = combined_text.lower()
    rooms = [
        {
            "room": "Kitchen" + (" (Gas Hob)" if "gas" in lower else ""),
            "checks": [
                "Photograph stove plates/burners, oven interior, extractor fan, and counter edges",
                "Test under-sink plumbing for leaks and photograph cupboard hinges/kickplates",
            ] + (["Verify LPGSASA gas compliance certificate & igniters"] if "gas" in lower else []),
        },
        {
            "room": "Bathroom",
            "checks": [
                "Photograph shower grout, silicone seals, basin/toilet chips, and mirror silvering",
                "Check ceiling above shower for peeling paint or damp",
            ],
        },
        {
            "room": "Living Area & Floors" + (" (Parquet)" if "parquet" in lower else ""),
            "checks": [
                "Photograph floor scuffs, skirting boards, wall nail holes, and curtain rails",
                "Test wall plug points and light switches",
            ],
        },
        {
            "room": "Bedroom & Cupboards",
            "checks": [
                "Photograph built-in wardrobe doors/tracks, window latches, and blinds",
            ],
        },
    ]
    if any(w in lower for w in ["balcony", "patio", "garden", "courtyard", "pet"]):
        rooms.append({
            "room": "Balcony / Garden & Perimeter",
            "checks": [
                "Photograph sliding door tracks, exterior walls, paving, and boundary fencing/gates",
            ] + (["Document existing lawn/garden condition for pet-friendly lease"] if "pet" in lower else []),
        })
    rooms.append({
        "room": "Meters, Keys & Parking",
        "checks": [
            "Photograph water meter and prepaid electricity meter serial + starting credit",
            "Photograph all keys, remotes, tags, and garage/parking bay condition",
        ],
    })
    return {
        "status": "fallback",
        "criteria": {
            "property_summary": "Heuristic property checklist generated from listing features.",
            "detected_address": listing_ctx.get("address") or req.property_address or "",
            "rooms": rooms,
        },
        "is_fallback": True,
    }
