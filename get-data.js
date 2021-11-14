import Arweave from 'arweave';
import { Bundle } from "arbundles";


const main = async()=>{
    // Get all DataItems
    const data = await arweave.transactions.getData(tx.id, { decode: true });

    const bundle_check = new Bundle(Buffer.from(data));

    const all = bundle_check.items
    console.log(all)
} 
main();