import os
import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/handbook", tags=["handbook"])

BACKEND_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "handbook.json")
FRONTEND_PUBLIC_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "frontend", "public", "handbook.json")

class HandbookSection(BaseModel):
    id: str
    chapter: int
    title: str
    category: str
    icon: Optional[str] = "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    badge: Optional[str] = ""
    summary: Optional[str] = ""
    content: str
    image_url: Optional[str] = ""
    image_caption: Optional[str] = ""
    app_route: Optional[str] = ""
    app_route_label: Optional[str] = ""
    admin_only: Optional[bool] = False

class HandbookPayload(BaseModel):
    title: str
    version: str
    updated_at: str
    sections: List[HandbookSection]

@router.get("", response_model=HandbookPayload)
async def get_handbook():
    if not os.path.exists(BACKEND_DATA_PATH):
        if os.path.exists(FRONTEND_PUBLIC_PATH):
            with open(FRONTEND_PUBLIC_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        raise HTTPException(status_code=404, detail="Handbook JSON file not found")
    
    try:
        with open(BACKEND_DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load handbook data: {str(e)}")

@router.post("", response_model=HandbookPayload)
async def save_handbook(payload: HandbookPayload):
    try:
        data_dict = payload.model_dump()
        
        os.makedirs(os.path.dirname(BACKEND_DATA_PATH), exist_ok=True)
        with open(BACKEND_DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(data_dict, f, indent=2, ensure_ascii=False)
            
        if os.path.exists(os.path.dirname(FRONTEND_PUBLIC_PATH)):
            with open(FRONTEND_PUBLIC_PATH, "w", encoding="utf-8") as f:
                json.dump(data_dict, f, indent=2, ensure_ascii=False)
                
        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save handbook data: {str(e)}")
