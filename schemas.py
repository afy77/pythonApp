"""
schemas.py
Skema Pydantic untuk validasi data request dan serialisasi response.
Mendukung kompatibilitas Pydantic V2 dan V1 (from_attributes / orm_mode).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ItemBase(BaseModel):
    """Atribut dasar yang dimiliki oleh sebuah Item."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Nama item/barang",
        examples=["Laptop Gaming Asus ROG"],
    )
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Deskripsi lengkap mengenai item",
        examples=["Laptop spek tinggi dengan RAM 32GB dan RTX 4080"],
    )
    price: float = Field(
        ...,
        ge=0.0,
        description="Harga satuan item (tidak boleh negatif)",
        examples=[25000000.0],
    )
    stock: int = Field(
        ...,
        ge=0,
        description="Jumlah stok barang yang tersedia (minimal 0)",
        examples=[15],
    )


class ItemCreate(ItemBase):
    """Payload skema untuk pembuatan data baru (POST /items)."""

    pass


class ItemUpdate(BaseModel):
    """Payload skema untuk pembaruan data parsial atau penuh (PUT /items/{id})."""

    name: Optional[str] = Field(
        None, min_length=1, max_length=100, description="Nama item baru"
    )
    description: Optional[str] = Field(None, max_length=500)
    price: Optional[float] = Field(None, ge=0.0)
    stock: Optional[int] = Field(None, ge=0)


class ItemResponse(ItemBase):
    """Skema response data item lengkap dengan metadata database (id dan created_at)."""

    id: int
    created_at: datetime

    # Konfigurasi Pydantic V2 (from_attributes)
    model_config = ConfigDict(from_attributes=True)


# Schema khusus untuk endpoint pengujian JENNIFER APM
class SlowTestResponse(BaseModel):
    status: str
    message: str
    delay_seconds: float
    database_queries_executed: int
    elapsed_time_seconds: float
    apm_notes: Dict[str, Any]


class MessageResponse(BaseModel):
    detail: str
