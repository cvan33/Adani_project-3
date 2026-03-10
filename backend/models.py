from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class PerformanceMetrics(BaseModel):
    availability: Optional[str] = None
    cpu_usage: Optional[str] = None
    memory_usage: Optional[str] = None
    disk_usage: Optional[str] = None
    downtimes: Optional[str] = None

class SystemDetails(BaseModel):
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    os_name: Optional[str] = None
    os_version: Optional[str] = None
    kernel_version: Optional[str] = None
    processor: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None

class ResourceDetails(BaseModel):
    ram_size: Optional[str] = None
    cpu_cores: Optional[str] = None
    total_disk_partitions: Optional[str] = None
    total_network_interfaces: Optional[str] = None
    last_boot_time: Optional[str] = None
    time_zone: Optional[str] = None
    public_ip: Optional[str] = None
    location: Optional[str] = None

class ScrapedDataInput(BaseModel):
    url: str
    title: str
    headings: List[str]
    raw_content: List[str]
    performance: PerformanceMetrics
    system: SystemDetails
    resources: ResourceDetails

class ScrapedData(ScrapedDataInput):
    id: str = Field(alias="_id", default=None)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
