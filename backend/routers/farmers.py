"""
Farmers API router - CRUD operations for farmer management.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from database import get_db
from models.farmer import Farmer
from schemas.farmer import (
    FarmerCreate, FarmerUpdate, FarmerResponse, FarmerListResponse,
    DuplicateCheckResponse, DuplicateFarmerMatch
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


@router.get("/check-duplicate", response_model=DuplicateCheckResponse)
def check_duplicate_farmer(
    name: str = Query(..., min_length=1, description="Farmer name to check"),
    mobile: str | None = Query(None, description="Mobile number to check"),
    exclude_id: int | None = Query(None, description="Exclude farmer ID if updating"),
    db: Session = Depends(get_db),
):
    """
    Check if a similar farmer already exists by mobile number or name.
    Returns a warning list of potential duplicate farmers.
    """
    clean_name = name.strip()
    clean_mobile = mobile.strip() if mobile else None

    query = db.query(Farmer).filter(Farmer.is_active == True)
    if exclude_id:
        query = query.filter(Farmer.id != exclude_id)

    matches: list[DuplicateFarmerMatch] = []
    seen_ids = set()

    # 1. Exact mobile match
    if clean_mobile and len(clean_mobile) >= 5:
        mobile_matches = query.filter(Farmer.mobile == clean_mobile).all()
        for f in mobile_matches:
            if f.id not in seen_ids:
                seen_ids.add(f.id)
                matches.append(DuplicateFarmerMatch(
                    id=f.id,
                    name=f.name,
                    mobile=f.mobile,
                    village=f.village,
                    match_reason=f"Same mobile number ({f.mobile})",
                ))

    # 2. Identical name (case-insensitive)
    name_matches = query.filter(func.lower(Farmer.name) == clean_name.lower()).all()
    for f in name_matches:
        if f.id not in seen_ids:
            seen_ids.add(f.id)
            matches.append(DuplicateFarmerMatch(
                id=f.id,
                name=f.name,
                mobile=f.mobile,
                village=f.village,
                match_reason=f"Identical farmer name ({f.name})",
            ))

    # 3. Substring name match (if name length >= 4)
    if len(clean_name) >= 4:
        sub_matches = query.filter(Farmer.name.ilike(f"%{clean_name}%")).limit(5).all()
        for f in sub_matches:
            if f.id not in seen_ids:
                seen_ids.add(f.id)
                matches.append(DuplicateFarmerMatch(
                    id=f.id,
                    name=f.name,
                    mobile=f.mobile,
                    village=f.village,
                    match_reason=f"Similar name ({f.name})",
                ))

    is_duplicate = len(matches) > 0
    message = (
        f"Found {len(matches)} existing farmer(s) with matching or similar details."
        if is_duplicate
        else "No duplicates found."
    )

    return DuplicateCheckResponse(
        is_duplicate=is_duplicate,
        matches=matches,
        message=message,
    )


@router.get("/{farmer_id}", response_model=FarmerResponse)
def get_farmer(farmer_id: int, db: Session = Depends(get_db)):
    """Get a single farmer by ID."""
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
    return FarmerResponse.model_validate(farmer)


from services.audit_service import log_audit


@router.post("/", response_model=FarmerResponse, status_code=201)
def create_farmer(data: FarmerCreate, db: Session = Depends(get_db)):
    """Register a new farmer."""
    farmer = Farmer(**data.model_dump())
    db.add(farmer)
    db.flush()

    # Audit log
    new_values = {
        "name": farmer.name,
        "mobile": farmer.mobile,
        "village": farmer.village,
        "address": farmer.address,
        "notes": farmer.notes,
        "is_active": farmer.is_active,
    }
    log_audit(db, entity_type="Farmer", entity_id=farmer.id, action="CREATE", new_values=new_values)

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

    old_values = {
        "name": farmer.name,
        "mobile": farmer.mobile,
        "village": farmer.village,
        "address": farmer.address,
        "notes": farmer.notes,
        "is_active": farmer.is_active,
    }

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(farmer, field, value)

    new_values = {
        "name": farmer.name,
        "mobile": farmer.mobile,
        "village": farmer.village,
        "address": farmer.address,
        "notes": farmer.notes,
        "is_active": farmer.is_active,
    }
    log_audit(db, entity_type="Farmer", entity_id=farmer.id, action="UPDATE", old_values=old_values, new_values=new_values)

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

    old_status = farmer.is_active
    farmer.is_active = False

    log_audit(
        db,
        entity_type="Farmer",
        entity_id=farmer.id,
        action="DELETE",
        old_values={"is_active": old_status},
        new_values={"is_active": False},
    )

    db.commit()
    logger.info(f"Deactivated farmer: {farmer.name} (ID: {farmer.id})")
    return {"detail": f"Farmer '{farmer.name}' has been deactivated"}
