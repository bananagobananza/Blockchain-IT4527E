const hre = require("hardhat");

async function main() {
  const initialSupply = 1000;

  const Token = await hre.ethers.getContractFactory("Group7Token");
  const token = await Token.deploy(initialSupply); // No .deployed()
  
  console.log(`Group7Token deployed to: ${token.target}`); // Use .target instead of .address in ethers v6
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
