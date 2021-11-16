# arweave-parallel-uploader
Allows crazy perfs and extreme parallelization 🚀

A repository for speeding up the uploads of local NFT files to arweave using arbundles.

**_NOTE:_**
`If you have a large number of small sized files you may fair better using the python version in the python branch. But it isunstable so use with caution`


## How to Use

To use this repository, ensure that you have [ts-node](https://github.com/TypeStrong/ts-node) installed. Ensure that you also have an [arweave wallet](https://www.arweave.org) with sufficient funds to upload your files.

### Uploading

To install the uploader use: 
`git clone https://github.com/scottym5797/arweave-parallel-upload`
`cd arweave-parallel-upload`
`npm install`

To run your script there are a number of arguments that need to be used. Ensure that your images are in a local folder and following the typical structure.

- --input: full path to the folder containing both the images and the json files
- --wallet: Full path to your wallet address. e.g. "usr/documents/arweave-wallet.json"
- --output (optional): Where to output the csv file. Defaults to the current repo.



```
Usage: parallel-upload.ts -i [string] -w [string] -c [number] -o [string]

Options:
      --help       Show help                                           [boolean]
      --version    Show version number                                 [boolean]
  -i, --input      location of your input base folder        [string] [required]
  -o, --output     location to put your output csv file
                                    [string] [default: "./arweave-uploader.csv"]
  -w, --wallet     location to your arweave wallet           [string] [required]
  -c, --chunkSize  chunk size (chunkies) in which the data will be bundled. Can
                   be tuned to your memory availability   [number] [default: 50]

Examples:
  parallel-upload.ts -i /usr/docs/path/to/images -w /arweave-key.json -c 0.2
  -o /output.csv
  ```

### Checking status

Once the file is uploaded with a 202, you can then check its status using the check-status.ts file.

Each time you run the parallel upload script it will spit out a log file in the .cache folder.
This will then be used as an argument in the script to check the status of those files.

e.g.
`ts-node check-status.ts -c /absolute/path/to/.cache/ar-uploads-1637083642.log`

```
Options:
      --help     Show help                                             [boolean]
      --version  Show version number                                   [boolean]
  -c, --cache    link to cache file to check status          [string] [required]
```
### Ouput

Once the script runs it puts out a csv file to your local machine showing the mappings of the local file to an arweave json url and arweave image url.

It also outputs a cache to be used in the check-status script

Example output:

<img width="918" alt="Screen Shot 2021-11-10 at 14 33 44" src="https://user-images.githubusercontent.com/62399837/141125643-8f2a709b-0395-41fa-a9fb-d50dd7141517.png">


