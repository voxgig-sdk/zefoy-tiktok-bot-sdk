# Typed models for the ZefoyTiktokBot SDK.
#
# GENERATED from the API model: main.kit.entity.<e>.fields[] and per-op
# params (op.<name>.points[].args.params[]). Field/param types come from the
# canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
# @voxgig/apidef VALID_CANON). Do not edit by hand.

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Any


@dataclass
class Engagement:
    url: str
    amount: Optional[int] = None
    estimated_time: Optional[int] = None
    message: Optional[str] = None
    status: Optional[str] = None
    success: Optional[bool] = None
    type: Optional[str] = None


@dataclass
class EngagementCreateData:
    amount: Optional[int] = None
    estimated_time: Optional[int] = None
    message: Optional[str] = None
    status: Optional[str] = None
    success: Optional[bool] = None
    type: Optional[str] = None
    url: Optional[str] = None

