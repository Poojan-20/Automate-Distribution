#!/usr/bin/env python
"""
This script helps install SSL certificates for Python
Run this with: python install_cert.py
"""

import os
import ssl
import sys
import certifi
import subprocess
import platform

def main():
    print("SSL Certificate Installation Helper\n")
    print(f"Python version: {sys.version}")
    print(f"Platform: {platform.platform()}")
    print(f"Current certifi path: {certifi.where()}\n")
    
    # Check if we can connect to Slack
    import requests
    
    try:
        print("Testing connection to Slack without certificate verification...")
        response = requests.get("https://hooks.slack.com", verify=False, timeout=5)
        print(f"Connection to Slack without verification: Status {response.status_code}")
    except Exception as e:
        print(f"Error connecting to Slack without verification: {str(e)}")

    try:
        print("\nTesting connection to Slack with certificate verification...")
        response = requests.get("https://hooks.slack.com", verify=True, timeout=5)
        print(f"Connection to Slack with verification: Status {response.status_code}")
        print("Your SSL certificates are working correctly!")
        
    except requests.exceptions.SSLError:
        print("SSL Certificate verification failed.")
        
        # Option 1: Install certifi
        print("\nOption 1: Install/update certifi")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "certifi"])
            print("Certifi updated successfully.")
        except subprocess.CalledProcessError:
            print("Failed to update certifi.")
        
        # Option 2: Set the SSL_CERT_FILE environment variable
        cert_file = certifi.where()
        print(f"\nOption 2: Set environment variable")
        print(f"Set the environment variable SSL_CERT_FILE to: {cert_file}")
        print("\nFor Windows (in Command Prompt):")
        print(f"set SSL_CERT_FILE={cert_file}")
        print("\nFor Windows (in PowerShell):")
        print(f"$env:SSL_CERT_FILE=\"{cert_file}\"")
        print("\nFor macOS/Linux:")
        print(f"export SSL_CERT_FILE={cert_file}")
        
        # Option 3: Install certificates for this session
        print("\nOption 3: Install certificates for this session")
        try:
            import certifi.core
            certifi.core.where = lambda: certifi.where()
            ssl._create_default_https_context = ssl.create_default_context
            print("Certificates installed for this session.")
        except Exception as e:
            print(f"Failed to install certificates for this session: {str(e)}")
    
    except Exception as e:
        print(f"Error testing connection: {str(e)}")

if __name__ == "__main__":
    main() 