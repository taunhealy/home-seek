from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
import os
import json
from json_repair import repair_json
from datetime import datetime
from typing import Type, TypeVar, Optional

T = TypeVar("T", bound=BaseModel)

class GeminiExtractor:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        # Default LLM
        self.default_model = "gemini-flash-latest"
        # 🧠 Brain Cache: Store initialized models to avoid startup latency
        self._model_cache = {}

    def get_llm(self, model_name: Optional[str] = None):
        target_name = model_name or self.default_model
        
        # 🛡️ Safety Translation Map for stubborn/legacy frontend strings
        model_map = {
            "gemini-2.0-flash-exp": "gemini-flash-latest",
            "gemini-1.5-flash": "gemini-flash-latest",
            "gemini-1.5-flash-latest": "gemini-flash-latest",
            "gemini-3-flash-preview": "gemini-3-flash-preview", 
            "gemini-pro-latest": "gemini-pro-latest"
        }
        
        target_model_id = model_map.get(target_name) or target_name
        
        # 🚀 Instant Recall: Check the cache first
        if target_model_id in self._model_cache:
            return self._model_cache[target_model_id]

        print(f"[{datetime.now().strftime('%H:%M:%S')}] 🧠 Brain: Activating model {target_model_id} (requested: {model_name})")
        
        llm = ChatGoogleGenerativeAI(
            model=target_model_id,
            google_api_key=self.api_key,
            temperature=0
        )
        
        self._model_cache[target_model_id] = llm
        return llm

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
        
        try:
            # 🎙️ Manually format the prompt since we're not using a chain anymore
            formatted_prompt = prompt_text.format(
                text=text,
                instructions=parser.get_format_instructions()
            )
            
            # We use the LLM directly instead of the chain to allow for pre-validation cleaning
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 🧠 Intelligence: Sending {len(formatted_prompt)} chars to Gemini...")
            response = await llm.ainvoke(formatted_prompt)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 🧠 Intelligence: Response received from Gemini.")
            
            # 🛡️ Handle list-type content (Gemini 3.0)
            if isinstance(response.content, list):
                content = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in response.content]).strip()
            else:
                content = response.content.strip()
            
            # Clean up markdown formatting
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            # 🏁 Self-Healing JSON: Handle cutoffs and malformed output
            raw_data = repair_json(content, return_objects=True)
            
            # 🧹 Data Massaging: Ensure nulls don't break strict type expectations
            if "listings" in raw_data:
                for l in raw_data["listings"]:
                    # If we find a string 'null' or None, ensure it's None for Pydantic
                    for field in ["price", "bedrooms", "bathrooms"]:
                        if field in l and (l[field] == "null" or l[field] == ""):
                            l[field] = None

            return parser.parse(json.dumps(raw_data))
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
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 🧠 Intelligence: Ranking {len(listings)} listings against query...")
            response = await llm.ainvoke(prompt.format(query=query, listings_json=listings_json))
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 🧠 Intelligence: Ranking complete.")
            
            # 🛡️ Handle list-type content (Gemini sometimes returns multiple parts)
            if isinstance(response.content, list):
                content = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in response.content]).strip()
            else:
                content = response.content.strip()
            print(f"[{datetime.now().strftime('%H:%M:%S')}] AI Raw Response: {content}")
            # Clean up markdown formatting if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            # 🏁 Self-Healing JSON
            data = repair_json(content, return_objects=True)
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
        
        # 🛡️ Handle list-type content
        if isinstance(response.content, list):
            return "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in response.content]).strip()
        
        return response.content.strip()
