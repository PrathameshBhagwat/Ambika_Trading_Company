"""
Seed utility to populate default vegetables and system settings
on initial database startup.
"""

from sqlalchemy.orm import Session
from database import SessionLocal
from models.vegetable import Vegetable
from models.app_settings import AppSetting
from utils.logger import logger

DEFAULT_VEGETABLES = [
    ("टोमॅटो", "Tomato"),
    ("कांदा", "Onion"),
    ("बटाटा", "Potato"),
    ("वांगी", "Brinjal"),
    ("कोबी", "Cabbage"),
    ("फ्लॉवर", "Cauliflower"),
    ("हिरवी मिरची", "Green Chilli"),
    ("भेंडी", "Okra (Bhendi)"),
    ("शिमला मिरची", "Capsicum"),
    ("आले", "Ginger"),
    ("लसूण", "Garlic"),
    ("काकडी", "Cucumber"),
    ("कारले", "Bitter Gourd"),
    ("गाजर", "Carrot"),
    ("दोडका", "Ridge Gourd"),
    ("शेवगा", "Drumstick"),
    ("पालक", "Spinach"),
    ("मेथी", "Fenugreek"),
]


def seed_initial_data():
    """Seeds default vegetables and settings if none exist."""
    db: Session = SessionLocal()
    try:
        # Check if vegetables exist
        count = db.query(Vegetable).count()
        if count == 0:
            logger.info("Fresh database detected. Seeding default vegetable masters...")
            for local_name, eng_name in DEFAULT_VEGETABLES:
                veg = Vegetable(
                    name_local=local_name,
                    name_english=eng_name,
                    is_active=True,
                )
                db.add(veg)
            db.commit()
            logger.info(f"Seeded {len(DEFAULT_VEGETABLES)} default vegetables.")

        # Seed default business settings if none
        settings_count = db.query(AppSetting).count()
        if settings_count == 0:
            default_settings = [
                ("business_name", "Ambika Trading"),
                ("business_name_local", "अंबिका ट्रेडिंग"),
                ("proprietor_name", "Proprietor"),
                ("phone", "9876543210"),
                ("address", "APMC Market Yard, Maharashtra"),
                ("currency_symbol", "₹"),
            ]
            for key, val in default_settings:
                db.add(AppSetting(key=key, value=val))
            db.commit()
            logger.info("Seeded default app settings.")
    except Exception as e:
        logger.error(f"Error seeding initial data: {e}")
        db.rollback()
    finally:
        db.close()
