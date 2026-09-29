"""Growth Brain integration guard; not an upstream OpenCLI feature.

A zero process exit does not prove browser connectivity or successful inference.
Pinned diagnostic marker parsing is supplemented by an actual operation gate.
"""
from dataclasses import dataclass
from enum import Enum
import re

class State(str, Enum):
    UNAVAILABLE = 'unavailable'
    UNVERIFIED = 'unverified'
    READY = 'ready'

@dataclass(frozen=True)
class Readiness:
    state: State
    reason: str

def assess(returncode: int, diagnostic: str, *, browser_operation_verified: bool = False) -> Readiness:
    if returncode != 0:
        return Readiness(State.UNAVAILABLE, 'diagnostic_process_failed')
    if re.search(r'(?im)^\s*\[(?:FAIL|MISSING|ERROR)\]', diagnostic):
        return Readiness(State.UNAVAILABLE, 'diagnostic_reports_missing_dependency')
    if not browser_operation_verified:
        return Readiness(State.UNVERIFIED, 'no_successful_browser_operation_evidence')
    if not diagnostic.strip():
        return Readiness(State.UNVERIFIED, 'empty_diagnostic')
    return Readiness(State.READY, 'browser_operation_and_diagnostic_verified')
