"""
Ambika Trading - Core Business Calculations

All financial calculations are centralized here. This is the single source
of truth for how amounts, deductions, and balances are computed.

CRITICAL BUSINESS RULE:
  Deductions are ALWAYS subtracted from the gross amount.
  net_payable = gross_amount - total_deductions
  net_payable must NEVER exceed gross_amount.
"""

from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass


# Precision for all monetary calculations
PRECISION = Decimal("0.01")
RATE_UNIT_KG = Decimal("10")


def _to_decimal(value: float | int | str | Decimal) -> Decimal:
    """Safely convert any numeric value to Decimal."""
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def round_money(value: Decimal) -> Decimal:
    """Round a monetary value to 2 decimal places using banker's standard rounding."""
    return value.quantize(PRECISION, rounding=ROUND_HALF_UP)


def calculate_item_amount(weight_kg: float | Decimal, rate_per_10kg: float | Decimal) -> Decimal:
    """
    Calculate the amount for a single transaction line item.

    Formula: (weight_kg / 10) × rate_per_10kg

    Args:
        weight_kg: Weight of the vegetable in kilograms (must be > 0)
        rate_per_10kg: Rate per 10 KG in INR (must be > 0)

    Returns:
        Rounded item amount as Decimal

    Raises:
        ValueError: If weight_kg or rate_per_10kg is <= 0
    """
    w = _to_decimal(weight_kg)
    r = _to_decimal(rate_per_10kg)

    if w <= 0:
        raise ValueError(f"weight_kg must be > 0, got {w}")
    if r <= 0:
        raise ValueError(f"rate_per_10kg must be > 0, got {r}")

    amount = (w / RATE_UNIT_KG) * r
    return round_money(amount)


def calculate_gross_amount(item_amounts: list[Decimal | float]) -> Decimal:
    """
    Calculate the gross amount as the sum of all item amounts.

    Args:
        item_amounts: List of individual line-item amounts

    Returns:
        Rounded gross amount as Decimal

    Raises:
        ValueError: If the list is empty
    """
    if not item_amounts:
        raise ValueError("At least one item is required to calculate gross amount")

    total = sum(_to_decimal(a) for a in item_amounts)
    return round_money(total)


@dataclass
class DeductionBreakdown:
    """Holds all deduction values for a transaction."""
    hamali: Decimal = Decimal("0.00")
    bharai: Decimal = Decimal("0.00")
    tolai: Decimal = Decimal("0.00")
    mapai: Decimal = Decimal("0.00")
    lekki: Decimal = Decimal("0.00")
    motor_bhada: Decimal = Decimal("0.00")
    other_deductions: Decimal = Decimal("0.00")


def calculate_total_deductions(
    hamali: float | Decimal = 0,
    bharai: float | Decimal = 0,
    tolai: float | Decimal = 0,
    mapai: float | Decimal = 0,
    lekki: float | Decimal = 0,
    motor_bhada: float | Decimal = 0,
    other_deductions: float | Decimal = 0,
) -> Decimal:
    """
    Calculate the total deductions from all applicable deduction types.

    All deduction values must be >= 0.

    Args:
        hamali: Loading/unloading labor charge
        bharai: Bag filling/packing charge
        tolai: Weighing charge
        mapai: Measurement/counting charge
        lekki: Commission / brokerage charge
        motor_bhada: Transportation charge
        other_deductions: Miscellaneous deductions

    Returns:
        Rounded total deductions as Decimal

    Raises:
        ValueError: If any deduction value is negative
    """
    values = {
        "hamali": _to_decimal(hamali),
        "bharai": _to_decimal(bharai),
        "tolai": _to_decimal(tolai),
        "mapai": _to_decimal(mapai),
        "lekki": _to_decimal(lekki),
        "motor_bhada": _to_decimal(motor_bhada),
        "other_deductions": _to_decimal(other_deductions),
    }

    for name, val in values.items():
        if val < 0:
            raise ValueError(f"{name} must be >= 0, got {val}")

    total = sum(values.values())
    return round_money(total)


def calculate_net_payable(gross_amount: float | Decimal, total_deductions: float | Decimal) -> Decimal:
    """
    Calculate the net payable amount to the farmer.

    CRITICAL: net_payable = gross_amount - total_deductions
    Deductions are ALWAYS subtracted. Never added.

    Args:
        gross_amount: Total gross amount before deductions
        total_deductions: Total deductions to subtract

    Returns:
        Rounded net payable amount as Decimal

    Raises:
        ValueError: If net payable would be negative (deductions exceed gross)
    """
    gross = _to_decimal(gross_amount)
    deductions = _to_decimal(total_deductions)

    net = gross - deductions

    if net < 0:
        raise ValueError(
            f"Total deductions ({deductions}) exceed gross amount ({gross}). "
            f"Net payable cannot be negative."
        )

    return round_money(net)


def calculate_balance_due(net_payable: float | Decimal, total_paid: float | Decimal) -> Decimal:
    """
    Calculate the remaining balance due on a transaction.

    Args:
        net_payable: Net amount payable to farmer
        total_paid: Total amount already paid

    Returns:
        Rounded balance due as Decimal

    Raises:
        ValueError: If total_paid exceeds net_payable (overpayment)
    """
    net = _to_decimal(net_payable)
    paid = _to_decimal(total_paid)

    if paid > net:
        raise ValueError(
            f"Total paid ({paid}) exceeds net payable ({net}). Overpayment not allowed."
        )

    balance = net - paid
    return round_money(balance)


def validate_payment_amount(
    payment_amount: float | Decimal,
    balance_due: float | Decimal,
) -> Decimal:
    """
    Validate that a payment amount is acceptable.

    Args:
        payment_amount: The amount being paid
        balance_due: The remaining balance on the transaction

    Returns:
        The validated payment amount as Decimal

    Raises:
        ValueError: If payment is <= 0 or exceeds balance due
    """
    amount = _to_decimal(payment_amount)
    balance = _to_decimal(balance_due)

    if amount <= 0:
        raise ValueError(f"Payment amount must be > 0, got {amount}")

    if amount > balance:
        raise ValueError(
            f"Payment amount ({amount}) exceeds balance due ({balance}). "
            f"Overpayment not allowed."
        )

    return round_money(amount)
