"""Concurrently uploads local files to arweave

Args:
    --input (str): Path to folder with both input images and input json files
    --wallet (str): Path to arweave wallet
    --max-workers (int): How many threads to run in parallel (check how many threads your cpu can run). Default 1.
    --output (str): File path for output csv. Default = "./log.csv"
    --log (str): Log level. Default = info
"""

import argparse
import concurrent.futures
import glob
import json
import sys
import os
import logging
import time
import traceback

import pandas as pd
import requests
from arweave.arweave_lib import Transaction, Wallet
from arweave.transaction_uploader import get_uploader
from PIL import Image

logging.basicConfig(level=logging.INFO, stream=sys.stdout)

# estimation based on 09.11.2021
FLAT_FEE = 0.000001332792
FEE_PER_BYTE = 0.000000000415


def scrape_files(path: str, extension: str) -> list:
    """Returns files from a specific path given a specified extension.

    Args:
        path (str): Base path
        extension (str): file extension to target e.g .png, .json

    Returns:
        file_list: List of all files given that extension.
    """
    file_list = []
    for filename in glob.glob(path + f"/*{extension}"):
        file_list.append(filename)

    return file_list


def parse_json_file(json_file):
    f = open(json_file)
    return json.load(f)


def sum_file_sizes(path):
    size = 0
    for file in glob.glob(path + "/*.png") + glob.glob(path + "/*.json"):
        size = size + os.path.getsize(file)
    return size


def save_json_to_file(json_dict, json_file_name):
    with open(json_file_name, "w") as f:
        json.dump(json_dict, f)


# TODO: downloading from s3 then reuploading
def upload_arweave_link(link: str, idx: int, wallet: Wallet, content_type="image/png") -> str:
    image = Image.open(requests.get(link, stream=True).raw)
    image_bytes = bytes(image.tobytes())
    tx = Transaction(wallet, data=image_bytes)
    tx.add_tag("Content-Type", content_type)
    tx.sign()

    uploader = get_uploader(tx)

    while not uploader.is_complete:
        uploader.upload_chunk()

        logging.info(
            "{} - {}% complete, {}/{}".format(
                idx, uploader.pct_complete, uploader.uploaded_chunks, uploader.total_chunks
            )
        )

    logging.warning("\n***\n  -> Saved {0}! Transaction id: {1}\n***".format(link, tx.id))

    return tx.id


def upload_arweave_file(file: str, idx: int, wallet: Wallet, content_type="image/png") -> str:
    """Uploads local file to arweave

    Args:
        file (str): Path to file being uploaded
        idx (int): Index of the image (only used for logging)
        wallet (Wallet): Arweave wallet object
        content_type (str, optional): Type of the content to upload. Defaults to "image/png".

    Raises:
        Exception: NotImplementedError if you attempt to upload an online file

    Returns:
        str: transaction id from arweave
    """
    if "https://" in file:
        raise Exception("NotImplementedError")

    else:
        try:
            with open(file, "rb", buffering=0) as file_handler:
                tx = Transaction(wallet, file_handler=file_handler, file_path=file)
                tx.add_tag("Content-Type", content_type)
                tx.sign()

                uploader = get_uploader(tx, file_handler)

                while not uploader.is_complete:
                    uploader.upload_chunk()

                    logging.info(
                        "{} - {}% complete, {}/{}".format(
                            idx, uploader.pct_complete, uploader.uploaded_chunks, uploader.total_chunks
                        )
                    )
        except Exception:
            logging.error(f"Thread broke: {idx}, Exception: {traceback.format_exc()}")
            raise Exception(f"Thread broke: {idx}")
    logging.warning("\n***\n  -> Saved {0}! Transaction id: {1}\n***".format(file, tx.id))

    return tx.id


def check_consecutive(file):
    return sorted(file) == list(range(min(file), max(file) + 1))


