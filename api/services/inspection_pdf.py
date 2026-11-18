import base64
import hashlib
import io
import textwrap
from typing import Any, Dict, List, Tuple
from PIL import Image


def _pdf_escape(text: str) -> str:
    safe = (
        (text or "")
        .replace("—", "-")
        .replace("–", "-")
        .replace("•", "-")
        .replace("·", "|")
        .replace("²", "2")
        .replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
    )
    safe = safe.encode("latin-1", errors="ignore").decode("latin-1")
    return safe.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _decode_jpeg_for_pdf(data_url: str, max_w: int = 480, max_h: int = 360) -> Tuple[bytes, int, int] | None:
    if not data_url or "base64," not in data_url:
        return None
    try:
        raw = base64.b64decode(data_url.split("base64,", 1)[1])
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        img.thumbnail((max_w, max_h))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=78)
        return out.getvalue(), img.width, img.height
    except Exception:
        return None


def build_inspection_pdf(payload: Dict[str, Any]) -> bytes:
    """
    Generates a multi-page PDF 1.4 Ingoing Move-In Inspection Report with
    embedded JPEG photo evidence, timestamps, and SHA-256 verification hashes.
    """
    address = str(payload.get("property_address") or "Rental Property")
    agent = str(payload.get("landlord_or_agent") or "Not specified")
    lease_date = str(payload.get("lease_start_date") or "Not specified")
    water_meter = str(payload.get("water_meter") or "-")
    elec_meter = str(payload.get("electricity_meter") or "-")
    keys_notes = str(payload.get("keys_notes") or "-")
    tenant_name = str(payload.get("tenant_name") or "Tenant")
    generated_at = str(payload.get("generated_at") or "")
    items: List[Dict[str, Any]] = payload.get("items") or []

    # Prepare pages as lists of (content_stream_bytes, [(xobj_name, jpeg_bytes, w, h)])
    pages: List[Tuple[bytes, List[Tuple[str, bytes, int, int]]]] = []
    cmds: List[str] = []
    page_images: List[Tuple[str, bytes, int, int]] = []
    y = 755

    def start_new_page():
        nonlocal cmds, page_images, y
        pages.append(("\n".join(cmds).encode("latin-1", errors="ignore"), page_images))
        cmds = []
        page_images = []
        y = 755

    def add_line(text: str, font: str = "F1", size: int = 10, gap: int = 14, indent: int = 48):
        nonlocal y
        if y < 65:
            start_new_page()
        cmds.append(f"BT /{font} {size} Tf 1 0 0 1 {indent} {y} Tm ({_pdf_escape(text)}) Tj ET")
        y -= gap

    def add_wrapped(text: str, width: int = 88, font: str = "F1", size: int = 10, gap: int = 13, indent: int = 54):
        for line in textwrap.wrap(text or "", width=width) or [""]:
            add_line(line, font=font, size=size, gap=gap, indent=indent)

    # Header
    add_line("HOMESEEK INGOING MOVE-IN INSPECTION REPORT", font="F2", size=14, gap=18)
    add_line("South African Rental Housing Act Pre-Occupation Record", font="F1", size=9, gap=16)
    add_line(f"Property Address: {address}", font="F2", size=11, gap=15)
    add_line(f"Tenant: {tenant_name}   |   Landlord / Agent: {agent}", font="F1", size=10, gap=14)
    add_line(f"Lease / Occupation Date: {lease_date}   |   Generated: {generated_at}", font="F1", size=9, gap=14)
    add_line(f"Meters -> Water: {water_meter}   |   Electricity: {elec_meter}", font="F1", size=9, gap=14)
    add_wrapped(f"Keys, Remotes & Tags: {keys_notes}", width=90, font="F1", size=9, gap=13, indent=48)
    y -= 6
    add_line(f"DOCUMENTED ITEMS ({len(items)})", font="F2", size=11, gap=16)

    img_counter = 0
    for idx, it in enumerate(items, 1):
        room = str(it.get("room") or "General")
        status = str(it.get("status") or "defect").upper()
        captured_at = str(it.get("captured_at") or it.get("timestamp") or "")
        notes = str(it.get("notes") or "")
        photo_data = it.get("photo_data") or ""

        needed_h = 190 if photo_data else 60
        if y - needed_h < 55:
            start_new_page()

        add_line(f"{idx}. [{room}]  Status: {status}  |  Timestamp: {captured_at}", font="F2", size=10, gap=14)
        if notes:
            add_wrapped(notes, width=86, font="F1", size=9, gap=12, indent=58)

        decoded = _decode_jpeg_for_pdf(photo_data)
        if decoded:
            jpeg_bytes, pw, ph = decoded
            img_counter += 1
            xobj_name = f"Im{img_counter}"
            sha = hashlib.sha256(jpeg_bytes).hexdigest()[:12]
            draw_w = min(210.0, float(pw))
            draw_h = draw_w * (float(ph) / max(1.0, float(pw)))
            if draw_h > 135.0:
                scale = 135.0 / draw_h
                draw_h = 135.0
                draw_w *= scale
            if y - draw_h - 18 < 50:
                start_new_page()
            img_y = y - draw_h
            cmds.append(f"q {draw_w:.1f} 0 0 {draw_h:.1f} 58 {img_y:.1f} cm /{xobj_name} Do Q")
            y = int(img_y - 12)
            add_line(f"Photo Evidence SHA-256: {sha}", font="F1", size=8, gap=14, indent=58)
            page_images.append((xobj_name, jpeg_bytes, pw, ph))
        else:
            y -= 4

    pages.append(("\n".join(cmds).encode("latin-1", errors="ignore"), page_images))

    # Build PDF objects
    objects: List[bytes] = []
    # 1: Catalog, 2: Pages, 3: F1, 4: F2
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objects.append(b"")  # placeholder for 2 0 obj (Pages)
    objects.append(b"3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n")

    page_obj_nums: List[int] = []
    next_id = 5

    for stream_bytes, imgs in pages:
        xobj_entries = []
        for xname, jpeg_bytes, pw, ph in imgs:
            img_id = next_id
            next_id += 1
            header = (
                f"{img_id} 0 obj\n<< /Type /XObject /Subtype /Image /Width {pw} /Height {ph} "
                f"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {len(jpeg_bytes)} >>\nstream\n"
            ).encode("latin-1")
            footer = b"\nendstream\nendobj\n"
            objects.append(header + jpeg_bytes + footer)
            xobj_entries.append(f"/{xname} {img_id} 0 R")

        content_id = next_id
        next_id += 1
        objects.append(
            f"{content_id} 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode("latin-1")
            + stream_bytes
            + b"\nendstream\nendobj\n"
        )

        page_id = next_id
        next_id += 1
        page_obj_nums.append(page_id)
        xobj_dict = f"/XObject << {' '.join(xobj_entries)} >>" if xobj_entries else ""
        objects.append(
            (
                f"{page_id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> {xobj_dict} >> /Contents {content_id} 0 R >>\nendobj\n"
            ).encode("latin-1")
        )

    kids = " ".join(f"{pid} 0 R" for pid in page_obj_nums)
    objects[1] = f"2 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {len(page_obj_nums)} >>\nendobj\n".encode("latin-1")

    pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: List[int] = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_pos = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("latin-1"))
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode("latin-1"))
    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("latin-1")
    )
    return bytes(pdf)
