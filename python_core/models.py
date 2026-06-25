from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class AgentRoutingDecision(BaseModel):
    """
    Structured response mapping a user's natural language crisis stream
    to a specific skill or sub-agent, parsed with Gemini 2.5 Flash.
    """
    selected_skill: str = Field(
        ..., 
        description="The identifier of the routed skill/sub-agent, e.g., 'deadline_negotiator', 'bill_autopilot', or 'generic_fallback'."
    )
    confidence_score: float = Field(
        ..., 
        description="Confidence score between 0.0 and 1.0 indicating routing certainty.",
        ge=0.0,
        le=1.0
    )
    justification: str = Field(
        ..., 
        description="Detailed tactical explanation for routing to this sub-agent or skill."
    )
    arguments: Dict[str, Any] = Field(
        default_factory=dict, 
        description="Extracted parameters and key-value arguments required by the target skill."
    )


class A2UIBlock(BaseModel):
    """
    Generative interface middleware fallback payload.
    Used for Human-In-The-Loop (HITL) alerts or structural rendering when a task requires manual confirmation.
    """
    ui_component: str = Field(
        ..., 
        description="The type of client-side component to render, e.g., 'CrisisAlertCard', 'DecisionGate', or 'TokenGateModal'."
    )
    title: str = Field(
        ..., 
        description="Visual title header of the rendered notification block."
    )
    severity: str = Field(
        ..., 
        description="Severity tier: 'CRITICAL', 'HIGH', 'MEDIUM', or 'INFO'."
    )
    actions: List[Dict[str, str]] = Field(
        default_factory=list,
        description="List of available actions. Each action dictionary must contain 'label' and 'event_id' keys."
    )


class CrisisNotification(BaseModel):
    """
    Telemetry and validation tracking representation for an active portal risk vectors stream,
    safeguarding token limits and spend caps under Agent Payments Protocol (AP2).
    """
    task_id: str = Field(..., description="Unique hash representing the source event or task trigger.")
    vector: str = Field(..., description="Risk vector category, e.g., 'deadline_overrun', 'overdraft_risk', 'calendar_clash'.")
    urgency_threshold: float = Field(..., description="Normalized urgency metric calculation from 0.0 to 1.0.")
    token_capped_limit: float = Field(
        default=50.0, 
        description="Cryptographic agent spending limit gate for AP2. Transactions exceeding this block require HITL approval."
    )
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context, tags, or headers harvested.")
