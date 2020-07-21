const path = require("path");
const dotenv = require('dotenv');
var HDWalletProvider = require("@truffle/hdwallet-provider");

const dotenvResult = dotenv.config();

if (dotenvResult.error) {
  throw dotenvResult.error;
}

const { MNEMONIC, PROVIDER_URL, INFURA_KEY } = process.env;

var infuraRinkebyProvider = `${PROVIDER_URL}${INFURA_KEY}`;

var PROVIDER = new HDWalletProvider(MNEMONIC, infuraRinkebyProvider);


module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  contracts_build_directory: path.join(__dirname, "client/src/contracts"),
  networks: {
    develop: {
      host: '127.0.0.1',
      port: 8545,
      network_id: "*",
    },
    
    rinkeby: {
      provider: PROVIDER,
      network_id: 4, // eslint-disable-line camelcase

    }
  },

  compilers: {
    solc: {
      version: "0.6.5" // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      // settings: {          // See the solidity docs for advice about optimization and evmVersion
      //  optimizer: {
      //    enabled: false,
      //    runs: 200
      //  },
      //  evmVersion: "byzantium"
      // }
    }
  }
};
