from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ServerMetrics(BaseModel):
    availability: Optional[str] = None
    cpu: Optional[str] = None
    memory: Optional[str] = None
    disk: Optional[str] = None
    downtimes: Optional[str] = None
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    os_name: Optional[str] = None
    os_version: Optional[str] = None
    kernel_version: Optional[str] = None
    processor: Optional[str] = None
    ram_size: Optional[str] = None
    uptime: Optional[str] = None

class ScrapedDataInput(BaseModel):
    url: str
    title: str
    headings: List[str]
    raw_content: List[str]
    server_metrics: ServerMetrics

class ScrapedData(ScrapedDataInput):
    id: str = Field(alias="_id", default=None)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
