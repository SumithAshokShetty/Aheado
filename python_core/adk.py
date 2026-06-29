from typing import Dict, Any, Optional

class RoutingDecision:
    def __init__(self, target_agent: str, arguments: Dict[str, Any]):
        self.target_agent = target_agent
        self.arguments = arguments

class Agent:
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

class Supervisor:
    def __init__(self):
        pass
    def route(self, unstructured_input: str) -> RoutingDecision:
        raise NotImplementedError
    def run(self, input_text: str) -> Dict[str, Any]:
        raise NotImplementedError
