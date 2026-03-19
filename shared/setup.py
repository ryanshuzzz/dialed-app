from setuptools import find_packages, setup

setup(
    name="dialed_shared",
    version="0.1.0",
    description="Shared utilities for Dialed backend services",
    packages=find_packages(),
    python_requires=">=3.12",
    install_requires=[
        "fastapi>=0.115.0",
        "python-jose[cryptography]>=3.3.0",
        "redis>=5.0.0",
        "pydantic>=2.0.0",
    ],
)
