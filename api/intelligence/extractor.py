from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
import os
import json
from datetime import datetime
from typing import Type, TypeVar

T = TypeVar("T", bound=BaseModel)

class GeminiExtractor:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=self.api_key,
            temperature=0
        )

    async def extract(self, text: str, schema: Type[T]) -> T:
        parser = PydanticOutputParser(pydantic_object=schema)
        
        prompt = ChatPromptTemplate.from_template(
            "You are a professional property data extractor. Your goal is to find ALL rental property listings in the text below.\n"
            "Include basic details like Price, Location, Bedrooms, and a link to the property.\n"
            "If the text contains multiple properties, extract every single one accurately.\n\n"
            "{instructions}\n\n"
            "TEXT TO ANALYZE:\n{text}"
        )

        chain = prompt | self.llm | parser
        
        result = await chain.ainvoke({
            "text": text,
            "instructions": parser.get_format_instructions()
        })
        
        return result

    async def filter_listings(self, listings: list, query: str) -> list:
        if not listings:
            return []
            
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
            response = await self.llm.ainvoke(prompt.format(query=query, listings_json=listings_json))
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
