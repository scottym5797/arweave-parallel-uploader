import { ArweaveSigner, bundleAndSignData, createData, Bundle, DataItem } from "arbundles";
import Arweave from 'arweave';
import fs from 'fs'

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

export default async (files: Array<string>, jwk: any, arweave: Arweave) => {
    console.log("running script")
    // init empty chuck
    const chunk: Array<any> = [];
    // init signer
	const signer = new ArweaveSigner(jwk);
    // init reponse object
    const response: MappedFiles[] = [];

    for (let i=0; i< files.length; i++) {
        try {
            // parse file to read
            const file = await fs.promises
            .readFile(files[i])
            .then((r) => Buffer.from(r.buffer)) as never;
            
            // calculate cost
            console.log('Arweave cost: ', getArweaveCost(Buffer.byteLength(file)))
            // give us a few seconds to see the cost
            await new Promise((resolve) => setTimeout(resolve, 3000))
            
            // sign the budle with provided keypair
            const myTags = [{ name: 'Content-Type', value: 'image/png' }]
            chunk.push(await createData(file, signer, {tags: myTags}));
            
            console.log("pushed to chunk", chunk);
    
        } catch (err) {
            console.log("ReadFile error:", err)
            throw err
        };
    }
    
    // put all the data into one chunk and sign
    const myBundle = await bundleAndSignData(chunk, signer);
    
    // create a tx out of a bundle for AR to ingest
    const tx = await myBundle.toTransaction(arweave, jwk);
    // sign the transaction to confirm payer
    await arweave.transactions.sign(tx, jwk);

    console.log(`Posted bundle with tx id: ${tx.id}, ${tx}`);
    
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

    console.log("All bundle items", all)
    
    //get all the ids of the bundle items inside
    console.log("All IDs", await bundle_check.getIds());


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

function getArweaveCost(totalBytes: number) {
	const fixedCost = 0.000001332792
	const variableCost = 0.000000000415
	return fixedCost + variableCost*totalBytes
}