import { ArweaveSigner, bundleAndSignData, createData, Bundle } from "arbundles";
import Arweave from 'arweave';
import fs from 'fs'




export default async (files: Array<string>, jwk: any, arweave: Arweave) => {

	const signer = new ArweaveSigner(jwk);
	let chunk = [];
	files.map(async (file)=>{
		fs.readFile(file, 'utf8' , async (err, data) => {
			if (err) {
			  console.error(err)
			  return
			}
			chunk.push(await createData(data, signer))
		  })
		
	})

	const myBundle = await bundleAndSignData(chunk, signer);

	const tx = await myBundle.toTransaction(arweave, jwk);

    tx.addTag('Content-Type', 'application/png');
    
	await arweave.transactions.sign(tx, jwk);

	console.log(`Posted bundle with tx id: ${tx.id}`);

	console.log(await arweave.transactions.post(tx));

	console.log(await arweave.transactions.getStatus(tx.id))
    // Get all DataItems
    const data = await arweave.transactions.getData(tx.id, { decode: true });
    console.log(data)
    const bundle_check = new Bundle(Buffer.from(data));

    const all = bundle_check.items
    console.log(all)
}
