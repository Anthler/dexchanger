var Dex = artifacts.require("Dex.sol");

module.exports = function(deployer) {
  deployer.deploy(Dex);
};
