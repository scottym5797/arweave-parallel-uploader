import { ZoomOutMapRounded } from '@material-ui/icons';
import Arweave from 'arweave';
import fs from 'fs';
import path from 'path';
import Piscina from 'piscina';
import yargs from 'yargs'
const fastcsv = require('fast-csv');


const piscina = new Piscina({
  filename: path.resolve(__dirname, 'worker.ts')
});

// const argv = yargs
//     .command('--input <str>', 'location of your input folder', {
//         description: 'the year to check for',
//         alias: 'i',
//         type: 'string',
//     }).command('--output <str>', 'location of your input folder', {
//         description: 'the year to check for',
//         alias: 'o',
//         type: 'string',
//     }).command('--max-wirkers <number>', 'location of your input folder', {
//         description: 'the year to check for',
//         alias: 'w',
//         type: 'number',
//     })

const argv = yargs(process.argv.slice(2)).options({
	i: { type: 'string', demandOption: true, alias: '--input', description: "location of your input base folder"},
	o: { type: 'string', alias: '--output', default:"./arweave-uploader.csv",description: "location to put your output csv file"},
	m: { type: 'number', alias: '--max-workers', default: 1, description: "maximum number of workers in the pool"},
	w: { type: 'string', alias: '--wallet', description: "location to your arweave wallet"},
  }).argv;


const input = "input path"
// const wallet = "wallet address"
// const output = "output files"
const jwk = JSON.parse(	
	fs.readFileSync('/Users/scott.martin@flixbus.com/Documents/Arweave/arweave-key-ruudREqZbd0_GCR_siIfZqDhIX2Vib4pRTluJD-byKY.json', {encoding: 'utf8'})
)

const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});
let totalBytes = 0;
let chunkBytes = 0;
let imageChunks = [];
let chunk = [];

const createChunks = (file: string) => {
	const stats = fs.statSync(file)
	const fileSizeInBytes = stats.size;
	totalBytes = totalBytes + fileSizeInBytes
	if (((chunkBytes + fileSizeInBytes) / (1024*1024)) < 250){
		chunk.push(file)
		chunkBytes = chunkBytes + fileSizeInBytes
	} else {
		imageChunks.push(chunk)
		chunk = [file]
		chunkBytes = fileSizeInBytes

	}
}

const main = async()=>{

	// const myTags = [
	// 		{ name: 'App-Name', value: 'myApp' },
	// 		{ name: 'App-Version', value: '1.0.0' }
	// ];

	
    const files = fs.readdirSync(input);
    files.map((file)=>{if(file.includes('.png')){
        createChunks(file)
		createChunks(file.replace('.png', '.json'))
    }})
	if (getArweaveCost(totalBytes) > parseInt(await arweave.wallets.getBalance(jwk))){
		throw new Error('Your Arweave balance is not high enough to pay for this transaction')
	}

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