def upload_wrapper(img_path: str, idx: int, wallet: Wallet) -> list:
    """Wrapper for arweave upload that finds the corresponding json file and edits it given the url of the uploaded arweave image.

    Args:
        img_path (str): Path to the image file
        idx (int): Index of the image file
        wallet (Wallet): Arweave wallet object

    Returns:
        list: List containing ['image_path', 'arweave_image_url', 'status', 'arweave_json_url']
    """
    json_file_name = img_path.replace(".png", ".json")

    json_file = parse_json_file(json_file_name)
    tx_id = upload_arweave_file(img_path, idx, wallet)

    logging.debug(f"TX ID: {tx_id}")
    json_file["image"] = "https://www.arweave.net/" + tx_id + "?ext=png"
    json_file["properties"]["files"][0]["uri"] = "https://www.arweave.net/" + tx_id + "?ext=png"

    save_json_to_file(json_dict=json_file, json_file_name=json_file_name)

    tx_id_json = upload_arweave_file(json_file_name, idx, wallet, content_type="application/json")

    if tx_id:
        return [
            img_path,
            "https://www.arweave.net/" + tx_id + "?ext=png",
            "OK",
            "https://www.arweave.net/" + tx_id_json,
        ]
    else:
        return [
            img_path,
            "https://www.arweave.net/" + tx_id + "?ext=png",
            "!",
            "https://www.arweave.net/" + tx_id_json,
        ]


def upload_to_arweave(files_to_upload: list, max_workers: int, wallet: Wallet) -> list:
    """Uploads to Arweave concurrently and returns results

    Args:
        files_to_upload (list): All image files to be uploaded
        max_workers (int): How many threads to upload
        wallet (Wallet): Arweave wallet object

    Returns:
        list: Results of uploads to be converted to csv
    """
    ar_uploads = []
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        for idx, img in enumerate(sorted(files_to_upload, key=lambda k: int(k.split("/")[-1].replace(".png", "")))):
            logging.info(f"Uploading image {idx} of {len(files_to_upload)}")
            ar_uploads.append(executor.submit(upload_wrapper, img, idx, wallet))

    for upload in ar_uploads:
        try:
            data = upload.result()
            logging.info(f"data found {data}")
            results.append(data)
        except Exception:
            logging.warning(f"generated an exception: {traceback.format_exc()}")
    return results


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        help="folder location of the images and json files",
        required=True,
        type=str,
    )
    parser.add_argument("--max-workers", help="How many threads to run in parallel", default=1, type=int)
    parser.add_argument(
        "--wallet",
        help="Path to arweave wallet",
        type=str,
        required=True,
    )
    parser.add_argument(
        "--output",
        help="folder location of the output csv. Default=./log.csv",
        default="./log.csv",
        type=str,
    )
    parser.add_argument(
        "-log",
        "--log",
        help="Provide logging level. Example --log debug.\nDefault=info",
        default="info",
    )

    return parser.parse_args()


def main():
    logging.info("Starting...")
    start_time = time.time()
    args = parse_args()
    logging.basicConfig(level=args.log.upper(), stream=sys.stdout)
    logging.info(f"Input files location: {args.input}")
    logging.info(f"Output files location: {args.output}")
    logging.info(f"Max workers: {args.max_workers}")
    logging.info(f"Wallet address: {args.wallet}")
    input_path = args.input
    output_path = args.output
    max_workers = args.max_workers
    wallet_path = args.wallet

    wallet = Wallet(wallet_path)

    balance = wallet.balance
    files_to_upload = scrape_files(input_path, extension=".png")
    logging.info(f"files to upload: {files_to_upload}")

    logging.info(f"Arweave Wallet balance {balance}")
    required_balance = FLAT_FEE + FEE_PER_BYTE * sum_file_sizes(input_path)
    logging.info(f"required balance: {required_balance}")
    # assert balance > required_balance, "Your arweave balance is not enough. Aborting..."
    assert check_consecutive(
        [int(k.split("/")[-1].replace(".png", "")) for k in files_to_upload]
    ), "Not consecutive uploads. Aborting..."

    upload_results = upload_to_arweave(files_to_upload, max_workers, wallet)
    ar_log_df = pd.DataFrame(upload_results, columns=["file_name", "AR_link", "status", "json_link"])
    ar_log_df.to_csv(output_path, index=False)
    logging.info(f"End time for {args.max_workers} = {time.time() - start_time}")
    logging.info(f"#### Completed upload. Your output file containing all files is available at {output_path} ####")


if __name__ == "__main__":
    main()
