"""Decision tree mapping rider complaints/feedback to suspension adjustments.

Keyword-matches common rider complaints against known suspension symptoms
and produces a list of recommended parameter changes with confidence scores.
"""

from __future__ import annotations

import re

from .flag import Flag

# Each pattern: (compiled regex, list of (symptom, parameter, suggested_delta, reasoning))
# Patterns are checked in order; a single complaint can match multiple entries.
_COMPLAINT_PATTERNS: list[tuple[re.Pattern[str], list[tuple[str, str, str, str]]]] = [
    # ── Front-end push / wash ──
    (
        re.compile(r"front\s*(end)?\s*(push|wash|slide|plow|under\s*steer)", re.I),
        [
            (
                "front end push/wash",
                "front.compression",
                "+1–2 clicks (stiffer)",
                "Front pushing usually means the fork is diving too deep under braking, "
                "overloading the front tire contact patch at mid-corner entry.",
            ),
            (
                "front end push/wash",
                "front.preload",
                "-1–2 mm preload (less sag)",
                "Reducing front sag raises the front and shifts weight rearward, "
                "reducing the tendency for the front to push wide.",
            ),
        ],
    ),
    # ── Rear kick / hop ──
    (
        re.compile(r"rear\s*(end)?\s*(kick|hop|skip|buck|step|step\s*out)", re.I),
        [
            (
                "rear kick/hop",
                "rear.rebound",
                "+1–2 clicks (slower rebound)",
                "The rear unloads too quickly over bumps, causing the tire to skip. "
                "Slowing rebound keeps the tire in contact with the track surface.",
            ),
        ],
    ),
    # ── Headshake ──
    (
        re.compile(r"head\s*shake|head\s*wobble", re.I),
        [
            (
                "headshake",
                "front.rebound",
                "+1–2 clicks (slower rebound)",
                "Headshake is often caused by the fork extending too fast, "
                "unsettling the front end on corner exit or over crests.",
            ),
            (
                "headshake",
                "steering_damper",
                "increase steering damper if fitted",
                "A steering damper directly damps headshake oscillations.",
            ),
        ],
    ),
    # ── Tank slapper ──
    (
        re.compile(r"tank\s*slap|death\s*wobble|violent\s*headshake", re.I),
        [
            (
                "tank slapper",
                "front.ride_height",
                "lower front by 2–3 mm",
                "Increasing trail by lowering the front stabilizes the steering. "
                "Tank slappers indicate insufficient trail for the speed.",
            ),
            (
                "tank slapper",
                "rear.ride_height",
                "raise rear by 2–3 mm",
                "Raising the rear also increases trail by steepening the head angle.",
            ),
        ],
    ),
    # ── Won't turn / heavy steering ──
    (
        re.compile(r"won'?t\s*turn|hard\s*to\s*turn|heavy\s*steer|slow\s*turn|reluctant|lazy", re.I),
        [
            (
                "won't turn in",
                "front.preload",
                "-1–2 mm preload (more sag)",
                "More front sag drops the front end, steepening the head angle "
                "and quickening turn-in.",
            ),
            (
                "won't turn in",
                "rear.ride_height",
                "-1–2 mm ride height",
                "Lowering the rear raises the front relative to the rear, "
                "steepening the head angle for quicker steering.",
            ),
        ],
    ),
    # ── Bottoming out ──
    (
        re.compile(r"bottom(ing)?\s*(out)?|using\s*all\s*(the\s*)?travel|harsh\s*on\s*bumps?\s*bottom", re.I),
        [
            (
                "bottoming out",
                "front.preload",
                "+2–3 mm preload",
                "More preload raises the bike in its travel, giving more "
                "room before bottoming.",
            ),
            (
                "bottoming out",
                "front.compression",
                "+2–3 clicks (stiffer)",
                "Stiffer compression resists dive and reduces bottoming.",
            ),
            (
                "bottoming out",
                "front.spring_rate",
                "consider stiffer spring",
                "If bottoming persists after preload and compression adjustments, "
                "the spring rate may be too low for the rider's weight/pace.",
            ),
        ],
    ),
    # ── Harsh / stiff ride ──
    (
        re.compile(r"harsh|stiff|rigid|hard\s*ride|uncomfortable|jarring|teeth\s*rattl", re.I),
        [
            (
                "harsh/stiff ride",
                "front.compression",
                "-1–2 clicks (softer)",
                "Excessive compression damping prevents the fork from absorbing "
                "small bumps, making the ride harsh.",
            ),
            (
                "harsh/stiff ride",
                "rear.compression",
                "-1–2 clicks (softer)",
                "Same principle applied to the rear — softer compression "
                "improves bump absorption.",
            ),
        ],
    ),
    # ── Wallowing / soft ──
    (
        re.compile(r"wallow|soft|mushy|vague|floaty|spong", re.I),
        [
            (
                "wallowing/vague feel",
                "front.compression",
                "+1–2 clicks (stiffer)",
                "Insufficient compression damping lets the fork move too freely, "
                "causing a vague feeling at the front.",
            ),
            (
                "wallowing/vague feel",
                "rear.compression",
                "+1–2 clicks (stiffer)",
                "Firming up the rear compression adds mid-corner support.",
            ),
        ],
    ),
    # ── Front diving under braking ──
    (
        re.compile(r"div(e|ing)\s*(under\s*)?brak|nose\s*dive|brake\s*dive|fork\s*dive", re.I),
        [
            (
                "excessive brake dive",
                "front.compression",
                "+2–3 clicks (stiffer)",
                "More compression damping resists fork dive under heavy braking.",
            ),
            (
                "excessive brake dive",
                "front.preload",
                "+1–2 mm preload",
                "More preload raises the static ride height, giving the fork "
                "more travel before reaching its softest zone.",
            ),
        ],
    ),
    # ── Rear squatting on acceleration ──
    (
        re.compile(r"squat|rear\s*(sag|compress|sit)\s*(on|under)?\s*(accel|throttle|power|drive)", re.I),
        [
            (
                "rear squat under acceleration",
                "rear.compression",
                "+1–2 clicks (stiffer)",
                "More rear compression resists squat under hard acceleration.",
            ),
        ],
    ),
    # ── Mid-corner instability ──
    (
        re.compile(r"mid[- ]?corner\s*(un\s*stable|weave|wobble|pump|move)", re.I),
        [
            (
                "mid-corner instability",
                "rear.rebound",
                "+1 click (slower rebound)",
                "The rear unsettling mid-corner is often caused by rebound "
                "that is too fast, causing the bike to pitch.",
            ),
            (
                "mid-corner instability",
                "rear.compression",
                "+1 click (stiffer)",
                "More rear compression adds stability through the corner.",
            ),
        ],
    ),
    # ── Chattering ──
    (
        re.compile(r"chatter|vibrat(e|ion)|judder", re.I),
        [
            (
                "chattering",
                "front.rebound",
                "-1–2 clicks (faster rebound)",
                "Chatter often occurs when the fork can't extend fast enough "
                "between bumps, causing repeated impacts.",
            ),
            (
                "chattering",
                "front.compression",
                "-1 click (softer)",
                "Slightly softer compression lets the fork absorb surface "
                "irregularities that cause chatter.",
            ),
        ],
    ),
    # ── Poor traction / rear grip ──
    (
        re.compile(r"(no|poor|lack|losing)\s*(rear\s*)?(traction|grip)|rear\s*spin|wheel\s*spin|slide\s*out", re.I),
        [
            (
                "poor rear traction",
                "rear.rebound",
                "+1–2 clicks (slower rebound)",
                "Rebound that is too fast lifts the tire off the surface, "
                "reducing traction on corner exit.",
            ),
            (
                "poor rear traction",
                "rear.preload",
                "-1 mm preload (more sag)",
                "More rear sag pushes the tire harder into the track, "
                "improving mechanical grip.",
            ),
        ],
    ),
    # ── High-speed instability / weave ──
    (
        re.compile(r"(high\s*speed|fast|straight)\s*(weave|wobble|un\s*stable|instab)", re.I),
        [
            (
                "high-speed instability",
                "rear.rebound",
                "+1–2 clicks (slower rebound)",
                "At high speed the rear needs to recover more slowly to "
                "avoid pitch oscillations.",
            ),
            (
                "high-speed instability",
                "front.rebound",
                "+1 click (slower rebound)",
                "Slower front rebound adds high-speed stability.",
            ),
        ],
    ),
    # ── Corner exit wheelie / front lifting ──
    (
        re.compile(r"wheel(ie|y)|front\s*(lift|light|come|comes)\s*(up|off)?", re.I),
        [
            (
                "corner-exit wheelie",
                "rear.ride_height",
                "-1–2 mm ride height",
                "Lowering the rear shifts weight forward, reducing the tendency "
                "to wheelie on corner exit.",
            ),
        ],
    ),
    # ── Front tucks / low-side feel ──
    (
        re.compile(r"front\s*tuck|low\s*side\s*feel|front\s*fold|front\s*give", re.I),
        [
            (
                "front tuck risk",
                "front.compression",
                "+1–2 clicks (stiffer)",
                "A front that tucks is often overloaded — stiffer compression "
                "keeps the fork higher in its travel at lean angle.",
            ),
            (
                "front tuck risk",
                "front.preload",
                "+1 mm preload",
                "Raising the front reduces weight transfer to the front tire "
                "at maximum lean.",
            ),
        ],
    ),
    # ── Pumping / packing ──
    (
        re.compile(r"pump(ing)?|pack(ing)?|not\s*recover|won'?t\s*extend", re.I),
        [
            (
                "suspension packing",
                "front.rebound",
                "-1–2 clicks (faster rebound)",
                "Packing means the fork compresses but doesn't fully extend "
                "before the next bump. Faster rebound fixes this.",
            ),
            (
                "suspension packing",
                "rear.rebound",
                "-1–2 clicks (faster rebound)",
                "Same issue on the rear — rebound is too slow for the bump "
                "frequency at this section of the track.",
            ),
        ],
    ),
    # ── Slow direction changes / transitions ──
    (
        re.compile(r"slow\s*(direction|transition|chicane|change)|hard\s*to\s*flick", re.I),
        [
            (
                "slow transitions",
                "front.preload",
                "-1 mm preload",
                "Less front preload lowers the front, quickening transitions.",
            ),
            (
                "slow transitions",
                "rear.ride_height",
                "+1 mm ride height",
                "Raising the rear slightly steepens the head angle, "
                "making direction changes quicker.",
            ),
        ],
    ),
    # ── Rear too high / runs wide on exit ──
    (
        re.compile(r"rear\s*(too\s*)?high|run(s|ning)?\s*wide\s*(on\s*)?(exit|drive)", re.I),
        [
            (
                "runs wide on exit",
                "rear.ride_height",
                "-1–2 mm ride height",
                "The rear being too high tilts weight forward and causes "
                "the bike to stand up on exit, running wide.",
            ),
        ],
    ),
    # ── Entry oversteer / rear loose on entry ──
    (
        re.compile(r"(entry|turn[- ]?in)\s*(over\s*steer|loose|rear\s*slide|rear\s*step)", re.I),
        [
            (
                "entry oversteer",
                "rear.compression",
                "-1 click (softer)",
                "The rear is too stiff on entry, causing load transfer to "
                "unweight the rear tire as the bike pitches forward.",
            ),
            (
                "entry oversteer",
                "rear.preload",
                "+1 mm preload (less sag)",
                "Less rear sag raises the rear, adding weight to the rear tire "
                "during corner entry.",
            ),
        ],
    ),
    # ── Exit oversteer / rear loose on exit ──
    (
        re.compile(r"(exit|drive|accel)\s*(over\s*steer|loose|rear\s*slide|rear\s*step)", re.I),
        [
            (
                "exit oversteer",
                "rear.rebound",
                "+1–2 clicks (slower rebound)",
                "The rear extends too quickly on exit, unsettling the tire "
                "as drive force is applied.",
            ),
        ],
    ),
]

