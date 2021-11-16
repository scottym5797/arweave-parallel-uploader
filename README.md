# arweave-parallel-uploader
Allows crazy perfs and extreme parallelization 🚀

A repository for speeding up the uploads of local NFT files to arweave using arbundles.

**_NOTE:_**
`If you have a large number of small sized files you may fair better using the python version in the python branch. But it isunstable so use with caution`


## How to Use

To use this repository, ensure that you have [ts-node](https://github.com/TypeStrong/ts-node) installed. Ensure that you also have an [arweave wallet](https://www.arweave.org) with sufficient funds to upload your files.

### Easy setup

To install the uploader use: 
`git clone https://github.com/scottym5797/arweave-parallel-upload`
`cd arweave-parallel-upload`
`npm install`

To run your script there are a number of arguments that need to be used. Ensure that your images are in a local folder and following the typical structure.

- --input: full path to the folder containing both the images and the json files
- --wallet: Full path to your wallet address. e.g. "usr/documents/arweave-wallet.json"
- --output (optional): Where to output the csv file. Defaults to the current repo.



```
Options:
      --help     Show help                                             [boolean]
      --version  Show version number                                   [boolean]
  -i, --input    location of your input base folder          [string] [required]
  -o, --output   location to put your output csv file
                                    [string] [default: "./arweave-uploader.csv"]
  -w, --wallet   location to your arweave wallet             [string] [required]

Examples:
  parallel-upload.ts -i /usr/docs/path/to/images -w /arweave-key.json -o
  /output.csv
  ```


### Ouput

Once the script runs it puts out a csv file to your local machine showing the mappings of the local file to an arweave json url and arweave image url.

Example output:

<img width="918" alt="Screen Shot 2021-11-10 at 14 33 44" src="https://user-images.githubusercontent.com/62399837/141125643-8f2a709b-0395-41fa-a9fb-d50dd7141517.png">


