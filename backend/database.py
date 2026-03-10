from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")
if not MONGO_URI:
    # Use a dummy URI just to avoid startup crashes if .env isn't set yet, 
    # but the user must provide the real one to connect to Atlas.
    print("Warning: MONGODB_URI environment variable not set. Please set it in .env file.")
    MONGO_URI = "mongodb://localhost:27017" 

try:
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.scraper_db
    collection = db.scraped_data
    print("✅ Successfully connected to MongoDB Database!")
except Exception as e:
    print(f"❌ Error connecting to MongoDB: {e}")
