# Contributing to the Smart Stadium Platform

First off, thank you for considering contributing to our project! It's people like you who make this platform amazing.

## Code of Conduct
By participating in this project, you agree to abide by our Code of Conduct and ensure a welcoming, inclusive, and professional environment.

## How Can I Contribute?

### Reporting Bugs
- Always check the Issues tab to ensure the bug hasn't already been reported.
- Open a new issue containing a clear title, reproduction steps, expected behavior, and actual behavior logs.

### Submitting Pull Requests
1.  Fork the repository and create your branch from `main`.
2.  Install dependencies and verify the test suite runs locally:
    ```bash
    python -m pip install -r services/gateway/requirements.txt
    PYTHONPATH=. pytest
    ```
3.  Format and check code style with formatting tools before staging:
    ```bash
    black services/ libs/
    isort services/ libs/
    ruff check services/ libs/
    ```
4.  Ensure your branch builds and tests pass cleanly in CI.
5.  Submit a PR with a description of the changes and a link to any related issues.
