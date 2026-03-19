from dataclasses import dataclass


@dataclass
class Flag:
    symptom: str
    parameter: str
    suggested_delta: str
    confidence: float
    reasoning: str
