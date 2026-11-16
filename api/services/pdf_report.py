import textwrap
from typing import Any, Dict, List


def _pdf_escape(text: str) -> str:
    safe = (
        (text or "")
        .replace("—", "-")
        .replace("–", "-")
        .replace("•", "-")
        .replace("·", "|")
        .replace("²", "2")
        .replace("≤", "<=")
        .replace("≥", ">=")
        .replace("▼", "-")
        .replace("▲", "+")
        .replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
    )
    safe = safe.encode("latin-1", errors="ignore").decode("latin-1")
    return safe.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_property_report_pdf(report: Dict[str, Any]) -> bytes:
    """
    Generates a clean, valid multi-page PDF 1.4 document for a HomeSeek
    Property Forensic & Viewing Report using pure Python (zero external deps).
    """
    title = str(report.get("title") or "Property Report")
    address = str(report.get("address") or "")
    price = report.get("price")
    price_str = f"R {int(price):,}/mo" if isinstance(price, (int, float)) and price > 0 else "Price N/A"
    beds = report.get("bedrooms") or 1
    baths = report.get("bathrooms") or 1
    sqm = report.get("sqm")
    sqm_str = f"{int(sqm)} m2" if sqm else "size unstated"
    generated_at = str(report.get("generated_at") or "")
    verdict = str(report.get("verdict") or "")
    photo_story = str(report.get("photo_story") or "")
    pros: List[str] = [str(x) for x in (report.get("pros") or []) if x]
    cons: List[str] = [str(x) for x in (report.get("cons") or []) if x]
    arch: Dict[str, str] = report.get("architecture") or {}
    url = str(report.get("url") or "")

    # Build styled lines: (font_key, font_size, text)
    lines: List[tuple] = []
    lines.append(("F2", 16, "HomeSeek Forensic Property & Viewing Report"))
    lines.append(("F1", 10, f"Generated: {generated_at}" if generated_at else "HomeSeek Intelligence"))
    lines.append(("F1", 6, ""))
    lines.append(("F2", 13, title))
    lines.append(("F1", 10, address))
    lines.append(("F2", 10, f"{price_str}  |  {beds} Bed  |  {baths} Bath  |  {sqm_str}"))
    if url:
        lines.append(("F1", 8, f"Listing: {url}"))
    lines.append(("F1", 8, ""))

    def add_section(heading: str, body_items: List[str], bullet: bool = False):
        if not body_items:
            return
        lines.append(("F2", 11, heading))
        for item in body_items:
            prefix = "- " if bullet else ""
            wrapped = textwrap.wrap(f"{prefix}{item}", width=92) or [""]
            for idx, w in enumerate(wrapped):
                pad = "  " if (bullet and idx > 0) else ""
                lines.append(("F1", 9, f"{pad}{w}"))
        lines.append(("F1", 6, ""))

    if verdict:
        add_section("EXECUTIVE VERDICT", [verdict])
    if photo_story:
        add_section("AI VISION PHOTO STORY", [photo_story])

    arch_items = []
    for label, key in [
        ("Space & WFH Ergonomics", "wfhLayoutVerdict"),
        ("Window Placement & Daylight", "windowLightAudit"),
        ("Wall Type & Acoustics", "wallAcousticAudit"),
        ("Ceiling Height & Volume", "ceilingVolumeAudit"),
        ("Light Fixtures & Mood", "lightingFixturesAudit"),
        ("Exterior & Building Signal", "exteriorBuildingAudit"),
    ]:
        val = arch.get(key)
        if val:
            arch_items.append(f"{label}: {val}")
    add_section("ARCHITECTURE, SPACE & BUILDING INTELLIGENCE", arch_items, bullet=True)
    add_section(f"PROS ({len(pros)})", pros, bullet=True)
    add_section(f"CONS & RISKS ({len(cons)})", cons, bullet=True)

    # Paginate lines across A4 pages (595 x 842 pt)
    pages_ops: List[List[str]] = [[]]
    y = 795
    margin_x = 45
    for font_key, font_size, text in lines:
        line_h = font_size + 4
        if y - line_h < 50:
            pages_ops.append([])
            y = 795
        if text:
            esc = _pdf_escape(text)
            pages_ops[-1].append(f"BT /{font_key} {font_size} Tf {margin_x} {y} Td ({esc}) Tj ET")
        y -= line_h

    # Assemble PDF objects
    objects: List[bytes] = []
    # 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    page_obj_nums = []
    next_obj_num = 5
    page_objects: List[bytes] = []

    for ops in pages_ops:
        stream_data = "\n".join(ops).encode("latin-1", errors="ignore")
        content_num = next_obj_num
        page_num = next_obj_num + 1
        next_obj_num += 2
        page_obj_nums.append(page_num)

        content_obj = (
            f"{content_num} 0 obj\n<< /Length {len(stream_data)} >>\nstream\n".encode("ascii")
            + stream_data
            + b"\nendstream\nendobj\n"
        )
        page_obj = (
            f"{page_num} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_num} 0 R >>\nendobj\n"
        ).encode("ascii")
        page_objects.append(content_obj)
        page_objects.append(page_obj)

    kids = " ".join(f"{n} 0 R" for n in page_obj_nums)
    objects.append(f"2 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {len(page_obj_nums)} >>\nendobj\n".encode("ascii"))
    objects.append(b"3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n")
    objects.extend(page_objects)

    pdf = bytearray(b"%PDF-1.4\n")
    offsets: List[int] = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_pos = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("ascii")
    )
    return bytes(pdf)
