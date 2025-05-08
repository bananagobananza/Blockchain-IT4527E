const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Group7Token – Lab-2 sale campaign", function () {
  /* ----------------------------------------------------- */
  /*  Constants                                             */
  /* ----------------------------------------------------- */
  const DECIMALS     = 18n;
  const ONE_TOKEN    = 10n ** DECIMALS;      // 1.0 token (base-units)
  const SUPPLY       = 1000n;                // “whole” tokens
  const SUPPLY_UNITS = SUPPLY * ONE_TOKEN;

  // Tiered pricing
  const TIER1_PRICE  = ethers.parseEther("5");   // 5 ETH
  const TIER2_PRICE  = ethers.parseEther("10");  // 10 ETH
  const TIER1_LIMIT  = SUPPLY / 4n;              // first 25 %
  const MAX_SOLD     = SUPPLY / 2n;              // sale cap 50 %

  let owner, buyer1, buyer2, token, provider;

  beforeEach(async () => {
    [owner, buyer1, buyer2] = await ethers.getSigners();
    const F = await ethers.getContractFactory("Group7Token");
    token   = await F.deploy(SUPPLY);
    provider = ethers.provider;
  });

  /* ----------------------------------------------------- */
  /*  1. ERC-20 basics                                      */
  /* ----------------------------------------------------- */
  it("mints total supply to owner", async () => {
    expect(await token.totalSupply()).to.equal(SUPPLY_UNITS);
    expect(await token.balanceOf(owner)).to.equal(SUPPLY_UNITS);
  });

  it("supports transfer / approve / transferFrom", async () => {
    await token.transfer(buyer1, 5n * ONE_TOKEN);
    expect(await token.balanceOf(buyer1)).to.equal(5n * ONE_TOKEN);

    await token.connect(buyer1).approve(buyer2, 2n * ONE_TOKEN);
    await token.connect(buyer2).transferFrom(buyer1, buyer2, 2n * ONE_TOKEN);
    expect(await token.balanceOf(buyer2)).to.equal(2n * ONE_TOKEN);
  });

  /* ----------------------------------------------------- */
  /*  2. Tier-1 sales (<25 %)                               */
  /* ----------------------------------------------------- */
  it("sells tokens at 5 ETH each while totalSold < 25 %", async () => {
    const qty = 3n;
    await token.connect(buyer1)
               .buyTokens({ value: qty * TIER1_PRICE });

    expect(await token.balanceOf(buyer1)).to.equal(qty * ONE_TOKEN);
    expect(await token.totalSold()).to.equal(qty * ONE_TOKEN);
  });

  /* ----------------------------------------------------- */
  /*  3. Price switch at exactly 25 %                       */
  /* ----------------------------------------------------- */
  it("switches to 10 ETH price after first 25 % sold", async () => {
    // Fill Tier-1 exactly
    await token.connect(buyer1)
               .buyTokens({ value: TIER1_LIMIT * TIER1_PRICE });

    // 5 ETH is now too low
    await expect(
      token.connect(buyer1).buyTokens({ value: TIER1_PRICE })
    ).to.be.revertedWith("Insufficient ETH sent");

    // 10 ETH works
    await token.connect(buyer1).buyTokens({ value: TIER2_PRICE });
    expect(await token.balanceOf(buyer1))
      .to.equal((TIER1_LIMIT + 1n) * ONE_TOKEN);
  });

  /* ----------------------------------------------------- */
  /*  4. Stop after 50 %                                   */
  /* ----------------------------------------------------- */
  it("rejects further purchases once 50 % supply sold", async () => {
    await token.connect(buyer1)
               .buyTokens({ value: MAX_SOLD * TIER1_PRICE });

    expect(await token.totalSold()).to.equal(MAX_SOLD * ONE_TOKEN);

    await expect(
      token.connect(buyer2).buyTokens({ value: TIER2_PRICE })
    ).to.be.revertedWith("All tokens sold");
  });

  /* ----------------------------------------------------- */
  /*  5. Refund over-payment (“dust”)                      */
  /* ----------------------------------------------------- */
  it("refunds ETH that doesn’t purchase a whole token", async () => {
    const overpay      = TIER1_PRICE + ethers.parseEther("1"); // 6 ETH
    const contractPrev = ethers.toBigInt(
                            await provider.getBalance(token.target)
                         );

    await token.connect(buyer1).buyTokens({ value: overpay });

    const contractNow = ethers.toBigInt(
                           await provider.getBalance(token.target)
                        );

    // Contract should have kept only 5 ETH
    expect(contractNow - contractPrev).to.equal(TIER1_PRICE);
    expect(await token.balanceOf(buyer1)).to.equal(ONE_TOKEN);
  });

  /* ----------------------------------------------------- */
  /*  6. 30-day time-out                                   */
  /* ----------------------------------------------------- */
  it("ends token sale after 30 days", async () => {
    await provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);
    await provider.send("evm_mine");

    await expect(
      token.connect(buyer1).buyTokens({ value: TIER1_PRICE })
    ).to.be.revertedWith("Sale ended");
  });

  /* ----------------------------------------------------- */
  /*  7. Fallback receive()                                */
  /* ----------------------------------------------------- */
  it("allows plain ETH transfer to invoke buyTokens()", async () => {
    await buyer1.sendTransaction({ to: token.target, value: TIER1_PRICE });
    expect(await token.balanceOf(buyer1)).to.equal(ONE_TOKEN);
  });

  /* ----------------------------------------------------- */
  /*  8. Owner withdraws proceeds                          */
  /* ----------------------------------------------------- */
  it("lets the owner withdraw ETH proceeds", async () => {
    const cost = 10n * TIER1_PRICE;
    await token.connect(buyer1).buyTokens({ value: cost });

    // Contract holds `cost` wei
    expect(await provider.getBalance(token.target)).to.equal(cost);

    // Withdraw
    await token.withdrawETH();

    // Contract balance now zero
    expect(await provider.getBalance(token.target)).to.equal(0n);
  });
});
