import uuid
from typing import Dict, Any

class DeadlineNegotiatorSkill:
    """
    Automates drafting of professional extension requests under strict Zero Ambient Authority constraints.
    Returns structured payloads intended for Human-In-The-Loop review.
    """

    @staticmethod
    def execute(arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes deadline arguments to generate a secure, structured draft request.
        
        Args:
            arguments (dict): Expected fields:
                - task_name (str): The assignment or deliverable name.
                - hours_left (float): Remaining time in hours.
                - professor_or_client (str): Name of recipient.
                - reason_hint (str, optional): User-provided reason for request.
                
        Returns:
            dict: Interactive verification payload representing the generated draft and HITL event hooks.
        """
        task_name = arguments.get("task_name", "the scheduled deliverable")
        hours_left = arguments.get("hours_left", 12.0)
        recipient = arguments.get("professor_or_client", "Professor / Manager")
        reason_hint = arguments.get("reason_hint", "complex engineering implementation hurdles and unexpected integration bottlenecks")

        # Draft generation using clean professional guidelines
        draft_body = (
            f"Dear {recipient},\n\n"
            f"I am writing to respectfully request a brief extension for '{task_name}', "
            f"which is currently scheduled to be submitted in approximately {hours_left} hours.\n\n"
            f"Due to {reason_hint}, I want to ensure the final submission is of high professional standard. "
            f"Would it be possible to submit this by tomorrow evening, or over the weekend?\n\n"
            f"Thank you very much for your time, understanding, and consideration.\n\n"
            f"Sincerely,\n"
            f"[Your Name] (via Aheado Proactive Agent)"
        )

        event_id = f"evt_negotiator_approve_{uuid.uuid4().hex[:8]}"

        # Return structured output with HITL actions
        return {
            "status": "DRAFT_STAGED",
            "message": "Polite extension request generated successfully.",
            "requires_hitl": True,
            "verification_card": {
                "ui_component": "DraftApprovalCard",
                "title": f"🛡️ Draft: Extension Request for '{task_name}'",
                "severity": "CRITICAL" if hours_left < 12 else "HIGH",
                "recipient": recipient,
                "draft_text": draft_body,
                "actions": [
                    {"label": "Approve and Pre-stage Send", "event_id": event_id, "action_type": "APPROVE"},
                    {"label": "Edit Draft Manually", "event_id": f"evt_edit_{event_id}", "action_type": "EDIT"},
                    {"label": "Dismiss Threat Intercept", "event_id": f"evt_dismiss_{event_id}", "action_type": "DISMISS"}
                ]
            }
        }
