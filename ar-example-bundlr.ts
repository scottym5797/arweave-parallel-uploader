import fs from "fs";
import { ArweaveSigner, createData } from "arbundles";

const account = async () => {

    const jwk = JSON.parse(	
        fs.readFileSync(
            '/Users/scott.martin@flixbus.com/Documents/GitHub/Personal/arweave-parallel-upload/arweave-keyfile-1l-37b30vUK7JfY_GB6jqnX2qK5qeDZiwNk0z0rhf9o.json', 
            {
                encoding: 'utf8'
            })
    );

    const signer = new ArweaveSigner(jwk);

    const directory = "/Users/scott.martin@flixbus.com/Documents/GitHub/Personal/arweave-parallel-upload/test_images";

    const files = fs.readdirSync(directory);

    for (const file of files) {

        console.log("Entering")

        const data = fs.readFileSync(`${directory}/${file}`);

        console.log("Creating")

        const item = createData(data, signer);

        console.log("Signing")

        await item.sign(signer);
        
        console.log("awaiting")

        const response = await item.sendToBundler();

        console.log(`Sent ${file} bundler with response: ${response.status} / ${response.statusText}`);

    }



};


account();