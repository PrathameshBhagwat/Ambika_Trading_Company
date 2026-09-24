"""
Farmers API router - CRUD operations for farmer management.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from models.farmer import Farmer
from schemas.farmer import (
    FarmerCreate, FarmerUpdate, FarmerResponse, FarmerListResponse
)
from utils.logger import logger

router = APIRouter(prefix="/api/farmers", tags=["Farmers"])


@router.get("/", response_model=FarmerListResponse)
def list_farmers(
    search: str | None = Query(None, description="Search by name, mobile, or village"),
    is_active: bool = Query(True, description="Filter by active status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List all farmers with optional search and pagination."""
    query = db.query(Farmer).filter(Farmer.is_active == is_active)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Farmer.name.ilike(search_term),
                Farmer.mobile.ilike(search_term),
                Farmer.village.ilike(search_term),
            )
        )

    total = query.count()
    farmers = query.order_by(Farmer.name).offset(skip).limit(limit).all()

    return FarmerListResponse(
        items=[FarmerResponse.model_validate(f) for f in farmers],
        total=total,
    )


@router.get("/{farmer_id}", response_model=FarmerResponse)
def get_farmer(farmer_id: int, db: Session = Depends(get_db)):
    """Get a single farmer by ID."""
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
    return FarmerResponse.model_validate(farmer)


@router.post("/", response_model=FarmerResponse, status_code=201)
def create_farmer(data: FarmerCreate, db: Session = Depends(get_db)):
    """Register a new farmer."""
    farmer = Farmer(**data.model_dump())
    db.add(farmer)
    db.commit()
    db.refresh(farmer)
    logger.info(f"Created farmer: {farmer.name} (ID: {farmer.id})")
    return FarmerResponse.model_validate(farmer)


@router.put("/{farmer_id}", response_model=FarmerResponse)
def update_farmer(farmer_id: int, data: FarmerUpdate, db: Session = Depends(get_db)):
    """Update an existing farmer's details."""
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(farmer, field, value)

    db.commit()
    db.refresh(farmer)
    logger.info(f"Updated farmer: {farmer.name} (ID: {farmer.id})")
    return FarmerResponse.model_validate(farmer)


@router.delete("/{farmer_id}", status_code=200)
def deactivate_farmer(farmer_id: int, db: Session = Depends(get_db)):
    """Soft-delete a farmer (set is_active=False). Never hard-deletes."""
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    farmer.is_active = False
    db.commit()
    logger.info(f"Deactivated farmer: {farmer.name} (ID: {farmer.id})")
    return {"detail": f"Farmer '{farmer.name}' has been deactivated"}
