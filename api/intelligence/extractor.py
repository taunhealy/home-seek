from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
import os
import json
from datetime import datetime
from typing import Type, TypeVar, Optional

T = TypeVar("T", bound=BaseModel)

class GeminiExtractor:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        # Default LLM
        self.default_model = "gemini-flash-latest"
        self._llm = None

    def get_llm(self, model_name: Optional[str] = None):
        target_model = model_name or self.default_model
        return ChatGoogleGenerativeAI(
            model=target_model,
            google_api_key=self.api_key,
            temperature=0
        )

    async def extract(self, text: str, schema: Type[T], model_name: Optional[str] = None) -> T:
        parser = PydanticOutputParser(pydantic_object=schema)
        llm = self.get_llm(model_name)
        
        prompt_text = (
            "You are a professional property data extractor. Your goal is to EXHAUSTIVELY extract ALL rental property listings from the text.\n"
            "This text is a results page from a property portal. Each listing is unique. Do NOT summarize.\n\n"
            "RULES:\n"
            "1. Identify every property block (usually starts with a price like 'R 15,000').\n"
            "2. For each block, extract the Price, Address, Bedrooms, and the detailed view link (URL).\n"
            "3. If a listing is missing a field, leave it null but EXHAUSTIVELY find every listing on the page.\n"
            "4. Ensure the 'source_url' is the absolute URL to that specific property.\n\n"
            "{instructions}\n\n"
            "TEXT TO ANALYZE:\n{text}"
        )
        
        prompt = ChatPromptTemplate.from_template(prompt_text)
        chain = prompt | llm | parser
        
        try:
            result = await chain.ainvoke({
                "text": text,
                "instructions": parser.get_format_instructions()
            })
            if hasattr(result, "listings"):
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Extraction result: {len(result.listings)} items found, confidence: {getattr(result, 'confidence_score', 1.0)}")
            return result
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Extraction Error: {str(e)}")
            # Return an empty result object instead of crashing
            return schema(listings=[], confidence_score=0.0, raw_summary="Error during extraction")

    async def filter_listings(self, listings: list, query: str, model_name: Optional[str] = None) -> list:
        if not listings:
            return []
            
        llm = self.get_llm(model_name)
            
        prompt = ChatPromptTemplate.from_template(
            "You are a rental sniper expert. Evaluate the follow property listings against the user's requirements.\n"
            "USER REQUIREMENTS: {query}\n\n"
            "LISTINGS:\n{listings_json}\n\n"
            "Respond with a JSON list of objects for ONLY the listings that are a POTENTIAL match (score > 50).\n"
            "Format: [{{ \"index\": 0, \"score\": 95, \"reason\": \"2 bedrooms in Claremont as requested, pet friendly\" }}, ...]\n"
            "Return ONLY the JSON array. If none match, return []."
        )
        
        listings_json = json.dumps([l.model_dump() for l in listings], indent=2)
        try:
            response = await llm.ainvoke(prompt.format(query=query, listings_json=listings_json))
            content = response.content.strip()
            print(f"[{datetime.now().strftime('%H:%M:%S')}] AI Raw Response: {content}")
            # Clean up markdown formatting if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            data = json.loads(content)
            # AI sometimes wraps the list in an object like {"matches": [...]}
            matches = data if isinstance(data, list) else data.get("matches", [])
            
            results = []
            for match in matches:
                if not isinstance(match, dict): continue
                idx = match.get("index")
                if idx is not None and isinstance(idx, int) and idx < len(listings):
                    listing = listings[idx]
                    listing.match_score = match.get("score", 0)
                    listing.match_reason = match.get("reason", "Highly relevant match found.")
                    results.append(listing)
            return results
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] AI Filtering Error: {str(e)}")
            return []

    async def determine_location(self, query: str, model_name: Optional[str] = None) -> str:
        """Uses AI to extract the primary geographic area from a user's free-text prompt."""
        llm = self.get_llm(model_name)
        prompt = f"Identify the primary City or Suburb in South Africa mentioned in this rental search: '{query}'. Return ONLY the location name (e.g. 'Claremont' or 'Cape Town'). If no location is found, return 'South Africa'."
        response = await llm.ainvoke(prompt)
        return response.content.strip()
