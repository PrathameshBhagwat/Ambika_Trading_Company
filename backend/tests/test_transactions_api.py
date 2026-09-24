"""
End-to-end API integration tests for Transactions and Payments.
Uses FastAPI TestClient with an in-memory SQLite database.
"""

import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, get_db

# Isolated test DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_complete_transaction_and_payment_lifecycle():
    # 1. Create Farmer
    farmer_resp = client.post(
        "/api/farmers/",
        json={
            "name": "Balu Patil",
            "mobile": "9822012345",
            "village": "Pimpalgaon",
            "notes": "Regular tomato supplier",
        },
    )
    assert farmer_resp.status_code == 201
    farmer_id = farmer_resp.json()["id"]

    # 2. Create Vegetable
    veg_resp = client.post(
        "/api/vegetables/",
        json={"name_local": "टोमॅटो (Tomato)", "name_english": "Tomato"},
    )
    assert veg_resp.status_code == 201
    veg_id = veg_resp.json()["id"]

    # 3. Create Transaction
    # Item: 10 bags, 250 KG @ ₹180 per 10 KG -> (250 / 10) * 180 = ₹4,500.00
    # Deductions: Hamali 50, Bharai 30, Tolai 20, Lekki 90 -> Total = ₹190.00
    # Net Payable: 4500 - 190 = ₹4,310.00
    txn_payload = {
        "transaction_date": str(date.today()),
        "farmer_id": farmer_id,
        "items": [
            {
                "vegetable_id": veg_id,
                "bags_count": 10,
                "weight_kg": 250.0,
                "rate_per_10kg": 180.0,
            }
        ],
        "deductions": {
            "hamali": 50.0,
            "bharai": 30.0,
            "tolai": 20.0,
            "mapai": 0.0,
            "lekki": 90.0,
            "motor_bhada": 0.0,
            "other_deductions": 0.0,
        },
    }

    txn_resp = client.post("/api/transactions/", json=txn_payload)
    assert txn_resp.status_code == 201
    txn = txn_resp.json()

    assert txn["bill_number"].startswith("AT-")
    assert txn["gross_amount"] == 4500.00
    assert txn["total_deductions"] == 190.00
    assert txn["net_payable"] == 4310.00
    assert txn["total_paid"] == 0.00
    assert txn["balance_due"] == 4310.00
    assert txn["status"] == "saved"
    txn_id = txn["id"]

    # 4. Partial Payment: Pay ₹2,000.00
    pay1_resp = client.post(
        "/api/payments/",
        json={
            "transaction_id": txn_id,
            "amount": 2000.0,
            "payment_date": str(date.today()),
            "payment_mode": "cash",
            "notes": "First partial cash payment",
        },
    )
    assert pay1_resp.status_code == 201

    # Check updated transaction
    txn_after_pay1 = client.get(f"/api/transactions/{txn_id}").json()
    assert txn_after_pay1["total_paid"] == 2000.00
    assert txn_after_pay1["balance_due"] == 2310.00
    assert txn_after_pay1["status"] == "partially_paid"

    # 5. Overpayment prevention: Attempt to pay ₹2,500 when balance is ₹2,310 -> Must fail!
    overpay_resp = client.post(
        "/api/payments/",
        json={
            "transaction_id": txn_id,
            "amount": 2500.0,
            "payment_date": str(date.today()),
            "payment_mode": "upi",
        },
    )
    assert overpay_resp.status_code == 400
    assert "exceed" in overpay_resp.json()["detail"].lower()

    # 6. Settle remaining balance: Pay ₹2,310.00
    pay2_resp = client.post(
        "/api/payments/",
        json={
            "transaction_id": txn_id,
            "amount": 2310.0,
            "payment_date": str(date.today()),
            "payment_mode": "upi",
            "reference_number": "UPI987654321",
        },
    )
    assert pay2_resp.status_code == 201

    # Check fully paid status
    txn_after_pay2 = client.get(f"/api/transactions/{txn_id}").json()
    assert txn_after_pay2["total_paid"] == 4310.00
    assert txn_after_pay2["balance_due"] == 0.00
    assert txn_after_pay2["status"] == "fully_paid"

    # 7. Check reports
    daily_rep = client.get(f"/api/reports/daily-summary?date_from={str(date.today())}").json()
    assert daily_rep["total_transactions"] == 1
    assert daily_rep["total_gross_amount"] == 4500.00
    assert daily_rep["total_net_payable"] == 4310.00
    assert daily_rep["total_payments_received"] == 4310.00
    assert daily_rep["total_outstanding"] == 0.00
