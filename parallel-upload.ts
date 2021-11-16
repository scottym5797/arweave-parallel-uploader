import { ArweaveSigner, bundleAndSignData, createData, Bundle, DataItem } from "arbundles";
import Arweave from 'arweave';
import fs from 'fs';
import path from 'path';
import yargs, { group } from 'yargs'
import * as csv from 'fast-csv';
import Transaction from "arweave/node/lib/transaction";

/*
tests: 
 - 2 png, 2 json, total 60mb - OK
 - 

*/

interface csvRow {
	file_name: string,
	arweave_url: string,
	status: string,
	json_url: string,
}
export class MappedFiles {
    arLink: string;
	arBundle: string
    fileName: string;
    constructor(args: {
        arLink: string;
		arBundle: string;
        fileName: string;
    }) {
      this.arLink = args.arLink;
	  this.arBundle = args.arBundle;
      this.fileName = args.fileName;
    }
  }

  interface Arguments {
	[x: string]: unknown;
	i: string,
	o: string,
	w: string,
	c: number
  }
  const parser = yargs(process.argv.slice(2)).options({
	i: { type: 'string', demandOption: true, alias: 'input', description: "location of your input base folder"},
	o: { type: 'string', alias: 'output', default:"./arweave-uploader.csv",description: "location to put your output csv file"},
	w: { type: 'string', demandOption: true, alias: 'wallet', description: "location to your arweave wallet"},
	c: { type: 'number', alias: 'chunkSize', default: 50, description: "chunk size (chunkies) in which the data will be bundled. Important to tune it to your memory availability"}
  }).usage('Usage: $0 -i [string] -w [string] -i [string]').example('$0 -i /usr/docs/path/to/images -w /arweave-key.json -o /output.csv', '');


//initialise arweave connection
const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});



const createChunks = async (
	files: string[], 
	extension: string, 
	input: string, 
	jwk: string,
	chunkSize: number
	) => {
	let totalBytes = 0;
	let chunkBytes = 0;
	let imageChunks: Array<string[]>= [];
	let chunk: string[] = [];

	for (let i=0; i< files.length; i++) {
		if (files[i].includes(extension)) {
			const stats = fs.statSync(path.join(input,files[i]))
			const fileSizeInBytes = stats.size;
			totalBytes = totalBytes + fileSizeInBytes
			// create a chunk of max 250mb
			if (((chunkBytes + fileSizeInBytes) / (1024*1024)) < chunkSize){
				//console.log("appending to chunk!")
				chunk.push(path.join(input,files[i]))
				chunkBytes = chunkBytes + fileSizeInBytes
			// if chunk more than 250mb, append chunk (list of strings) to imageChunks (list of list of strings)
			} else {
				//console.log("pushing chunk")
				imageChunks.push(chunk)
				chunk = [path.join(input,files[i])]
				chunkBytes = fileSizeInBytes

			}
		}
	}

	imageChunks.push(chunk)

	const arweaveCosts = getArweaveCost(totalBytes)
	console.log("Arweave cost", arweaveCosts)

	// Check if user has enough balance		
	if (arweaveCosts > parseInt(await arweave.wallets.getBalance(jwk))){
		throw new Error('Your Arweave balance is not high enough to pay for this transaction')
	}
	return imageChunks
}

// remove path and extension from name
function getcleanFileName(fileName:string) {
	return path.basename(fileName).replace(/\.[^/.]+$/, "");
}

function getArweaveCost(totalBytes: number) {
	const fixedCost = 0.000001332792
	const variableCost = 0.000000000415
	return fixedCost + variableCost*totalBytes
}



function writeCsv(data: Array<csvRow>, output: string){

	const csvStream = csv.format({ headers: true });
	const ws = fs.createWriteStream(output)
	csvStream.pipe(ws);
	data.map((row)=>csvStream.write(row));
	csvStream.end();
}

function parseUrl(arweaveId: string) {
	return "http://www.arweave.net/" + arweaveId
}

async function editJSON(
	uploadedImagesMap: Map<string, string>,
	fileName: string
	) {
	const cleanFileName = getcleanFileName(fileName);

	if (uploadedImagesMap.get(cleanFileName) != undefined) {

		const file = require(path.resolve(__dirname, fileName));
		
		// this program assumes the NFT follows the Token Metadata Standard detailed at https://docs.metaplex.com/nft-standard
		const arTxID = uploadedImagesMap.get(cleanFileName)

		file.image = `https://www.arweave.net/${arTxID}?ext=png`
		file.properties.files[0].uri = `https://www.arweave.net/${arTxID}?ext=png`

		fs.writeFile(
			fileName, 
			JSON.stringify(file), 
			function writeJSON(err) {
				if (err) return console.log(err);
				//console.log(JSON.stringify(file, null, 2));
				//console.log('Appending tx id to ' + fileName);
			}
		);
	}
}

