import Arweave from 'arweave';
import { ArweaveSigner, bundleAndSignData, createData, Bundle } from "arbundles";
import fs from 'fs'

const jwk = JSON.parse(	
	fs.readFileSync('/Users/scott.martin@flixbus.com/Documents/GitHub/Personal/arweave-parallel-upload/arweave-keyfile-1l-37b30vUK7JfY_GB6jqnX2qK5qeDZiwNk0z0rhf9o.json', {encoding: 'utf8'})
)

const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});

const main = async()=>{

	const myTags = [
			{ name: 'App-Name', value: 'myApp' },
			{ name: 'App-Version', value: '1.0.0' }
	];

	const signer = new ArweaveSigner(jwk);
  
	const d = [
		await createData("hello", signer, { tags: myTags }),
		await createData("world", signer),
	]

	const myBundle = await bundleAndSignData(d, signer);

	const tx = await myBundle.toTransaction(arweave, jwk);

	await arweave.transactions.sign(tx, jwk);

	console.log(`Posted bundle with tx id: ${tx.id}`);

	console.log(await arweave.transactions.post(tx));

	console.log(await arweave.transactions.getStatus(tx.id))
    
    const data = await arweave.transactions.getData(tx.id, { decode: true });

        console.log("Transaction data", data)
        
        const bundle_check = new Bundle(Buffer.from(data));

        const all = bundle_check.items

        console.log("All bundle items", all)

        for(let i=0; i< all.length; i++) {
            
            let di = all[i].id;
            
            console.log("Parsed tx returns", di)
        }


} 
main();