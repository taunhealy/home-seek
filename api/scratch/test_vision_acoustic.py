import os
import asyncio
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
import urllib.request
import base64

async def test_vision_acoustic():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("No API key")
        return

    # Photo 10 from 117750970
    img_url = "https://images.prop24.com/381371539/Crop600x400"
    req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.property24.com/"})
    img_bytes = urllib.request.urlopen(req).read()
    b64 = base64.b64encode(img_bytes).decode("utf-8")

    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=api_key, temperature=0.1)

    prompt = """Analyze this apartment window / balcony view photo for ACOUSTIC & TRAFFIC NOISE HAZARDS.
Check specifically for:
1. Multi-lane roads, highway overpasses, concrete flyovers, dual carriageways directly adjacent to the balcony.
2. Petrol stations, commercial loading zones, bus corridors.

Return JSON:
{
  "noise_risk": "low" | "medium" | "high",
  "hazard_detected": true | false,
  "hazard_description": "...",
  "acoustic_impact": "..."
}"""

    msg = HumanMessage(content=[
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
    ])

    resp = await llm.ainvoke([msg])
    print("Vision Response:\n", resp.content)

asyncio.run(test_vision_acoustic())

