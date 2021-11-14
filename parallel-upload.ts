import { ArweaveSigner, bundleAndSignData, createData, Bundle, DataItem } from "arbundles";
import Arweave from 'arweave';
import fs from 'fs';
import path from 'path';
import Piscina from 'piscina';
import yargs from 'yargs'
const fastcsv = require('fast-csv');


const jwk = JSON.parse(	
    // parse the user's wallet with string encoding
	fs.readFileSync(
        '/Users/scott.martin@flixbus.com/Documents/GitHub/Personal/arweave-parallel-upload/arweave-keyfile-1l-37b30vUK7JfY_GB6jqnX2qK5qeDZiwNk0z0rhf9o.json', 
        {
            encoding: 'utf8'
        })
);
//initialise arweave connection
const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});

const pool = new Piscina({
  filename: path.resolve(__dirname, 'test-worker.js'),
  maxThreads: 4
});


// const argv = yargs(process.argv.slice(2)).options({
// 	i: { type: 'string', demandOption: true, alias: '--input', description: "location of your input base folder"},
// 	o: { type: 'string', alias: '--output', default:"./arweave-uploader.csv",description: "location to put your output csv file"},
// 	m: { type: 'number', alias: '--max-workers', default: 1, description: "maximum number of workers in the pool"},
// 	w: { type: 'string', alias: '--wallet', description: "location to your arweave wallet"},
//   }).argv;


const input = "/Users/scott.martin@flixbus.com/Documents/GitHub/Personal/arweave-parallel-upload/demo/Maciej_Custom"
// const wallet = "wallet address"
// const output = "output files"


const createChunks = async (files: string[]) => {

	let totalBytes = 0;
	let chunkBytes = 0;
	let imageChunks: Array<string[]>= [];
	let chunk: string[] = [];

	for (let i=0; i< files.length; i++) {
		if (files[i].includes(".png")) {
			const stats = fs.statSync(path.join(input,files[i]))
			const fileSizeInBytes = stats.size;
			totalBytes = totalBytes + fileSizeInBytes
			// create a chunk of max 250mb
			if (((chunkBytes + fileSizeInBytes) / (1024*1024)) < 250){
				//console.log("appending to chunk!")
				chunk.push(path.join(input,files[i]))
				chunkBytes = chunkBytes + fileSizeInBytes
			// if chunk more then 250mb, append chunk (list of strings) to imageCHunk (list of list of strings)
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

const main = async()=>{


	
    const files = fs.readdirSync(input);
	
	// if png then add to chunks based on size
	const imageChunks = await createChunks(files)


	console.log("IMAGE CHUNKS LEN", imageChunks.length, imageChunks[0])

	// chunksMap = imageChunks.map(async (files, idx)=>{
	// 	const result = await pool.run({files:files, jwk:jwk, arweave:arweave});
	// 	console.log("Result from batch", idx,":", result);
	// }
	//create pool of promises for them to be executed

	//console.log("IM CHUNKS", imageChunks)

	const test = await Promise.all([
		uploadChunk(imageChunks[0], jwk, arweave)
	]).catch((err)=>console.log("Error in promise", err))

	//console.log(test)
} 
main();

function getArweaveCost(totalBytes: number) {
	const fixedCost = 0.000001332792
	const variableCost = 0.000000000415
	return fixedCost + variableCost*totalBytes
}

interface csvRow {
	local_path: string,
	arweave_url: string,
	status: string,
	json_url: string,
}

function writeCsv(data: Array<csvRow>, output: string){
	const ws = fs.createWriteStream(output);
	fastcsv
	.write(data, { headers: true })
	.pipe(ws);
}

export class MappedFiles {
    arLink: string;
    fileName: string;
    constructor(args: {
        arLink: string;
        fileName: string;
    }) {
      this.arLink = args.arLink;
      this.fileName = args.fileName;
    }
  }

async function uploadChunk(files: Array<string>, jwk: any, arweave: Arweave) {
    console.log("running script")
    // init empty chuck
    const chunk: Array<any> = [];
    // init signer
	const signer = new ArweaveSigner(jwk);
    // init reponse object
    const response: MappedFiles[] = [];

	//console.log("FILES", files)

    for (let i=0; i< files.length; i++) {
        try {
			console.log("READING...")
            // parse file to read
            const file = await fs.promises
            .readFile(files[i])
            .then((r) => Buffer.from(r.buffer)) as never;
			console.log("CREATED!")
            
            // sign the budle with provided keypair
            const myTags = [{ name: 'Content-Type', value: 'image/png' }]
            chunk.push(await createData(file, signer, {tags: myTags}));
            
            console.log("pushed to chunk", files[i]);
    
        } catch (err) {
            console.log("ReadFile error:", err)
            throw err
        };
    }
    
	console.log("Pushed all the chunkies")

    // put all the data into one chunk and sign
    const myBundle = await bundleAndSignData(chunk, signer);
    
    // create a tx out of a bundle for AR to ingest
    const tx = await myBundle.toTransaction(arweave, jwk);
    // sign the transaction to confirm payer
    await arweave.transactions.sign(tx, jwk);

    console.log(`Posted bundle with tx id: ${tx.id}`);
    
    // post the tx into the AR network
    console.log(await arweave.transactions.post(tx));
    
    // get preliminary status of the tx on the AR network
    console.log(await arweave.transactions.getStatus(tx.id))

    // Get all DataItems -> get all the all bundled data 
    const data = await arweave.transactions.getData(tx.id, { decode: true });

    console.log("Transaction data", data)
    
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
            fileName: fn
        });

        response.push(mappedFile);
    }

    return response;
}

