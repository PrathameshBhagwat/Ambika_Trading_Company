"""
Vegetables API router - CRUD operations for vegetable master management.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models.vegetable import Vegetable
from schemas.vegetable import (
    VegetableCreate, VegetableUpdate, VegetableResponse, VegetableListResponse
)
from utils.logger import logger

router = APIRouter(prefix="/api/vegetables", tags=["Vegetables"])


@router.get("/", response_model=VegetableListResponse)
def list_vegetables(
    search: str | None = Query(None, description="Search by name"),
    is_active: bool = Query(True, description="Filter by active status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List all vegetables with optional search."""
    query = db.query(Vegetable).filter(Vegetable.is_active == is_active)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            Vegetable.name_local.ilike(search_term)
            | Vegetable.name_english.ilike(search_term)
        )

    total = query.count()
    vegetables = query.order_by(Vegetable.name_local).offset(skip).limit(limit).all()

    return VegetableListResponse(
        items=[VegetableResponse.model_validate(v) for v in vegetables],
        total=total,
    )


@router.get("/{vegetable_id}", response_model=VegetableResponse)
def get_vegetable(vegetable_id: int, db: Session = Depends(get_db)):
    """Get a single vegetable by ID."""
    vegetable = db.query(Vegetable).filter(Vegetable.id == vegetable_id).first()
    if not vegetable:
        raise HTTPException(status_code=404, detail="Vegetable not found")
    return VegetableResponse.model_validate(vegetable)


@router.post("/", response_model=VegetableResponse, status_code=201)
def create_vegetable(data: VegetableCreate, db: Session = Depends(get_db)):
    """Add a new vegetable to the master list."""
    vegetable = Vegetable(**data.model_dump())
    db.add(vegetable)
    db.commit()
    db.refresh(vegetable)
    logger.info(f"Created vegetable: {vegetable.name_local} (ID: {vegetable.id})")
    return VegetableResponse.model_validate(vegetable)


@router.put("/{vegetable_id}", response_model=VegetableResponse)
def update_vegetable(vegetable_id: int, data: VegetableUpdate, db: Session = Depends(get_db)):
    """Update a vegetable's details."""
    vegetable = db.query(Vegetable).filter(Vegetable.id == vegetable_id).first()
    if not vegetable:
        raise HTTPException(status_code=404, detail="Vegetable not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vegetable, field, value)

    db.commit()
    db.refresh(vegetable)
    logger.info(f"Updated vegetable: {vegetable.name_local} (ID: {vegetable.id})")
    return VegetableResponse.model_validate(vegetable)


@router.delete("/{vegetable_id}", status_code=200)
def deactivate_vegetable(vegetable_id: int, db: Session = Depends(get_db)):
    """Soft-delete a vegetable (set is_active=False). Never hard-deletes."""
    vegetable = db.query(Vegetable).filter(Vegetable.id == vegetable_id).first()
    if not vegetable:
        raise HTTPException(status_code=404, detail="Vegetable not found")

    vegetable.is_active = False
    db.commit()
    logger.info(f"Deactivated vegetable: {vegetable.name_local} (ID: {vegetable.id})")
    return {"detail": f"Vegetable '{vegetable.name_local}' has been deactivated"}
