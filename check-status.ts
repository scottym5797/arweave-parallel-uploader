import yargs from 'yargs'
import fs from 'fs';
import path from 'path';
import { Bundle } from "arbundles";
import Arweave from 'arweave';
import * as http from 'http';


interface Arguments {
	c: string
  }
  const parser = yargs(process.argv.slice(2)).options({
	c: { type: 'string', demandOption: true, alias: 'cache', description: "link to cache file to check status"}
  })

  const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});


async function checkStatus(
    tx_id: string, 
    arweave: Arweave
    ) {

    // get preliminary status of the tx on the AR network
    const txStatus = await arweave.transactions.getStatus(tx_id);
    //console.log("transaction status", txStatus);

    return txStatus.status

    // // Get all DataItems -> get all the all bundled data 
    // const numRetries = txStatus.status >= 200? 10: 0
    
    // let data = undefined;
    // for (let j=0; j<numRetries; j++) {
    //     try {
    //         data = await arweave.transactions.getData(tx_id, { decode: true });
    //         if (data == undefined) throw new Error
    //         break;
    //     } catch (e){
    //         console.log(`Error retrieving transaction data, ${e} retrying ${numRetries-j} more time(s) to get ${tx_id}...` )
    //         await new Promise((resolve) => setTimeout(resolve, (j+1)*5000))
    //     }
    // }
    // if (data == undefined) throw new Error ("Could not parse data... Chonky sad")

    // // Convert the buffer (bundled data) to an acutal bundle object
    // const bundle_check = new Bundle(Buffer.from(data));
    
    // // return all the items in the bundle
    // const all = bundle_check.items

    //console.log("All bundle items", all)
    
    //get all the ids of the bundle items inside
    //console.log("All IDs", await bundle_check.getIds());

}

function getStatusMapFromCache(cache: any) {
  let statusMap: any = {}
  Object.keys(cache.bundles).map(m => statusMap[m] = 202)

  return statusMap
}

function getErrorCode(code: string) {
  const statusCodes = http.STATUS_CODES
  return statusCodes[code]
} 

const main = async()=>{

	const argv: Arguments = await parser.argv
	const input = argv.c
	const cache = JSON.parse(	
		// parse the user's wallet with string encoding
		fs.readFileSync(
			path.resolve(input), 
			{
				encoding: 'utf8'
			})
	);

  const neededConfirmations = Object.keys(cache.bundles).length
  let receivedConfirmations = 0

  let statusMap = getStatusMapFromCache(cache)

  while (neededConfirmations > receivedConfirmations) {
  
    for (const [bundle, _] of Object.entries(cache.bundles)) {
        if (statusMap[bundle] != '200 (OK)') {
        const status = await checkStatus(bundle, arweave)
            if (status === 200) {
                receivedConfirmations += 1
                }
            statusMap[bundle] = `${status} (${getErrorCode(status.toString())})`
        }
    }
    console.log("STATUS", JSON.stringify(statusMap, null, 4))

    
    if (receivedConfirmations == neededConfirmations){ 
        break
    }
    console.log("Not enough confirmations. Checking back in 5 seconds....", statusMap)
    console.log(`${receivedConfirmations}/${neededConfirmations} bundles confirmed`)
    await new Promise((resolve) => setTimeout(resolve, 5000))

  }
	console.log("All bundles confirmed")
} 
main();