async function uploadChunk(
	files: Array<string>, 
	jwk: any, 
	arweave: Arweave,
	contentType: string,
	uploadedImagesMap?: Map<string, string>
	) {
	if (uploadedImagesMap) console.log("hello")

	console.log("running uploadCHunk script")
	// init empty chuck
	const chunk: Array<any> = [];
	// init signer
	const signer = new ArweaveSigner(jwk);
	console.log("Init signer")

	//console.log("FILES", files)

	for (let i=0; i< files.length; i++) {
		try {
			
			//console.log("pushing file", files[i])

			if (uploadedImagesMap && contentType === "application/json" ) await editJSON(uploadedImagesMap, files[i]);

			// parse file to read
			const file = await fs.promises
			.readFile(files[i])
			.then((r) => Buffer.from(r.buffer)) as never;

			// sign the budle with provided keypair
			const txTags = [
				{ 
					name: 'Content-Type', 
					value: contentType 
				}
			];

			chunk.push(
				await createData(file, signer, {tags: txTags})
			);
			
			//console.log("pushed to chunk", files[i]);
	
		} catch (err) {
			console.log("ReadFile error:", err)
			throw err
		};
	}
	
	console.log("Pushed all the chunkies")

	// put all the data into one chunk and sign
	const myBundle = await bundleAndSignData(chunk, signer);

	console.log("Bundled data")

	// create a tx out of a bundle for AR to ingest
	const tx = await myBundle.toTransaction(arweave, jwk);

	console.log("made it into tx")

	// sign the transaction to confirm payer
	await arweave.transactions.sign(tx, jwk);

	console.log(`Posted bundle with tx id: ${tx.id}`);
	
	// post the tx into the AR network
	console.log(await arweave.transactions.post(tx));

	console.log("Posted data")


	return files.map(m => [tx.id, m])

}
async function processChunk(
	files: Array<string>, 
	tx_id: string, 
	arweave: Arweave,
	) {

	// init reponse object
	const response: MappedFiles[] = [];

	// get preliminary status of the tx on the AR network
	const txStatus = await arweave.transactions.getStatus(tx_id);
	console.log("transaction status", txStatus);

	// Get all DataItems -> get all the all bundled data 
	const numRetries = txStatus.status == 202? 10: 0
	
	let data = undefined;
	for (let j=0; j<numRetries; j++) {
		try {
			data = await arweave.transactions.getData(tx_id, { decode: true });
			if (data == undefined) throw new Error
			break;
		} catch (e){
			console.log(`Error retrieving transaction data, ${e} retrying ${numRetries-j} more time(s) to get ${tx_id}...` )
			await new Promise((resolve) => setTimeout(resolve, (j+1)*5000))
		}
	}
	if (data == undefined) throw new Error ("Could not parse data... Chonky sad")

	// Convert the buffer (bundled data) to an acutal bundle object
	const bundle_check = new Bundle(Buffer.from(data));
	
	// return all the items in the bundle
	const all = bundle_check.items

	//console.log("All bundle items", all)
	
	//get all the ids of the bundle items inside
	//console.log("All IDs", await bundle_check.getIds());

	for(let i=0; i< all.length; i++) {
		
		const di = all[i].id;
		const fn = files[i]

		console.log("Parsed tx returns", di, "for file", fn)

		const mappedFile = new MappedFiles ({
			arLink: di,
			arBundle: tx_id,
			fileName: fn
		});

		response.push(mappedFile);
	}

	return response;
}

function createCsvRows(uploadedImages: MappedFiles[], uploadedJsons: MappedFiles[]) {
	if (uploadedJsons.length > 0) {
	return uploadedImages.flat().map((image,i)=>{
			let temp = uploadedJsons.flat().find(jsonFile=> jsonFile.fileName.replace(".json", "") === image.fileName.replace(".png", ""))
				return {
					file_name: image.fileName,
					arweave_url: parseUrl(image.arLink),
					status: temp ? "success" : "error",
					json_url: temp ? parseUrl(temp.arLink) : "no json file found",
				}
		  })
		} else {
			return uploadedImages.flat().map((image,i)=>{
				return {
					file_name: image.fileName,
					arweave_url: parseUrl(image.arLink),
					status: "success",
					json_url: ""
				}
			})
		}

}

function createCacheFolder() {
	var fs = require('fs');
	var dir = './.cache';

	if (!fs.existsSync(dir)){
		fs.mkdirSync(dir);
	}
}

function saveCacheState(fileName: string, cacheContent: any) {

	fs.writeFileSync(
		path.resolve(".cache", fileName), 
		JSON.stringify(cacheContent, null, 4)
	);
}

