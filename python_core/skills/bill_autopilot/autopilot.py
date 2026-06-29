import hmac
import hashlib
import uuid
from typing import Dict, Any

class BillAutopilotSkill:
    """
    Automates parsing and staging of deferred bill payments under standard
    Agent Payments Protocol (AP2) guidelines, enforcing strict token-capped safety gates.
    """

    DEFAULT_SPEND_CAP = 5000.0  # AP2 Threshold in Rupees

    @classmethod
    def generate_cryptographic_token(cls, event_id: str, amount: float) -> str:
        """
        Simulates AP2 cryptographic token generation for secure event confirmation.
        """
        secret_key = b"aheado_ap2_security_key_signature"
        payload = f"{event_id}:{amount}".encode("utf-8")
        return hmac.new(secret_key, payload, hashlib.sha256).hexdigest()[:16]

    @classmethod
    def execute(cls, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates bill invoice details and computes optimal settlement routes.
        Blocks and prompts HITL confirmation if spend bounds are exceeded (AP2 Protocol).
        
        Args:
            arguments (dict): Expected fields:
                - bill_title (str): Name of bill provider.
                - amount (float): Total bill amount in Rupees.
                - due_date (str): Due date of the statement.
                
        Returns:
            dict: Payment schedule proposals, safety status, and transaction tokens.
        """
        bill_title = arguments.get("bill_title", "Subscription Provider")
        amount = float(arguments.get("amount", 0.0))
        due_date = arguments.get("due_date", "Soon")
        spend_cap = cls.DEFAULT_SPEND_CAP

        event_id = f"evt_bill_settle_{uuid.uuid4().hex[:8]}"
        ap2_token = cls.generate_cryptographic_token(event_id, amount)

        # Enforce AP2 Guard Gate
        if amount > spend_cap:
            return {
                "status": "AP2_BLOCKED",
                "message": f"Transaction amount of ₹{amount:.2f} exceeds your standard AP2 Token Gate safety threshold of ₹{spend_cap:.2f}.",
                "requires_hitl": True,
                "verification_card": {
                    "ui_component": "TokenGateModal",
                    "title": f"💳 AP2 Limit Warning: Blocked payment to '{bill_title}'",
                    "severity": "CRITICAL",
                    "bill_title": bill_title,
                    "amount": amount,
                    "ap2_token": ap2_token,
                    "warning_message": (
                        f"The requested charge of ₹{amount:.2f} violates the standard Aheado automated spending safety boundary. "
                        "We have temporarily staged a split-payment deferral route but require manual cryptographic confirmation to authorize."
                    ),
                    "actions": [
                        {
                            "label": f"Authorize & Sign AP2 Token ({ap2_token})", 
                            "event_id": f"hitl_approve_{event_id}",
                            "action_type": "APPROVE"
                        },
                        {
                            "label": "Stagger Charge (Split 50/50)", 
                            "event_id": f"hitl_stagger_{event_id}",
                            "action_type": "STAGGER"
                        },
                        {
                            "label": "Cancel Payment Stream", 
                            "event_id": f"hitl_cancel_{event_id}",
                            "action_type": "CANCEL"
                        }
                    ]
                }
            }

        # Otherwise, safe standard automatic route pre-staging
        return {
            "status": "AUTO_PRESTAGED",
            "message": f"Payment of ₹{amount:.2f} to {bill_title} is within your safety threshold. Auto-route staged.",
            "requires_hitl": False,
            "ap2_token": ap2_token,
            "payment_proposal": {
                "bill_title": bill_title,
                "amount": amount,
                "optimal_route": "Deferred split sequence: Pay 100% on the day before late-fee penalty triggers.",
                "scheduled_date": due_date,
                "savings_estimate": "Bypassed standard ₹150.00 late-fee penalty."
            }
        }
