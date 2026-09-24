"""
End-to-end API integration tests for Transactions and Payments.
Uses FastAPI TestClient with an in-memory SQLite database.
"""

import json
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, get_db
import models

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


def test_farmer_mutations_create_audit_logs():
    # 1. Farmer Create
    create_resp = client.post(
        "/api/farmers/",
        json={"name": "Kailas Shinde", "mobile": "9890123456", "village": "Ojhar"},
    )
    assert create_resp.status_code == 201
    farmer_id = create_resp.json()["id"]

    audit_resp = client.get(f"/api/audit/?entity_type=Farmer&entity_id={farmer_id}")
    assert audit_resp.status_code == 200
    logs = audit_resp.json()["items"]
    assert len(logs) == 1
    assert logs[0]["action"] == "CREATE"
    assert logs[0]["entity_type"] == "Farmer"
    new_vals = json.loads(logs[0]["new_values"])
    assert new_vals["name"] == "Kailas Shinde"
    assert logs[0]["old_values"] is None

    # 2. Farmer Update
    update_resp = client.put(
        f"/api/farmers/{farmer_id}",
        json={"name": "Kailas R. Shinde", "mobile": "9890123456", "village": "Ojhar (Nashik)"},
    )
    assert update_resp.status_code == 200

    audit_resp = client.get(f"/api/audit/?entity_type=Farmer&entity_id={farmer_id}")
    logs = audit_resp.json()["items"]
    assert len(logs) == 2
    assert logs[0]["action"] == "UPDATE"
    old_vals = json.loads(logs[0]["old_values"])
    new_vals = json.loads(logs[0]["new_values"])
    assert old_vals["name"] == "Kailas Shinde"
    assert new_vals["name"] == "Kailas R. Shinde"

    # 3. Farmer Deactivate (DELETE endpoint)
    delete_resp = client.delete(f"/api/farmers/{farmer_id}")
    assert delete_resp.status_code == 200

    audit_resp = client.get(f"/api/audit/?entity_type=Farmer&entity_id={farmer_id}")
    logs = audit_resp.json()["items"]
    assert len(logs) == 3
    assert logs[0]["action"] == "DELETE"
    old_vals = json.loads(logs[0]["old_values"])
    new_vals = json.loads(logs[0]["new_values"])
    assert old_vals["is_active"] is True
    assert new_vals["is_active"] is False


def test_vegetable_mutations_create_audit_logs():
    # 1. Vegetable Create
    create_resp = client.post(
        "/api/vegetables/",
        json={"name_local": "वांगी", "name_english": "Brinjal", "default_rate": 150.0},
    )
    assert create_resp.status_code == 201
    veg_id = create_resp.json()["id"]

    audit_resp = client.get(f"/api/audit/?entity_type=Vegetable&entity_id={veg_id}")
    logs = audit_resp.json()["items"]
    assert len(logs) == 1
    assert logs[0]["action"] == "CREATE"
    new_vals = json.loads(logs[0]["new_values"])
    assert new_vals["name_local"] == "वांगी"

    # 2. Vegetable Update
    update_resp = client.put(
        f"/api/vegetables/{veg_id}",
        json={"name_local": "वांगी (काटेरी)", "name_english": "Brinjal Spiny", "default_rate": 180.0},
    )
    assert update_resp.status_code == 200

    audit_resp = client.get(f"/api/audit/?entity_type=Vegetable&entity_id={veg_id}")
    logs = audit_resp.json()["items"]
    assert len(logs) == 2
    assert logs[0]["action"] == "UPDATE"
    old_vals = json.loads(logs[0]["old_values"])
    new_vals = json.loads(logs[0]["new_values"])
    assert old_vals["name_local"] == "वांगी"
    assert new_vals["name_local"] == "वांगी (काटेरी)"

    # 3. Vegetable Deactivate
    delete_resp = client.delete(f"/api/vegetables/{veg_id}")
    assert delete_resp.status_code == 200

    audit_resp = client.get(f"/api/audit/?entity_type=Vegetable&entity_id={veg_id}")
    logs = audit_resp.json()["items"]
    assert len(logs) == 3
    assert logs[0]["action"] == "DELETE"
    new_vals = json.loads(logs[0]["new_values"])
    assert new_vals["is_active"] is False


