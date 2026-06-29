from typing import Dict, Any, List, Optional, Callable
import functools

def jit_policy_check(policy_func: Callable):
    """
    JIT Policy Check decorator/interceptor wrapper that acts as an execution gate 
    before an action is permitted to process.
    """
    @functools.wraps(policy_func)
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Evaluate policy before executing the function
            policy_decision = policy_func(*args, **kwargs)
            if not policy_decision.get("authorized", True):
                return {
                    "status": "POLICY_BLOCKED",
                    "reason": policy_decision.get("reason", "Unauthorized by Governance Envelope"),
                    "requires_hitl": True
                }
            return func(*args, **kwargs)
        return wrapper
    return decorator

class AgentRoutingDecision:
    """
    Structured response mapping a user's natural language crisis stream
    to a specific skill or sub-agent, parsed with Gemini 2.5 Flash.
    """
    def __init__(self, selected_skill: str = "unknown", confidence_score: float = 0.0, justification: str = "No justification provided", arguments: Dict[str, Any] = {}):
        self.selected_skill = selected_skill
        self.confidence_score = confidence_score
        self.justification = justification
        self.arguments = arguments if isinstance(arguments, dict) else {}

class A2UIBlock:
    """
    Generative interface middleware fallback payload.
    Used for Human-In-The-Loop (HITL) alerts or structural rendering when a task requires manual confirmation.
    """
    def __init__(self, ui_component: str, title: str, severity: str, actions: List[Dict[str, str]] = None):
        self.ui_component = ui_component
        self.title = title
        self.severity = severity
        self.actions = actions or []

class CrisisNotification:
    """
    Telemetry and validation tracking representation for an active portal risk vectors stream,
    safeguarding token limits and spend caps under Agent Payments Protocol (AP2).
    """
    def __init__(self, task_id: str, vector: str, urgency_threshold: float, token_capped_limit: float = 5000.0, metadata: Dict[str, Any] = None):
        self.task_id = task_id
        self.vector = vector
        self.urgency_threshold = urgency_threshold
        self.token_capped_limit = token_capped_limit
        self.metadata = metadata or {}
