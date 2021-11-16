from distutils.core import setup

setup(
    name="arweave-parallel-uploader",
    packages=["arweave_parallel_uploader"],
    version="0.0.1",
    description="Allows parallel upload of local nft files",
    author="scottym5797",
    author_email="scott.martin5797@gmail.com",
    url="https://github.com/scottym5797/arweave-parallel-uploader",
    download_url="https://github.com/scottym5797/arweave-parallel-uploader",
    keywords=["arweave", "solana", "nft", "crypto"],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: Unix",
    ],
    install_requires=["arweave-python-client>=1.0.14", "Pillow>=8.3.2", "requests>=2.26.0", "pandas>=1.3.4"],
    entry_points={
        "console_scripts": [
            "arweave-parallel-upload=arweave_parallel_uploader.arweave_uploader:main",
        ],
    },
)