# Exact keyword matches get highest confidence; broader matches get lower.
_EXACT_CONFIDENCE = 0.9
_FUZZY_CONFIDENCE = 0.5


def analyse_feedback(
    rider_feedback: str,
    suspension_spec: dict,
    change_log: list[dict],
) -> list[Flag]:
    """Analyse rider feedback text and return suspension adjustment flags.

    Args:
        rider_feedback: Free-text rider feedback/complaints.
        suspension_spec: Current suspension spec (SuspensionSpec schema v1).
        change_log: List of changes already made this session. Each entry
            should have at minimum a ``parameter`` key.

    Returns:
        List of Flag objects sorted by confidence descending.
    """
    if not rider_feedback or not rider_feedback.strip():
        return []

    # Build set of parameters already changed this session.
    already_changed: set[str] = set()
    for entry in change_log:
        param = entry.get("parameter")
        if param:
            already_changed.add(param)

    feedback_lower = rider_feedback.lower()
    flags: list[Flag] = []

    for pattern, recommendations in _COMPLAINT_PATTERNS:
        match = pattern.search(rider_feedback)
        if not match:
            continue

        # Determine confidence: exact (short, specific match) vs fuzzy.
        matched_text = match.group(0)
        confidence = (
            _EXACT_CONFIDENCE if len(matched_text.split()) >= 2 else _FUZZY_CONFIDENCE
        )

        for symptom, parameter, suggested_delta, reasoning in recommendations:
            # Skip if this parameter was already adjusted this session.
            if parameter in already_changed:
                continue

            # If suspension_spec is missing the relevant end, lower confidence.
            end = parameter.split(".")[0] if "." in parameter else None
            if end and end in ("front", "rear"):
                end_spec = suspension_spec.get(end)
                if not end_spec:
                    confidence = min(confidence, _FUZZY_CONFIDENCE)

            flags.append(
                Flag(
                    symptom=symptom,
                    parameter=parameter,
                    suggested_delta=suggested_delta,
                    confidence=confidence,
                    reasoning=reasoning,
                )
            )

    return sorted(flags, key=lambda f: f.confidence, reverse=True)
