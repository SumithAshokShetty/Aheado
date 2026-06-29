from typing import List, Dict, Any
try:
    from pydantic import BaseModel, Field
except ImportError:
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        
        def model_dump(self) -> Dict[str, Any]:
            def dump_value(val):
                if isinstance(val, BaseModel):
                    return val.model_dump()
                elif isinstance(val, list):
                    return [dump_value(x) for x in val]
                elif isinstance(val, dict):
                    return {k: dump_value(v) for k, v in val.items()}
                return val
            return {k: dump_value(v) for k, v in self.__dict__.items()}
    
    def Field(*args, **kwargs):
        return None

class A2UIAction(BaseModel):
    """
    Executable client-side action definition.
    """
    label: str
    event_id: str
    action_type: str

class A2UIBlock(BaseModel):
    """
    Standardized A2UI component payload for HITL verification.
    """
    ui_component: str
    title: str
    severity: str
    actions: List[A2UIAction]

class MCPTool(BaseModel):
    """
    Model Context Protocol tool definition.
    """
    name: str
    description: str
    input_schema: Dict[str, Any]

# Registry of Enterprise MCP Integration Tools
MCP_REGISTRY: Dict[str, MCPTool] = {
    "gmail_mcp_server": MCPTool(
        name="gmail_mcp_server",
        description="Extract unstructured text streams and draft contextual emails.",
        input_schema={
            "type": "object",
            "properties": {
                "recipient": {"type": "string", "description": "Email recipient address."},
                "subject": {"type": "string", "description": "Subject line."},
                "body": {"type": "string", "description": "Email body content."}
            },
            "required": ["recipient", "subject", "body"]
        }
    ),
    "google_calendar_mcp_server": MCPTool(
        name="google_calendar_mcp_server",
        description="Identify event collision parameters and propose dynamic scheduling shifts.",
        input_schema={
            "type": "object",
            "properties": {
                "event_id": {"type": "string"},
                "proposed_start_time": {"type": "string"},
                "proposed_end_time": {"type": "string"}
            },
            "required": ["event_id", "proposed_start_time"]
        }
    ),
    "slack_webhook_mcp_server": MCPTool(
        name="slack_webhook_mcp_server",
        description="Handle real-time platform broadcast payloads for alerts and status changes.",
        input_schema={
            "type": "object",
            "properties": {
                "channel": {"type": "string"},
                "message": {"type": "string"},
                "priority": {"type": "string", "enum": ["low", "high", "critical"]}
            },
            "required": ["channel", "message"]
        }
    )
}

def generate_a2ui_payload(component: str, title: str, severity: str, actions: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Helper to generate a validated A2UI payload.
    """
    a2ui_actions = [A2UIAction(**action) for action in actions]
    block = A2UIBlock(
        ui_component=component,
        title=title,
        severity=severity,
        actions=a2ui_actions
    )
    return block.model_dump()
