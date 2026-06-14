"""Static reference data: the Hugging Face model registry, MITRE ATT&CK catalog,
and trap-type → technique/actor hints.

Everything model-related is config-driven so the service can load any subset of
the models (or none, falling back to heuristics) without code changes.
"""

from __future__ import annotations

# --- Hugging Face models we integrate (all of them). -------------------------
# `task` drives how model_registry loads + queries each repo.
#   sequence-classification  -> AutoModelForSequenceClassification
#   sentence-embedding       -> sentence_transformers.SentenceTransformer
#   fill-mask                -> AutoModel (used as a feature extractor)
MODELS: dict[str, dict] = {
    "payload": {
        "repo": "redauzhang/common-injection-payload-classfication",
        "task": "sequence-classification",
        "role": "payload_attack_classifier",
        "desc": "CodeBERT — SQLi / XSS / traversal / command-injection payloads.",
    },
    "payload_sqli_xss": {
        "repo": "Dr-KeK/sqli-xss-models",
        "task": "sequence-classification",
        "role": "sqli_xss_classifier",
        # This repo ships several artefacts; the transformers fine-tune lives in
        # the `transformers/` subfolder. Loading is best-effort.
        "subfolder": "transformers",
        "desc": "DistilBERT/BERT ensemble specialised on SQLi + XSS (~99% acc).",
    },
    "log": {
        "repo": "Shoriful025/cyber_threat_log_classifier",
        "task": "sequence-classification",
        "role": "http_log_classifier",
        "desc": "RoBERTa — 5-class HTTP/audit-log threat classifier.",
    },
    "mitre_tactic": {
        "repo": "sarahwei/MITRE-v15-tactic-bert-case-based",
        "task": "sequence-classification",
        "role": "mitre_tactic_classifier",
        "desc": "BERT — MITRE ATT&CK v15 tactic classification.",
    },
    "attack_bert": {
        "repo": "basel/ATTACK-BERT",
        "task": "sentence-embedding",
        "role": "technique_embedder",
        "desc": "Sentence-Transformer — maps attack actions to ATT&CK technique space.",
    },
    "secbert": {
        "repo": "jackaduma/SecBERT",
        "task": "fill-mask",
        "role": "style_embedder",
        "desc": "SecBERT — security-domain encoder used as an attacker-style embedder.",
    },
    "cyber_groups": {
        "repo": "selfconstruct3d/mpnet-classification-finetuned-cyber-groups",
        "task": "sequence-classification",
        "role": "threat_actor_classifier",
        "desc": "MPNet — threat-actor / APT group attribution from CTI text.",
    },
}

# --- Minimal MITRE ATT&CK technique catalog used by ATT&CK-BERT similarity. ---
# Each technique carries a natural-language description we embed once at startup.
MITRE_TECHNIQUES: list[dict] = [
    {"id": "T1190", "name": "Exploit Public-Facing Application",
     "tactic": "Initial Access",
     "desc": "Attacker exploits a vulnerability in an internet-facing application such as SQL injection or remote code execution."},
    {"id": "T1059", "name": "Command and Scripting Interpreter",
     "tactic": "Execution",
     "desc": "Attacker abuses command and script interpreters to execute commands, including OS command injection."},
    {"id": "T1083", "name": "File and Directory Discovery",
     "tactic": "Discovery",
     "desc": "Attacker enumerates files and directories, including path traversal to read sensitive files like /etc/passwd."},
    {"id": "T1595", "name": "Active Scanning",
     "tactic": "Reconnaissance",
     "desc": "Attacker actively scans the target using vulnerability scanners and crawlers to find weaknesses."},
    {"id": "T1110", "name": "Brute Force",
     "tactic": "Credential Access",
     "desc": "Attacker repeatedly guesses usernames and passwords to gain access to accounts."},
    {"id": "T1552", "name": "Unsecured Credentials",
     "tactic": "Credential Access",
     "desc": "Attacker searches for and uses exposed credentials, API keys, or tokens left in the environment."},
    {"id": "T1213", "name": "Data from Information Repositories",
     "tactic": "Collection",
     "desc": "Attacker collects sensitive data such as database dumps or large archive exports from repositories."},
    {"id": "T1567", "name": "Exfiltration Over Web Service",
     "tactic": "Exfiltration",
     "desc": "Attacker exfiltrates large amounts of data over the network, for example downloading a full backup archive."},
    {"id": "T1090", "name": "Server-Side Request Forgery",
     "tactic": "Discovery",
     "desc": "Attacker abuses a server to make requests to internal services or cloud metadata endpoints."},
    {"id": "T1059.007", "name": "JavaScript Injection",
     "tactic": "Execution",
     "desc": "Attacker injects malicious JavaScript such as cross-site scripting payloads to run code in a victim browser."},
]

# --- Trap → most likely ATT&CK technique / tactic (heuristic backbone). -------
TRAP_TO_TECHNIQUE: dict[str, str] = {
    "SQL_INJECTION": "T1190",
    "SQLI": "T1190",
    "XSS": "T1059.007",
    "XSS_PROBE": "T1059.007",
    "RECON": "T1595",
    "SCANNER": "T1595",
    "BRUTE_FORCE": "T1110",
    "HONEY_TOKEN": "T1552",
    "DATA_BOMB": "T1567",
    "PATH_TRAVERSAL": "T1083",
    "SSRF": "T1090",
}

# Severity weight per trap — feeds the heuristic risk score / fallback severity.
TRAP_SEVERITY: dict[str, int] = {
    "SQL_INJECTION": 80, "SQLI": 80,
    "BRUTE_FORCE": 60,
    "HONEY_TOKEN": 85,
    "DATA_BOMB": 70,
    "PATH_TRAVERSAL": 65,
    "XSS": 55, "XSS_PROBE": 55,
    "SSRF": 75,
    "RECON": 40,
    "SCANNER": 45,
}

# Known APT-style groups the cyber-groups model may emit; used to normalise/label.
KNOWN_ACTOR_GROUPS = [
    "APT28", "APT29", "Lazarus Group", "Silver Fox", "FIN7",
    "OilRig", "Sandworm", "Kimsuky", "Cobalt Group", "Unknown",
]
