#!/usr/bin/env python3
import requests
import json

response = requests.post(
    "http://localhost:8000/api/query",
    json={"query": "What is the projected IRR for ACME Manufacturing?"},
    timeout=30
)

print(json.dumps(response.json(), indent=2))
