"""add_print_count_to_transactions

Revision ID: c13cb0c63e04
Revises: 
Create Date: 2026-09-25 01:15:11.429611

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c13cb0c63e04'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('transactions', sa.Column('print_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('transactions', 'print_count')
