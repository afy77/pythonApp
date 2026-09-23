"""
models.py
Definisi Model SQLAlchemy ORM untuk tabel 'items'.
"""

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from database import Base


class Item(Base):
    """Model representasi entitas Item di dalam database SQLite."""

    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    stock = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Item(id={self.id}, name='{self.name}', price={self.price}, stock={self.stock})>"
