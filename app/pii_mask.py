"""Redacts Indian government ID numbers (Aadhaar, mobile, PAN, Voter ID)
out of user-supplied text before it's sent to a third-party AI provider
(Groq/DeepSeek), and restores the real values afterward.

The application text itself (what gets saved and shown to the user) still
carries the real numbers -- only the outbound LLM call never sees them.
Placeholders use the same square-bracket convention the generation prompt
already asks the model to use for missing details (e.g. "[আবেদনকারীর নাম]"),
so a masked value round-trips through the model as just another field
it's copying verbatim, not something it needs to understand or reformat.
"""

import re

# Ordered so a longer/more specific pattern is tried before a shorter one
# that could otherwise match a substring of it at the same position (e.g.
# an unspaced 12-digit Aadhaar number must never partially match as a
# 10-digit mobile number) -- Python's re tries alternatives left-to-right
# at each position and stops at the first that succeeds, so this ordering
# is what actually prevents that collision, not just documentation.
_PII_PATTERN = re.compile(
    r"(?P<aadhaar>(?<!\d)\d{4}[ -]?\d{4}[ -]?\d{4}(?!\d))"
    r"|(?P<mobile>(?<!\d)(?:\+91[ -]?|91[ -]?|0)?[6-9]\d{9}(?!\d))"
    r"|(?P<pan>\b[A-Za-z]{5}[0-9]{4}[A-Za-z]\b)"
    # Voter ID / EPIC: the standard format since the 1990s (3 letters + 7
    # digits, e.g. ABC1234567) -- covers the vast majority of real cards.
    r"|(?P<voter>\b[A-Za-z]{3}[0-9]{7}\b)"
    # Older slash-delimited EPIC format still seen on some cards, e.g.
    # "WB/37/264/096671" -- state code / assembly constituency / part
    # number / serial, each a variable-length run of digits by state.
    r"|(?P<voter_slash>\b[A-Za-z]{2}/\d{1,3}/\d{1,4}/\d{3,7}\b)"
)

_LABELS = {
    "aadhaar": "AADHAAR",
    "mobile": "MOBILE",
    "pan": "PAN",
    "voter": "VOTER_ID",
    "voter_slash": "VOTER_ID",
}


def mask_pii(text: str) -> tuple[str, dict[str, str]]:
    """Replaces each detected ID number with a `[LABEL_n]` placeholder
    (numbered left-to-right per label). Returns the masked text and a
    placeholder -> original-value mapping to reverse it with unmask_pii()."""
    mapping: dict[str, str] = {}
    counts: dict[str, int] = {}

    def replace(m: re.Match) -> str:
        label = _LABELS[m.lastgroup]
        counts[label] = counts.get(label, 0) + 1
        placeholder = f"[{label}_{counts[label]}]"
        mapping[placeholder] = m.group()
        return placeholder

    masked = _PII_PATTERN.sub(replace, text)
    return masked, mapping


def unmask_pii(text: str, mapping: dict[str, str]) -> str:
    """Reverses mask_pii(): swaps each placeholder back to its real value.
    Longest placeholders first so e.g. "[MOBILE_10]" doesn't get partially
    clobbered by a naive replace of "[MOBILE_1]" first."""
    for placeholder in sorted(mapping, key=len, reverse=True):
        text = text.replace(placeholder, mapping[placeholder])
    return text
