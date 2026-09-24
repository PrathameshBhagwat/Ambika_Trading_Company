"""
Unit tests for core business calculations.

Tests the critical calculation rules:
- Item amount: (weight_kg / 10) × rate_per_10kg
- Gross amount: sum of item amounts
- Total deductions: sum of all deduction fields
- Net payable: gross - deductions (ALWAYS subtracted)
- Balance due: net_payable - total_paid
- Payment validation: no overpayment, positive amounts only
"""

import sys
import os
from decimal import Decimal

import pytest

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.calculations import (
    calculate_item_amount,
    calculate_gross_amount,
    calculate_total_deductions,
    calculate_net_payable,
    calculate_balance_due,
    validate_payment_amount,
    round_money,
)


class TestItemAmountCalculation:
    """Tests for calculate_item_amount: (weight_kg / 10) × rate_per_10kg"""

    def test_basic_calculation(self):
        # 500 KG @ ₹2,000 per 10 KG = (500/10) × 2000 = ₹1,00,000
        result = calculate_item_amount(500, 2000)
        assert result == Decimal("100000.00")

    def test_tomato_example(self):
        # 300 KG @ ₹1,500 per 10 KG = (300/10) × 1500 = ₹45,000
        result = calculate_item_amount(300, 1500)
        assert result == Decimal("45000.00")

    def test_fractional_weight(self):
        # 75.5 KG @ ₹800 per 10 KG = (75.5/10) × 800 = ₹6,040
        result = calculate_item_amount(75.5, 800)
        assert result == Decimal("6040.00")

    def test_small_quantity(self):
        # 10 KG @ ₹500 per 10 KG = (10/10) × 500 = ₹500
        result = calculate_item_amount(10, 500)
        assert result == Decimal("500.00")

    def test_decimal_precision(self):
        # 33 KG @ ₹1,000 per 10 KG = (33/10) × 1000 = ₹3,300
        result = calculate_item_amount(33, 1000)
        assert result == Decimal("3300.00")

    def test_rounding(self):
        # 7 KG @ ₹333 per 10 KG = (7/10) × 333 = 233.1
        result = calculate_item_amount(7, 333)
        assert result == Decimal("233.10")

    def test_zero_weight_raises(self):
        with pytest.raises(ValueError, match="weight_kg must be > 0"):
            calculate_item_amount(0, 1000)

    def test_negative_weight_raises(self):
        with pytest.raises(ValueError, match="weight_kg must be > 0"):
            calculate_item_amount(-10, 1000)

    def test_zero_rate_raises(self):
        with pytest.raises(ValueError, match="rate_per_10kg must be > 0"):
            calculate_item_amount(100, 0)

    def test_negative_rate_raises(self):
        with pytest.raises(ValueError, match="rate_per_10kg must be > 0"):
            calculate_item_amount(100, -500)


class TestGrossAmountCalculation:
    """Tests for calculate_gross_amount: sum of all item amounts"""

    def test_single_item(self):
        result = calculate_gross_amount([Decimal("100000.00")])
        assert result == Decimal("100000.00")

    def test_two_items(self):
        # From the BRD example: Onion ₹1,00,000 + Tomato ₹45,000 = ₹1,45,000
        result = calculate_gross_amount([Decimal("100000.00"), Decimal("45000.00")])
        assert result == Decimal("145000.00")

    def test_multiple_items(self):
        amounts = [Decimal("10000"), Decimal("20000"), Decimal("30000")]
        result = calculate_gross_amount(amounts)
        assert result == Decimal("60000.00")

    def test_empty_list_raises(self):
        with pytest.raises(ValueError, match="At least one item"):
            calculate_gross_amount([])

    def test_accepts_float_inputs(self):
        result = calculate_gross_amount([100000.00, 45000.00])
        assert result == Decimal("145000.00")


class TestTotalDeductionsCalculation:
    """Tests for calculate_total_deductions: sum of all deduction fields"""

    def test_all_deductions(self):
        result = calculate_total_deductions(
            hamali=500, bharai=300, tolai=200,
            mapai=0, lekki=0, motor_bhada=1000, other_deductions=0,
        )
        assert result == Decimal("2000.00")

    def test_zero_deductions(self):
        result = calculate_total_deductions()
        assert result == Decimal("0.00")

    def test_only_hamali(self):
        result = calculate_total_deductions(hamali=750)
        assert result == Decimal("750.00")

    def test_negative_deduction_raises(self):
        with pytest.raises(ValueError, match="hamali must be >= 0"):
            calculate_total_deductions(hamali=-100)

    def test_negative_motor_bhada_raises(self):
        with pytest.raises(ValueError, match="motor_bhada must be >= 0"):
            calculate_total_deductions(motor_bhada=-50)