def test_transaction_and_payment_mutations_create_audit_logs():
    # Setup farmer and vegetable
    f_resp = client.post("/api/farmers/", json={"name": "Suresh More", "mobile": "9800000001", "village": "Dindori"})
    farmer_id = f_resp.json()["id"]

    v_resp = client.post("/api/vegetables/", json={"name_local": "टोमॅटो", "name_english": "Tomato"})
    veg_id = v_resp.json()["id"]

    # 1. Create Transaction
    txn_resp = client.post(
        "/api/transactions/",
        json={
            "transaction_date": "2026-03-25",
            "farmer_id": farmer_id,
            "items": [
                {
                    "vegetable_id": veg_id,
                    "bags_count": 10,
                    "weight_kg": 250.0,
                    "rate_per_10kg": 150.0,
                }
            ],
            "deductions": {
                "hamali": 50.0,
                "bharai": 30.0,
                "tolai": 20.0,
                "mapai": 0.0,
                "lekki": 10.0,
                "motor_bhada": 100.0,
                "other_deductions": 0.0,
                "other_deductions_note": None,
            },
        },
    )
    assert txn_resp.status_code == 201
    txn_id = txn_resp.json()["id"]

    audit_resp = client.get(f"/api/audit/?entity_type=Transaction&entity_id={txn_id}")
    logs = audit_resp.json()["items"]
    assert len(logs) == 1
    assert logs[0]["action"] == "CREATE"
    new_vals = json.loads(logs[0]["new_values"])
    assert new_vals["net_payable"] == 3540.0

    # 2. Record Payment
    pmt_resp = client.post(
        "/api/payments/",
        json={
            "transaction_id": txn_id,
            "amount": 1000.0,
            "payment_date": "2026-03-25",
            "payment_mode": "CASH",
            "notes": "Advance partial payment",
        },
    )
    assert pmt_resp.status_code == 201
    pmt_id = pmt_resp.json()["id"]

    audit_resp = client.get(f"/api/audit/?entity_type=Payment&entity_id={pmt_id}")
    logs = audit_resp.json()["items"]
    assert len(logs) == 1
    assert logs[0]["action"] == "CREATE"
    new_vals = json.loads(logs[0]["new_values"])
    assert new_vals["amount"] == 1000.0
    assert new_vals["transaction_status"] == "partially_paid"

    # 3. Cancel Transaction
    cancel_resp = client.post(
        f"/api/transactions/{txn_id}/cancel",
        json={"cancel_reason": "Entry made under wrong farmer name"},
    )
    assert cancel_resp.status_code == 200

    audit_resp = client.get(f"/api/audit/?entity_type=Transaction&entity_id={txn_id}")
    logs = audit_resp.json()["items"]
    assert len(logs) == 2
    assert logs[0]["action"] == "CANCEL"
    new_vals = json.loads(logs[0]["new_values"])
    assert new_vals["status"] == "cancelled"
    assert new_vals["cancel_reason"] == "Entry made under wrong farmer name"


