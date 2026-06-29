import os
import sys
import json
import urllib.request
import urllib.error
import time
from typing import Dict, Any, Optional
import traceback
from utils.api_retry import call_api_with_retry

print(f"DEBUG: Python version: {sys.version}", file=sys.stderr)
print(f"DEBUG: sys.path: {sys.path}", file=sys.stderr)

# Ensure project root is in sys.path so python_core can be imported as a module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Google ADK Primitives
from python_core.adk import Agent, Supervisor, RoutingDecision

# Existing Domain Models
from python_core.models import AgentRoutingDecision
from python_core.skills.deadline_negotiator.negotiator import DeadlineNegotiatorSkill
from python_core.skills.bill_autopilot.autopilot import BillAutopilotSkill

class AheadoMasterCoordinator(Supervisor):
    """
    Master Coordinator Agent acting as the root supervisor for Aheado Systems.
    Handles predictive routing, context handoff, and decision propagation.
    """
    def __init__(self):
        super().__init__()
        self.api_keys = os.environ.get("GEMINI_API_KEYS", "").split(",")
        if not self.api_keys or not self.api_keys[0]:
            sys.stderr.write("CRITICAL: GEMINI_API_KEYS not set in environment\n")
        else:
            sys.stderr.write(f"DEBUG: {len(self.api_keys)} GEMINI_API_KEYS found (first key prefix: {self.api_keys[0][:4]}...)\n")
        self.deadline_agent = DeadlineNegotiatorSkill(self.api_keys)
        self.bill_agent = BillAutopilotSkill()

    def route(self, unstructured_input: str) -> RoutingDecision:
        """
        Analyzes input and predicts the optimal path to a specialized agent.
        """
        try:
            # Fallback to pure urllib to avoid dependency issues in the container sandbox
            url_template = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={key}"
            
            prompt = f"""
            Analyze the following crisis scenario and route it to the appropriate skill:
            Scenario: {unstructured_input}
            
            Available skills:
            - "deadline_negotiator": For managing deadlines, overlaps, and extension requests.
            - "bill_autopilot": For managing payments, invoices, and financial thresholds.
            
            Respond with strict raw JSON matching the required parameters:
            {{
                "selected_skill": "string (one of the available skills)",
                "confidence_score": "float",
                "justification": "string",
                "arguments": {{}}
            }}
            """
            data = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            
            headers = {"Content-Type": "application/json"}
            result = call_api_with_retry(url_template, data, headers, self.api_keys)
            
            raw_text = result["candidates"][0]["content"]["parts"][0]["text"]
            parsed_json = json.loads(raw_text)
            
            # Filter for AgentRoutingDecision arguments
            valid_keys = {"selected_skill", "confidence_score", "justification", "arguments"}
            if isinstance(parsed_json, dict):
                filtered_json = {k: v for k, v in parsed_json.items() if k in valid_keys}
            elif isinstance(parsed_json, list) and len(parsed_json) > 0 and isinstance(parsed_json[0], dict):
                filtered_json = {k: v for k, v in parsed_json[0].items() if k in valid_keys}
            else:
                filtered_json = {}
                
            decision_data = AgentRoutingDecision(**filtered_json)
            sys.stderr.write(f"DEBUG: decision_data.selected_skill: {decision_data.selected_skill}\n")
            
            return RoutingDecision(
                target_agent=decision_data.selected_skill,
                arguments=decision_data.arguments
            )
        except Exception as route_err:
            sys.stderr.write(f"WARNING: Routing failed due to: {route_err}. Defaulting to deadline_negotiator.\n")
            # Resilient fallback routing decision
            return RoutingDecision(
                target_agent="deadline_negotiator",
                arguments={}
            )

    def run(self, input_text: str) -> Dict[str, Any]:
        """
        Orchestrates the agentic DAG execution.
        """
        decision = self.route(input_text)
        print(f"DEBUG: Decision target agent: {decision.target_agent}", file=sys.stderr)
        
        arguments = decision.arguments or {}
        arguments["scenario"] = input_text
        
        user_profile_env = os.environ.get("AHEADO_USER_PROFILE")
        if user_profile_env:
            try:
                arguments["userProfile"] = json.loads(user_profile_env)
            except Exception:
                pass
        
        if decision.target_agent.strip().lower() == "deadline_negotiator":
            return self.deadline_agent.execute(arguments)
        elif decision.target_agent.strip().lower() == "bill_autopilot":
            return self.bill_agent.execute(arguments)
        
        return {"status": "PASSIVE_MONITORING"}

# Runtime Orchestration Entry Point
if __name__ == "__main__":
    try:
        coordinator = AheadoMasterCoordinator()
        
        # CLI hook for bridge interaction from Express
        input_data = os.environ.get("AHEADO_CRISIS_INPUT")
        if input_data:
            result = coordinator.run(input_data)
            # Add summary field for frontend rendering
            if "summary" in result:
                pass
            elif "message" in result:
                result["summary"] = result["message"]
            elif "email_draft" in result:
                result["summary"] = "A draft extension email has been prepared for your review."
            else:
                result["summary"] = "Action staged for review."
            print(json.dumps(result))
    except Exception as e:
        print(f"DEBUG: Critical error in orchestrator.py: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"status": "ORCHESTRATION_ERROR", "error": str(e)}))
