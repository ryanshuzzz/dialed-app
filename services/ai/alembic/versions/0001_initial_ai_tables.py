"""Initial AI tables: suggestions, suggestion_changes, generation_jobs

Revision ID: 0001
Revises:
Create Date: 2026-03-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS ai")

    # -- ai.suggestions --
    op.create_table(
        "suggestions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("suggestion_text", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="ai",
    )
    op.create_index(
        "ix_suggestions_session",
        "suggestions",
        ["session_id"],
        schema="ai",
    )

    # -- ai.suggestion_changes --
    op.create_table(
        "suggestion_changes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "suggestion_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ai.suggestions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("parameter", sa.String(100), nullable=False),
        sa.Column("suggested_value", sa.String(200), nullable=False),
        sa.Column("symptom", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Double(), nullable=True),
        sa.Column(
            "applied_status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'not_applied'"),
        ),
        sa.Column("actual_value", sa.String(200), nullable=True),
        sa.Column("outcome_lap_delta_ms", sa.Integer(), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "applied_status IN ('not_applied', 'applied', 'applied_modified', 'skipped')",
            name="ck_suggestion_changes_applied_status",
        ),
        schema="ai",
    )
    op.create_index(
        "ix_suggestion_changes_suggestion",
        "suggestion_changes",
        ["suggestion_id"],
        schema="ai",
    )

    # -- ai.generation_jobs --
    op.create_table(
        "generation_jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'streaming', 'complete', 'failed')",
            name="ck_generation_jobs_status",
        ),
        schema="ai",
    )


def downgrade() -> None:
    op.drop_table("generation_jobs", schema="ai")
    op.drop_table("suggestion_changes", schema="ai")
    op.drop_table("suggestions", schema="ai")
    op.execute("DROP SCHEMA IF EXISTS ai")