def test_cancelled_transaction_does_not_distort_ledger_or_reports():
    """
    Phase B Regression Test:
    Verify that a transaction with partial payment that is subsequently cancelled
    does NOT distort the farmer ledger or report aggregations.
    Financial totals (gross, deductions, net payable, paid, outstanding)
    must strictly exclude cancelled transactions and their associated payments.
    """
    today_str = str(date.today())

    # 1. Create Farmer
    f_resp = client.post(
        "/api/farmers/",
        json={"name": "Govind Shinde", "mobile": "9822998877", "village": "Niphad"},
    )
    assert f_resp.status_code == 201
    farmer_id = f_resp.json()["id"]

    # 2. Create Vegetable
    v_resp = client.post(
        "/api/vegetables/",
        json={"name_local": "कांदा", "name_english": "Onion", "default_rate": 200.0},
    )
    assert v_resp.status_code == 201
    veg_id = v_resp.json()["id"]

    # 3. Create Transaction 1 (will be cancelled later)
    # 250 kg @ ₹200 / 10kg = ₹5,000 gross. Deductions = ₹200. Net = ₹4,800
    txn1_resp = client.post(
        "/api/transactions/",
        json={
            "transaction_date": today_str,
            "farmer_id": farmer_id,
            "items": [
                {
                    "vegetable_id": veg_id,
                    "bags_count": 5,
                    "weight_kg": 250.0,
                    "rate_per_10kg": 200.0,
                }
            ],
            "deductions": {
                "hamali": 100.0,
                "bharai": 50.0,
                "tolai": 50.0,
                "mapai": 0.0,
                "lekki": 0.0,
                "motor_bhada": 0.0,
                "other_deductions": 0.0,
            },
        },
    )
    assert txn1_resp.status_code == 201
    txn1_id = txn1_resp.json()["id"]
    assert txn1_resp.json()["net_payable"] == 4800.00

    # 4. Record partial payment of ₹2,000 against Transaction 1
    pay_resp = client.post(
        "/api/payments/",
        json={
            "transaction_id": txn1_id,
            "amount": 2000.0,
            "payment_date": today_str,
            "payment_mode": "cash",
            "notes": "Advance for onion lot",
        },
    )
    assert pay_resp.status_code == 201
    assert pay_resp.json()["transaction_status"] == "partially_paid"

    # 5. Create Transaction 2 (valid active transaction)
    # 100 kg @ ₹200 / 10kg = ₹2,000 gross. Deductions = ₹100. Net = ₹1,900
    txn2_resp = client.post(
        "/api/transactions/",
        json={
            "transaction_date": today_str,
            "farmer_id": farmer_id,
            "items": [
                {
                    "vegetable_id": veg_id,
                    "bags_count": 2,
                    "weight_kg": 100.0,
                    "rate_per_10kg": 200.0,
                }
            ],
            "deductions": {
                "hamali": 50.0,
                "bharai": 25.0,
                "tolai": 25.0,
                "mapai": 0.0,
                "lekki": 0.0,
                "motor_bhada": 0.0,
                "other_deductions": 0.0,
            },
        },
    )
    assert txn2_resp.status_code == 201
    txn2_id = txn2_resp.json()["id"]
    assert txn2_resp.json()["net_payable"] == 1900.00

    # 6. Cancel Transaction 1
    cancel_resp = client.post(
        f"/api/transactions/{txn1_id}/cancel",
        json={"cancel_reason": "Quality rejection - transaction voided"},
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"

    # 7. Verify Payments for farmer:
    # All payments include audit info with transaction_status='cancelled'
    all_pmts = client.get(f"/api/payments/farmer/{farmer_id}").json()
    assert all_pmts["total"] == 1
    assert all_pmts["items"][0]["transaction_status"] == "cancelled"

    # With exclude_cancelled=True, excluded payments should be 0
    active_pmts = client.get(f"/api/payments/farmer/{farmer_id}?exclude_cancelled=true").json()
    assert active_pmts["total"] == 0

    # 8. Verify Daily Summary Report excludes cancelled transaction & its payment
    daily_rep = client.get(f"/api/reports/daily-summary?date_from={today_str}").json()
    assert daily_rep["total_transactions"] == 1  # Only Txn 2
    assert daily_rep["total_gross_amount"] == 2000.00  # Only Txn 2
    assert daily_rep["total_net_payable"] == 1900.00  # Only Txn 2
    assert daily_rep["total_payments_received"] == 0.00  # Payment on cancelled bill excluded
    assert daily_rep["total_outstanding"] == 1900.00  # Exactly matches Txn 2 net payable

    # 9. Verify Farmer Outstanding Report
    out_rep = client.get("/api/reports/farmer-outstanding").json()
    farmer_out = next((item for item in out_rep["items"] if item["farmer_id"] == farmer_id), None)
    assert farmer_out is not None
    assert farmer_out["total_transactions"] == 1  # Only Txn 2
    assert farmer_out["total_net_payable"] == 1900.00
    assert farmer_out["total_paid"] == 0.00
    assert farmer_out["total_outstanding"] == 1900.00


def test_transaction_response_includes_farmer_contact_info():
    """Phase D: Verify transaction response exposes farmer_mobile and farmer_village."""
    f_resp = client.post(
        "/api/farmers/",
        json={"name": "Madhukar Gite", "mobile": "9422011223", "village": "Saykheda"},
    )
    farmer_id = f_resp.json()["id"]

    v_resp = client.post(
        "/api/vegetables/",
        json={"name_local": "मिरची", "name_english": "Chilli"},
    )
    veg_id = v_resp.json()["id"]

    txn_resp = client.post(
        "/api/transactions/",
        json={
            "transaction_date": str(date.today()),
            "farmer_id": farmer_id,
            "items": [{"vegetable_id": veg_id, "bags_count": 2, "weight_kg": 50.0, "rate_per_10kg": 300.0}],
            "deductions": {"hamali": 20.0, "bharai": 10.0, "tolai": 10.0, "mapai": 0.0, "lekki": 0.0, "motor_bhada": 0.0, "other_deductions": 0.0},
        },
    )
    assert txn_resp.status_code == 201
    data = txn_resp.json()
    assert data["farmer_name"] == "Madhukar Gite"
    assert data["farmer_mobile"] == "9422011223"
    assert data["farmer_village"] == "Saykheda"

    # Also verify GET /api/transactions/{id}
    get_resp = client.get(f"/api/transactions/{data['id']}")
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["farmer_mobile"] == "9422011223"
    assert get_data["farmer_village"] == "Saykheda"


def test_transaction_editing_lifecycle_and_rejections():
    """
    Phase C: Transaction Editing (FR-TX-10).
    Tests:
    1. Edit unpaid transaction successfully
    2. Gross recalculation
    3. Deduction recalculation
    4. Net payable recalculation
    5. Editing partially paid transaction rejected
    6. Editing fully paid transaction rejected
    7. Editing cancelled transaction rejected
    8. Audit record created with action=UPDATE
    9. Bill number remains unchanged
    """
    today_str = str(date.today())

    f_resp = client.post(
        "/api/farmers/",
        json={"name": "Vishnu Jadhav", "mobile": "9823456789", "village": "Lasalgaon"},
    )
    farmer_id = f_resp.json()["id"]

    v1_resp = client.post("/api/vegetables/", json={"name_local": "कोथिंबीर", "name_english": "Coriander"})
    v1_id = v1_resp.json()["id"]
    v2_resp = client.post("/api/vegetables/", json={"name_local": "मेथी", "name_english": "Fenugreek"})
    v2_id = v2_resp.json()["id"]

    # Initial: 100 kg @ ₹100/10kg = ₹1,000 gross. Ded = ₹50. Net = ₹950
    txn_resp = client.post(
        "/api/transactions/",
        json={
            "transaction_date": today_str,
            "farmer_id": farmer_id,
            "items": [{"vegetable_id": v1_id, "bags_count": 5, "weight_kg": 100.0, "rate_per_10kg": 100.0}],
            "deductions": {"hamali": 50.0, "bharai": 0.0, "tolai": 0.0, "mapai": 0.0, "lekki": 0.0, "motor_bhada": 0.0, "other_deductions": 0.0},
        },
    )
    assert txn_resp.status_code == 201
    txn = txn_resp.json()
    txn_id = txn["id"]
    original_bill_number = txn["bill_number"]

    # 1. Edit unpaid transaction successfully: Change items & deductions
    # Item 1: 150 kg @ ₹120/10kg = ₹1,800
    # Item 2: 50 kg @ ₹200/10kg = ₹1,000
    # Total Gross = ₹2,800. Deductions = ₹150. Net = ₹2,650
    edit_resp = client.put(
        f"/api/transactions/{txn_id}",
        json={
            "items": [
                {"vegetable_id": v1_id, "bags_count": 6, "weight_kg": 150.0, "rate_per_10kg": 120.0},
                {"vegetable_id": v2_id, "bags_count": 2, "weight_kg": 50.0, "rate_per_10kg": 200.0},
            ],
            "deductions": {
                "hamali": 80.0,
                "bharai": 40.0,
                "tolai": 30.0,
                "mapai": 0.0,
                "lekki": 0.0,
                "motor_bhada": 0.0,
                "other_deductions": 0.0,
            },
        },
    )
    assert edit_resp.status_code == 200
    edited_txn = edit_resp.json()

    # Verify recalculations
    assert edited_txn["gross_amount"] == 2800.00
    assert edited_txn["total_deductions"] == 150.00
    assert edited_txn["net_payable"] == 2650.00
    assert edited_txn["balance_due"] == 2650.00
    # Bill number must remain unchanged
    assert edited_txn["bill_number"] == original_bill_number

    # Verify UPDATE audit record
    audit_resp = client.get(f"/api/audit/?entity_type=Transaction&entity_id={txn_id}&action=UPDATE")
    assert audit_resp.status_code == 200
    update_logs = audit_resp.json()["items"]
    assert len(update_logs) == 1
    assert update_logs[0]["action"] == "UPDATE"
    old_vals = json.loads(update_logs[0]["old_values"])
    new_vals = json.loads(update_logs[0]["new_values"])
    assert old_vals["gross_amount"] == 1000.00
    assert new_vals["gross_amount"] == 2800.00
    assert new_vals["bill_number"] == original_bill_number

    # 2. Add partial payment -> Transaction becomes PARTIALLY_PAID
    pay_resp = client.post(
        "/api/payments/",
        json={
            "transaction_id": txn_id,
            "amount": 500.0,
            "payment_date": today_str,
            "payment_mode": "cash",
        },
    )
    assert pay_resp.status_code == 201

    # Attempt to edit partially paid transaction -> Must be rejected (400)
    rej_part_pay = client.put(
        f"/api/transactions/{txn_id}",
        json={"items": [{"vegetable_id": v1_id, "bags_count": 1, "weight_kg": 10.0, "rate_per_10kg": 50.0}]},
    )
    assert rej_part_pay.status_code == 400
    assert "partially paid" in rej_part_pay.json()["detail"].lower()

    # Pay remaining balance -> FULLY_PAID
    pay_full = client.post(
        "/api/payments/",
        json={
            "transaction_id": txn_id,
            "amount": 2150.0,
            "payment_date": today_str,
            "payment_mode": "cash",
        },
    )
    assert pay_full.status_code == 201

    # Attempt to edit fully paid transaction -> Must be rejected (400)
    rej_full_pay = client.put(
        f"/api/transactions/{txn_id}",
        json={"items": [{"vegetable_id": v1_id, "bags_count": 1, "weight_kg": 10.0, "rate_per_10kg": 50.0}]},
    )
    assert rej_full_pay.status_code == 400
    assert "fully paid" in rej_full_pay.json()["detail"].lower()

    # 3. Create another transaction, cancel it, and attempt edit
    txn2_resp = client.post(
        "/api/transactions/",
        json={
            "transaction_date": today_str,
            "farmer_id": farmer_id,
            "items": [{"vegetable_id": v1_id, "bags_count": 1, "weight_kg": 20.0, "rate_per_10kg": 100.0}],
            "deductions": {"hamali": 0.0, "bharai": 0.0, "tolai": 0.0, "mapai": 0.0, "lekki": 0.0, "motor_bhada": 0.0, "other_deductions": 0.0},
        },
    )
    txn2_id = txn2_resp.json()["id"]
    client.post(f"/api/transactions/{txn2_id}/cancel", json={"cancel_reason": "Voided"})

    # Attempt to edit cancelled transaction -> Must be rejected (400)
    rej_cancelled = client.put(
        f"/api/transactions/{txn2_id}",
        json={"items": [{"vegetable_id": v1_id, "bags_count": 1, "weight_kg": 10.0, "rate_per_10kg": 50.0}]},
    )
    assert rej_cancelled.status_code == 400
    assert "cancelled" in rej_cancelled.json()["detail"].lower()


def test_reprint_tracking_and_watermark_flag():
    """Phase G: Print tracking and duplicate watermark field."""
    today_str = str(date.today())
    f_resp = client.post("/api/farmers/", json={"name": "Ashok Kale", "mobile": "9988776655", "village": "Yeola"})
    farmer_id = f_resp.json()["id"]
    v_resp = client.post("/api/vegetables/", json={"name_local": "गाजर", "name_english": "Carrot"})
    veg_id = v_resp.json()["id"]

    txn_resp = client.post(
        "/api/transactions/",
        json={
            "transaction_date": today_str,
            "farmer_id": farmer_id,
            "items": [{"vegetable_id": veg_id, "bags_count": 3, "weight_kg": 60.0, "rate_per_10kg": 150.0}],
            "deductions": {"hamali": 30.0, "bharai": 0.0, "tolai": 0.0, "mapai": 0.0, "lekki": 0.0, "motor_bhada": 0.0, "other_deductions": 0.0},
        },
    )
    txn_id = txn_resp.json()["id"]
    assert txn_resp.json()["print_count"] == 0

    # 1. First print
    p1 = client.post(f"/api/transactions/{txn_id}/print")
    assert p1.status_code == 200
    assert p1.json()["print_count"] == 1

    # 2. Second print (duplicate bill)
    p2 = client.post(f"/api/transactions/{txn_id}/print")
    assert p2.status_code == 200
    assert p2.json()["print_count"] == 2

    # 3. Third print
    p3 = client.post(f"/api/transactions/{txn_id}/print")
    assert p3.status_code == 200
    assert p3.json()["print_count"] == 3


def test_check_duplicate_farmer_warning():
    """Phase I: Duplicate farmer warning logic."""
    f_resp = client.post(
        "/api/farmers/",
        json={"name": "Balu Shinde", "mobile": "9876543210", "village": "Ozar"},
    )
    assert f_resp.status_code == 201
    f_id = f_resp.json()["id"]

    # 1. Matching mobile number
    dup_mobile = client.get("/api/farmers/check-duplicate?name=Different%20Name&mobile=9876543210")
    assert dup_mobile.status_code == 200
    data1 = dup_mobile.json()
    assert data1["is_duplicate"] is True
    assert len(data1["matches"]) >= 1
    assert any(m["id"] == f_id and "mobile" in m["match_reason"].lower() for m in data1["matches"])

    # 2. Matching identical name
    dup_name = client.get("/api/farmers/check-duplicate?name=Balu%20Shinde")
    assert dup_name.status_code == 200
    data2 = dup_name.json()
    assert data2["is_duplicate"] is True
    assert any(m["id"] == f_id for m in data2["matches"])

    # 3. Non-duplicate
    no_dup = client.get("/api/farmers/check-duplicate?name=Unique%20Person&mobile=1122334455")
    assert no_dup.status_code == 200
    assert no_dup.json()["is_duplicate"] is False
    assert len(no_dup.json()["matches"]) == 0

    # 4. Exclude self when editing
    self_check = client.get(f"/api/farmers/check-duplicate?name=Balu%20Shinde&mobile=9876543210&exclude_id={f_id}")
    assert self_check.status_code == 200
    assert not any(m["id"] == f_id for m in self_check.json()["matches"])


def test_auto_backup_creation_and_rotation(tmp_path, monkeypatch):
    """Phase J: Auto-backup generation and 30-backup rotation."""
    import os
    import time
    import sqlite3
    from pathlib import Path
    from routers.backup import prune_old_backups
    from config import settings

    # Setup dummy database in tmp_path
    monkeypatch.setattr(settings, "APP_DATA_DIR", tmp_path)
    test_db = tmp_path / settings.DB_FILENAME
    conn = sqlite3.connect(str(test_db))
    conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, val TEXT)")
    conn.execute("INSERT INTO test (val) VALUES ('ambika')")
    conn.commit()
    conn.close()

    # 1. Trigger auto backup via endpoint
    resp = client.post("/api/backup/auto-backup")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "ambika_backup_" in data["backup_filename"]
    assert Path(data["backup_path"]).exists()

    # 2. Test rotation with > 30 backups
    test_backup_dir = settings.BACKUP_DIR
    for i in range(35):
        dummy_file = test_backup_dir / f"ambika_backup_20260101_{i:06d}.db"
        dummy_file.write_text("dummy")
        os.utime(dummy_file, (time.time() - (35 - i) * 10, time.time() - (35 - i) * 10))

    all_files = list(test_backup_dir.glob("ambika_backup_*.db"))
    assert len(all_files) > 30

    pruned = prune_old_backups(test_backup_dir, max_keep=30)
    assert len(pruned) == len(all_files) - 30

    remaining = list(test_backup_dir.glob("ambika_backup_*.db"))
    assert len(remaining) == 30


