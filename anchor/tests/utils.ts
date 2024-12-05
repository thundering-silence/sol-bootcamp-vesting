import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMint2Instruction,
  createMintToInstruction,
} from "@solana/spl-token";
import { Signer, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { BankrunProvider } from "anchor-bankrun";

// incompatible package versions require some workarounds
export async function createMint(
  provider: BankrunProvider,
  payer: Signer,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number
) {
  const keypair = Keypair.generate();
  const programId = TOKEN_PROGRAM_ID;

  const lamports = Number(
    (await provider.context.banksClient.getRent()).minimumBalance(
      BigInt(MINT_SIZE)
    )
  );

  const latestBlockHashResult =
    await provider.context.banksClient.getLatestBlockhash("confirmed");
  const recentBlockhash = latestBlockHashResult ? latestBlockHashResult[0] : "";

  const txMsg = new anchor.web3.TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash,
    instructions: [
      // create account
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: keypair.publicKey,
        space: MINT_SIZE,
        lamports,
        programId,
      }),
      // create mint
      createInitializeMint2Instruction(
        keypair.publicKey,
        decimals,
        mintAuthority,
        freezeAuthority,
        programId
      ),
    ],
  }).compileToLegacyMessage();
  const transaction = new anchor.web3.VersionedTransaction(txMsg);

  await provider.context.banksClient.sendTransaction(transaction);
  return keypair.publicKey;
}

// incompatible package versions require some workarounds
export async function mintTo(
  provider: BankrunProvider,
  payer: Signer,
  mint: PublicKey,
  mintAuthority: PublicKey,
  to: PublicKey,
  amount: number | bigint
) {
  const latestBlockHashResult =
    await provider.context.banksClient.getLatestBlockhash("confirmed");
  const recentBlockhash = latestBlockHashResult ? latestBlockHashResult[0] : "";

  const txMsg = new anchor.web3.TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash,
    instructions: [
      // create mint
      createMintToInstruction(mint, to, mintAuthority, amount),
    ],
  }).compileToLegacyMessage();
  const transaction = new anchor.web3.VersionedTransaction(txMsg);

  return await provider.context.banksClient.processTransaction(
    transaction
  );

}