class TestNetPayableCalculation:
    """Tests for calculate_net_payable: gross - deductions (ALWAYS subtracted)"""

    def test_basic_subtraction(self):
        # ₹1,45,000 - ₹2,000 = ₹1,43,000
        result = calculate_net_payable(145000, 2000)
        assert result == Decimal("143000.00")

    def test_zero_deductions(self):
        result = calculate_net_payable(50000, 0)
        assert result == Decimal("50000.00")

    def test_deductions_equal_gross(self):
        result = calculate_net_payable(1000, 1000)
        assert result == Decimal("0.00")

    def test_deductions_exceed_gross_raises(self):
        """CRITICAL: Deductions must NEVER result in negative net payable"""
        with pytest.raises(ValueError, match="exceed gross amount"):
            calculate_net_payable(1000, 2000)

    def test_net_always_less_or_equal_to_gross(self):
        """Verify net payable is never greater than gross amount"""
        result = calculate_net_payable(10000, 500)
        assert result <= Decimal("10000.00")
        assert result == Decimal("9500.00")


class TestBalanceDueCalculation:
    """Tests for calculate_balance_due: net_payable - total_paid"""

    def test_no_payment(self):
        result = calculate_balance_due(143000, 0)
        assert result == Decimal("143000.00")

    def test_partial_payment(self):
        result = calculate_balance_due(143000, 50000)
        assert result == Decimal("93000.00")

    def test_full_payment(self):
        result = calculate_balance_due(143000, 143000)
        assert result == Decimal("0.00")

    def test_overpayment_raises(self):
        with pytest.raises(ValueError, match="Overpayment not allowed"):
            calculate_balance_due(143000, 150000)


class TestPaymentValidation:
    """Tests for validate_payment_amount"""

    def test_valid_payment(self):
        result = validate_payment_amount(5000, 10000)
        assert result == Decimal("5000.00")

    def test_exact_balance_payment(self):
        result = validate_payment_amount(10000, 10000)
        assert result == Decimal("10000.00")

    def test_exceeds_balance_raises(self):
        with pytest.raises(ValueError, match="exceeds balance due"):
            validate_payment_amount(15000, 10000)

    def test_zero_payment_raises(self):
        with pytest.raises(ValueError, match="must be > 0"):
            validate_payment_amount(0, 10000)

    def test_negative_payment_raises(self):
        with pytest.raises(ValueError, match="must be > 0"):
            validate_payment_amount(-500, 10000)


class TestRoundMoney:
    """Tests for monetary rounding"""

    def test_round_down(self):
        assert round_money(Decimal("100.124")) == Decimal("100.12")

    def test_round_up(self):
        assert round_money(Decimal("100.125")) == Decimal("100.13")

    def test_no_rounding_needed(self):
        assert round_money(Decimal("100.10")) == Decimal("100.10")

    def test_whole_number(self):
        assert round_money(Decimal("100")) == Decimal("100.00")


class TestFullBRDExample:
    """
    End-to-end test of the complete example from the BRD:

    Farmer: Ganesh Patil
    Items:
      Onion - 500 KG - ₹2,000 per 10 KG
      Tomato - 300 KG - ₹1,500 per 10 KG
    Deductions:
      Hamali: ₹500, Bharai: ₹300, Tolai: ₹200, Motor Bhada: ₹1,000
    """

    def test_complete_workflow(self):
        # Step 1: Calculate item amounts
        onion_amount = calculate_item_amount(500, 2000)
        assert onion_amount == Decimal("100000.00")  # ₹1,00,000

        tomato_amount = calculate_item_amount(300, 1500)
        assert tomato_amount == Decimal("45000.00")  # ₹45,000

        # Step 2: Calculate gross
        gross = calculate_gross_amount([onion_amount, tomato_amount])
        assert gross == Decimal("145000.00")  # ₹1,45,000

        # Step 3: Calculate deductions
        deductions = calculate_total_deductions(
            hamali=500, bharai=300, tolai=200,
            mapai=0, lekki=0, motor_bhada=1000, other_deductions=0,
        )
        assert deductions == Decimal("2000.00")  # ₹2,000

        # Step 4: Calculate net payable (CRITICAL: always subtract)
        net = calculate_net_payable(gross, deductions)
        assert net == Decimal("143000.00")  # ₹1,43,000
        assert net < gross  # Net must ALWAYS be less than or equal to gross
        assert net == gross - deductions  # Verify subtraction

        # Step 5: Initial balance due
        balance = calculate_balance_due(net, 0)
        assert balance == Decimal("143000.00")

        # Step 6: Partial payment
        payment1 = validate_payment_amount(50000, balance)
        balance = calculate_balance_due(net, payment1)
        assert balance == Decimal("93000.00")

        # Step 7: Remaining payment
        payment2 = validate_payment_amount(93000, balance)
        final_balance = calculate_balance_due(net, float(payment1) + float(payment2))
        assert final_balance == Decimal("0.00")
