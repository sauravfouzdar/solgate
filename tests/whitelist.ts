import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Whitelist } from "../target/types/whitelist";
import { assert } from "chai";



async function airdropSol(connection, destinationWallet, amount) {
  const airdropSignature = await connection.requestAirdrop(destinationWallet.publicKey, 
    amount * anchor.web3.LAMPORTS_PER_SOL);
  
  const latestBlockHash = await connection.getLatestBlockhash();

  const tx = await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: airdropSignature
  });
}



describe("whitelist", () => {
// Configure the client to use the local cluster.
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.Whitelist as Program<Whitelist>;
const authority = anchor.web3.Keypair.generate();

let whitelistAddress = anchor.web3.Keypair.generate();

let whitelistWallets: Array<anchor.web3.Keypair> = [];
for(let i = 0; i < 5; ++i) {
  let address = anchor.web3.Keypair.generate();
  whitelistWallets.push(address);
}


it("Create a whitelist", async () => {

  // Airdrop sol to authority to pay for gas fee
  await airdropSol(provider.connection, authority, 2);
  console.log("Airdrop to pubkey done!");

  await program.methods
    .createWhitelist()
    .accounts({
      authority: authority.publicKey,
      whitelistConfig: whitelistAddress.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([whitelistAddress, authority])
    .rpc();

  console.log("\nnew whitelist created");

});


it("Adds wallets to whitelist", async () => {

  for(let i = 0; i < whitelistWallets.length; ++i) {
    let wallet = whitelistWallets[i];
    let [walletPDA, _] = await anchor.web3.PublicKey.findProgramAddress(
      [whitelistAddress.publicKey.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .addWallet(wallet.publicKey)
      .accounts({
        whitelistConfig: whitelistAddress.publicKey,
        walletPda: walletPDA,
        authority: authority.publicKey,
        feePayer: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([authority])
      .rpc();
  }

});


it("checks if wallets are whitelisted", async () => {
  let whitelistedWallet = whitelistWallets[0];
  let [whitelistedWalletPDA, bump] = await anchor.web3.PublicKey.findProgramAddress(
    [whitelistAddress.publicKey.toBuffer(), whitelistedWallet.publicKey.toBuffer()],
    program.programId
  );

  await program.methods
    .checkWallet(whitelistedWallet.publicKey)
    .accounts({
      whitelistConfig: whitelistAddress.publicKey,
      authority: authority.publicKey,
      walletPda: whitelistedWalletPDA,
    })
    .signers([])
    .rpc();
});

it("Removes wallets from whitelist", async () => {

  for(let i = 1; i < 4; ++i) {
    let walletToRemove = whitelistWallets[i];

    let [removeWalletPDA,] = await anchor.web3.PublicKey.findProgramAddress(
      [whitelistAddress.publicKey.toBuffer(), walletToRemove.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .removeWallet(walletToRemove.publicKey)
      .accounts({
        whitelistConfig: whitelistAddress.publicKey,
        walletPda: removeWalletPDA,
        authority: authority.publicKey,
        refundWallet: authority.publicKey,
      })
      .signers([authority])
      .rpc();
  }

});

it("Sets a new whitelist authority", async () => {
  let newAuthority = anchor.web3.Keypair.generate();
  await airdropSol(provider.connection, newAuthority, 2);

  await program.methods
    .setAuthority(newAuthority.publicKey)
    .accounts({
      whitelistConfig: whitelistAddress.publicKey,
      currentAuthority: authority.publicKey
    })
    .signers([authority])
    .rpc();

  let config = await program.account.whitelistConfig.fetch(whitelistAddress.publicKey);
  assert.ok(config.authority.equals(newAuthority.publicKey));

  let newWallet = anchor.web3.Keypair.generate();
  let [newWalletPDA, _] = await anchor.web3.PublicKey.findProgramAddress(
    [whitelistAddress.publicKey.toBuffer(), newWallet.publicKey.toBuffer()],
    program.programId
  );

  // adding wallet using new authority, result:- pass
  await program.methods
    .addWallet(newWallet.publicKey)
    .accounts({
      whitelistConfig: whitelistAddress.publicKey,
      walletPda: newWalletPDA,
      authority: newAuthority.publicKey,
      feePayer: newAuthority.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([newAuthority])
    .rpc();

  // check previous transaction was successful, result:- pass
  await program.methods
    .checkWallet(newWallet.publicKey)
    .accounts({
      whitelistConfig: whitelistAddress.publicKey,
      authority: newAuthority.publicKey,
      walletPda: newWalletPDA,
    })
    .signers([])
    .rpc();

 });
});
