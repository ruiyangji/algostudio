#!/usr/bin/env python3
"""
AlgoStudio Application Entry Point
Delegates to the modular server package.
"""
import os
import sys

if __name__ == "__main__":
    server_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server")
    sys.path.insert(0, server_dir)
    from app import main
    main()
