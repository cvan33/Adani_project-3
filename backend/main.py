from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import ScrapedDataInput
from database import collection
from datetime import datetime

app = FastAPI(title="Web Scraper API")

# Enable CORS so the Chrome extension can send requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to specific origins if necessary
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Web Scraper API is running. Send POST requests to /api/data"}

@app.post("/api/data")
async def save_scraped_data(data: ScrapedDataInput):
    try:
        # Prepare the document for MongoDB insertion
        document = data.model_dump()
        document["timestamp"] = datetime.utcnow()
        
        # Upsert into MongoDB based on URL
        url = document.get("url")
        result = await collection.update_one(
            {"url": url}, 
            {"$set": document}, 
            upsert=True
        )
        
        if result.upserted_id:
            print(f"✅ Data extracted and saved successfully to MongoDB! Inserted ID: {result.upserted_id}")
            inserted_id = str(result.upserted_id)
            message = "Data saved successfully"
        else:
            print(f"✅ Data for URL {url} updated successfully in MongoDB!")
            inserted_id = None # or we could fetch the existing ID if needed
            message = "Data updated successfully"

        return {
            "message": message,
            "inserted_id": inserted_id
        }
    except Exception as e:
        print(f"❌ Error saving extracted data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error saving data: {str(e)}")
