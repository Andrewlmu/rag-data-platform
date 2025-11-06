#!/usr/bin/env python3
"""
Upload test documents to the PE Analysis backend
"""
import requests
import os
from pathlib import Path

BASE_URL = "http://localhost:8000"
TEST_DATA_DIR = Path("test-data")

def upload_document(file_path):
    """Upload a single document to the backend"""
    url = f"{BASE_URL}/api/upload"

    print(f"\n📤 Uploading: {file_path.name}")

    with open(file_path, 'rb') as f:
        files = {'files': (file_path.name, f, 'text/plain')}

        try:
            response = requests.post(url, files=files, timeout=60)

            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Success: {result}")
                return True
            else:
                print(f"   ❌ Failed: HTTP {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return False

        except Exception as e:
            print(f"   ❌ Error: {e}")
            return False

def main():
    print("=" * 60)
    print("📁 PE Analysis - Test Document Upload")
    print("=" * 60)

    # Check if test data directory exists
    if not TEST_DATA_DIR.exists():
        print(f"\n❌ Error: {TEST_DATA_DIR} directory not found")
        return

    # Get all .txt files
    txt_files = list(TEST_DATA_DIR.glob("*.txt"))

    if not txt_files:
        print(f"\n❌ No .txt files found in {TEST_DATA_DIR}")
        return

    print(f"\n📋 Found {len(txt_files)} document(s) to upload\n")

    # Upload each document
    success_count = 0
    for file_path in txt_files:
        if upload_document(file_path):
            success_count += 1

    print("\n" + "=" * 60)
    print(f"✅ Upload complete: {success_count}/{len(txt_files)} successful")
    print("=" * 60)

if __name__ == "__main__":
    main()