function getUniqueVals(value: any, index: any, self: any) {
	return self.indexOf(value) === index;
  }

function getGroupedChunks(uploadedTxs: string[][]) {
	let groupedChunks: any = {};
	for (let i=0; i<uploadedTxs.length; i++) {

		const bundlTx = uploadedTxs[i][0]
		const fileName = uploadedTxs[i][1]

		if (groupedChunks[bundlTx] == undefined ) {
			groupedChunks[bundlTx] = [fileName];
		} else {
			groupedChunks[bundlTx].push(fileName);
		};
	};
	return groupedChunks
}

const main = async()=>{

	const argv: Arguments = await parser.argv
	const input = argv.i
	const output = argv.o
    const files = fs.readdirSync(input);
	const jwk = JSON.parse(	
		// parse the user's wallet with string encoding
		fs.readFileSync(
			path.resolve(argv.w), 
			{
				encoding: 'utf8'
			})
	);
	
	createCacheFolder()
	var cacheContentName = "ar-uploads-" + Math.floor(Date.now() / 1000)
	var cacheContent: any = {bundles: {}};

	console.log("Initializing uploader with a chunksize of " + argv.c + " MB")

	// if png then add to chunks based on size
	const imageChunks = await createChunks(files, ".png", input, jwk, argv.c)
	const jsonChunks = await createChunks(files, ".json", input, jwk, argv.c)


	console.log("IMAGE CHUNKS LENGTH", imageChunks.length)

	// chunksMap = imageChunks.map(async (files, idx)=>{
	// 	const result = await pool.run({files:files, jwk:jwk, arweave:arweave});
	// 	console.log("Result from batch", idx,":", result);
	// }
	//create pool of promises for them to be executed

	//console.log("IM CHUNKS", imageChunks)
	
	
	const uploadedImageTxs: string[][] = await Promise.all(
		imageChunks.map((imageChunk)=>uploadChunk(imageChunk, jwk, arweave, "image/png"))
	).then(a => a.flat())

	let uniqueBundleTx = uploadedImageTxs.map(m => m[0]).filter(getUniqueVals)

	uniqueBundleTx.map( u => {	
		// make each bundle a single key to group the images bundled into this
		cacheContent["bundles"][u] = {"items": {}};
	}); 
	saveCacheState(cacheContentName, cacheContent)

	// create a grouped view of bundlr txs
	const groupedImageChunks = getGroupedChunks(uploadedImageTxs)

	// await all imagechunks by groupedImagechunk obtained above
	const uploadedImages: MappedFiles[] = await Promise.all(
		Object.keys(groupedImageChunks).map((imageChunk) => processChunk(groupedImageChunks[imageChunk], imageChunk, arweave))
	).then(a => a.flat())

	// Add to cache
	uploadedImages.map(u => {
		cacheContent["bundles"][u.arBundle]["items"][getcleanFileName(u.fileName)] = {
			file: u.fileName,
			arLink: u.arLink
		}
	})
	saveCacheState(cacheContentName, cacheContent)

	console.log("About to group JSONS")

	// generate map for better lookup speed
	const uploadedImagesMap = new Map();
	for (let i=0; i<uploadedImages.length; i++) {
		uploadedImagesMap.set(
			getcleanFileName(uploadedImages[i].fileName), // get only basename as it makes it easier to compare.
			uploadedImages[i].arLink
			)
	}

	console.log("About to send JSONS")

	const uploadedJSONTxs = await Promise.all(
		jsonChunks.map((jsonChunk)=>uploadChunk(jsonChunk, jwk, arweave, "application/json", uploadedImagesMap))
	).then(a => a.flat())

	uniqueBundleTx = uploadedJSONTxs.map(m => m[0]).filter(getUniqueVals)

	uniqueBundleTx.map( u => {	
		// make each bundle a single key to group the images bundled into this
		cacheContent["bundles"][u] = {"items": {}};
	}); 
	saveCacheState(cacheContentName, cacheContent)

	// create a grouped view of bundlr txs
	const groupedJSONChunks = getGroupedChunks(uploadedJSONTxs)

	const uploadedJsons: MappedFiles[] = await Promise.all(
		Object.keys(groupedJSONChunks).map((JSONChunk) => processChunk(groupedJSONChunks[JSONChunk], JSONChunk, arweave))
	).then(a => a.flat())

	// Add to cache
	uploadedJsons.map(u => {
		cacheContent["bundles"][u.arBundle]["items"][getcleanFileName(u.fileName)] = {
			file: u.fileName,
			arLink: u.arLink
		}
	})
	saveCacheState(cacheContentName, cacheContent)

	const csvRows = createCsvRows(uploadedImages, uploadedJsons)
	
	writeCsv(csvRows, path.resolve(output));
	

	console.log("Done! logs sent to ", output)
} 
main();