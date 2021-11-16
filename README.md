# arweave-parallel-uploader
Allows crazy perfs and extreme parallelization 🚀

A repository for parallelizing the uploads of local NFT files to arweave.

Tested on unix systems but not yet tested for windows. You may have issues supporting multithreading on a Windows device.

:warning: **_NOTE:_**
`Currently uses arweave direct Transactions, and as such it can be unstable for files over ~5mb when using multiple threads. Especially for low bandwith connection.
It is recommended to use the main branch for large files. Use this tool with caution`


## How to Use

To use this repository, ensure that you have [python](https://www.python.org/downloads/) installed. Ensure that you also have an [arweave wallet](https://www.arweave.org) with sufficient funds to upload your files.

### Easy setup

To install the uploader use: 
`pip install -U git+https://github.com/scottym5797/arweave-parallel-uploader`

To run your script there are a number of arguments that need to be used. Ensure that your images are in a local folder and following the typical structure.

- --input: full path to the folder containing both the images and the json files
- --wallet: Full path to your wallet address. e.g. "usr/documents/arweave-wallet.json"
- --output (optional): Where to output the csv file. Defaults to the current repo.
- --max-workers (optional): The number of threads to run parallel. This should only be maximum the number of threads on your cpu. Default = 1
- --log (optional): The log level of the script. Default = 'info'

`arweave-parallel-upload --input "/path/to/base/folder"  --wallet "/path/to/arweave/wallet/file" --max-workers 5`

### Manual setup

If you have trouble pip installing the script you can install it manually in the following steps.

#### Setting up the evironment 

downloading the zip file or git cloning this repo you can then:

```
python3 -m venv venv
source venv/Bin/activate
pip install -r requirements.txt
cd arweave_parallel_uploader
```

Then your script is ready to run.

#### Running the script

To run your script there are a number of arguments that needed to be used. Ensure that your images are in a local folder and following the typical structure.

`python arweave_uploader.py --input "/path/to/base/folder"  --wallet "/path/to/arweave/wallet/file" --max-workers 5`

### Ouput

Once the script runs it puts out a csv file to your local machine showing the mappings of the local file to an arweave json url and arweave image url.

Example output:

<img width="918" alt="Screen Shot 2021-11-10 at 14 33 44" src="https://user-images.githubusercontent.com/62399837/141125643-8f2a709b-0395-41fa-a9fb-d50dd7141517.png">
