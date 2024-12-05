import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Signer,
  SystemProgram,
} from "@solana/web3.js";
import { Clock, ProgramTestContext, startAnchor } from "solana-bankrun";
import IDL from "../target/idl/tokenvesting.json";
import { Tokenvesting } from "../target/types/tokenvesting";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { BankrunProvider } from "anchor-bankrun";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { setProvider, web3 } from "@coral-xyz/anchor";
import { createMint, mintTo } from "./utils";
import { AccountLayout, getAccount } from "@solana/spl-token";
import { BN } from "bn.js";

describe("token-vesting tests", () => {
  const companyName = "solana";
  let beneficiary: Keypair;
  let employer: Keypair;

  let testContext: ProgramTestContext;
  let provider: BankrunProvider;
  let beneficiaryProvider: BankrunProvider;

  let employerProgram: anchor.Program<Tokenvesting>;
  let beneficiaryProgram: anchor.Program<Tokenvesting>;

  let mint: PublicKey;

  // PDAs
  let companyVestingAccount: PublicKey;
  let treasuryTokenAccount: PublicKey;
  let employeeVestingAccount: PublicKey;

  beforeAll(async () => {
    beneficiary = new web3.Keypair();
    employer = new web3.Keypair();

    testContext = await startAnchor(
      "",
      [
        {
          name: "tokenvesting", // must match .so filename
          programId: new PublicKey(IDL.address),
        },
      ],
      [
        {
          address: beneficiary.publicKey,
          info: {
            lamports: LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: SYSTEM_PROGRAM_ID,
            executable: false,
          },
        },
      ]
    );

    provider = new BankrunProvider(testContext);
    setProvider(provider);
    console.log(provider.connection.sendTransaction);

    employerProgram = new anchor.Program(IDL as Tokenvesting, provider);

    employer = provider.context.payer;
    console.log("fire");
    mint = await createMint(provider, employer, employer.publicKey, null, 6);

    beneficiaryProvider = new BankrunProvider(
      testContext,
      new NodeWallet(beneficiary)
    );

    beneficiaryProgram = new anchor.Program(
      IDL as Tokenvesting,
      beneficiaryProvider
    );

    [companyVestingAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(companyName)],
      employerProgram.programId
    );

    [treasuryTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("vesting_treasury"), Buffer.from(companyName)],
      employerProgram.programId
    );

    [employeeVestingAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("employee_vesting"),
        beneficiary.publicKey.toBuffer(),
        companyVestingAccount.toBuffer(),
      ],
      employerProgram.programId
    );
  });

  it("should create a company vesting account", async () => {
    await employerProgram.methods
      .createCompanyVestingAccount(companyName)
      .accounts({
        payer: employer.publicKey,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({
        commitment: "confirmed",
      });

    // console.log(`Created vesting account`);

    const vestingAccountData =
      await employerProgram.account.companyVestingAccount.fetch(
        companyVestingAccount,
        "confirmed"
      );
    // console.table(vestingAccountData);

    expect(vestingAccountData).not.toBe(null);
    expect(vestingAccountData.companyName).toEqual("solana");
    expect(vestingAccountData.owner.toString()).toBe(
      employer.publicKey.toString()
    );
    expect(vestingAccountData.mint.toString()).toBe(mint.toString());
  });

  it("should fund the treasury account", async () => {
    const amount = 10_000 * LAMPORTS_PER_SOL;
    // fund treasury
    await mintTo(
      provider,
      employer,
      mint,
      employer.publicKey,
      treasuryTokenAccount,
      amount
    );

    const treasuryAccount = await provider.context.banksClient.getAccount(
      treasuryTokenAccount
    );

    const info = AccountLayout.decode(treasuryAccount?.data!);

    expect(info.amount.toString()).toBe(amount.toString());
  });

  it("should create an employee account", async () => {
    const start = new BN(Date.now() / 1000);
    const end = new BN(Date.now() / 1000 + 24 * 3600);
    const cliff = new BN(Date.now() / 1000 + 12 * 3600);
    const total = new BN(1_000 * LAMPORTS_PER_SOL);

    await employerProgram.methods
      .createEmployeeVestingAccount(start, end, cliff, total)
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingAccount: companyVestingAccount,
      })
      .rpc({
        commitment: "confirmed",
        skipPreflight: true,
      });

    const acct = await employerProgram.account.employeeVestingAccount.fetch(
      employeeVestingAccount,
      "confirmed"
    );

    expect(acct.beneficiary.toString()).toBe(beneficiary.publicKey.toString());
    expect(acct.startTime.toString()).toBe(start.toString());
    expect(acct.endTime.toString()).toBe(end.toString());
    expect(acct.cliff.toString()).toBe(cliff.toString());
    expect(acct.totalAmount.toString()).toBe(total.toString());
    expect(acct.totalWithdrawn.toString()).toBe(new BN(0).toString());
  });

  it("should nto allow to claim before cliff", async () => {
    let error: Error;
    await beneficiaryProgram.methods
      .claimTokens(companyName)
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({
        commitment: "confirmed",
      })
      .catch((err) => (error = err));

    expect(error!).toBeTruthy();
  });

  it("should allow claim after cliff", async () => {
    const currentClock = await provider.context.banksClient.getClock();
    provider.context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        BigInt(Math.ceil(Date.now() / 1000 + 12 * 3600))
      )
    );

    await beneficiaryProgram.methods
      .claimTokens(companyName)
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({
        commitment: "confirmed",
      });

    const acct = await employerProgram.account.employeeVestingAccount.fetch(
      employeeVestingAccount,
      "confirmed"
    );

    expect(acct.totalWithdrawn.toNumber()).toBeGreaterThan(0);
  });

  it("should allow to claim all tokens", async () => {
    const currentClock = await provider.context.banksClient.getClock();
    provider.context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        BigInt(Math.ceil(Date.now() / 1000 + 24 * 3600))
      )
    );

    await beneficiaryProgram.methods
      .claimTokens(companyName)
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({
        commitment: "confirmed",
      });

    const acct = await employerProgram.account.employeeVestingAccount.fetch(
      employeeVestingAccount,
      "confirmed"
    );

    expect(acct.totalWithdrawn.toString()).toBe(
      (1_000 * LAMPORTS_PER_SOL).toString()
    );

  });


});
