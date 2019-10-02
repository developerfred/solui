import Web3 from 'web3'
import axios from 'axios'
import { isAddress } from 'web3-utils'

import { _ } from './lodash'
import { GLOBAL_SCOPE } from './platform'

const etherscanPrefix = {
  1: 'https://etherscan.io/address/',
  3: 'https://ropsten.etherscan.io/address/',
  4: 'https://rinkeby.etherscan.io/address/',
  5: 'https://goerli.etherscan.io/address/',
  42: 'https://kovan.etherscan.io/address/',
}

const getNetworkName = id => {
  switch (id) {
    case '1':
      return 'Mainnet'
    case '3':
      return 'Ropsten'
    case '4':
      return 'Rinkeby'
    case '5':
      return 'Görli'
    case '42':
      return `Kovan`
    default:
      return 'Dev/Private'
  }
}

const _finalizeNetwork = async network => {
  network.id = `${await network.web3.eth.net.getId()}`
  network.name = getNetworkName(network.networkId)

  network.getEtherscanLink = addr => {
    if (etherscanPrefix[network.id]) {
      return `${etherscanPrefix[network.id]}${addr}`
    } else {
      return null
    }
  }
}

const DEFAULT_NETWORK = {
  askWalletOwnerForPermissionToViewAccounts: () => {}
}

export const getWeb3Instance = async url => {
  const id = await axios.post(url, {
    jsonrpc: '2.0',
    method: 'net_version',
    params: [],
    id: 69,
  })

  if (id) {
    return new Web3(new Web3.providers.HttpProvider(url))
  }

  throw new Error(`Unable to connect to network: ${url}`)
}

export const getNetworkInfoFromGlobalScope = async () => {
  try {
    const network = { ...DEFAULT_NETWORK }

    if (GLOBAL_SCOPE.ethereum) {
      network.web3 = new Web3(GLOBAL_SCOPE.ethereum)
      // See https://medium.com/metamask/https-medium-com-metamask-breaking-change-injecting-web3-7722797916a8
      if (typeof _.get(GLOBAL_SCOPE.ethereum, 'enable') === 'function') {
        network.askWalletOwnerForPermissionToViewAccounts = () => GLOBAL_SCOPE.ethereum.enable()
      }
      // From https://metamask.github.io/metamask-docs/API_Reference/Ethereum_Provider#ethereum.on(eventname%2C-callback
      // we will manually reload page on a network change
      GLOBAL_SCOPE.ethereum.autoRefreshOnNetworkChange = false
      if (GLOBAL_SCOPE.ethereum.on) {
        GLOBAL_SCOPE.ethereum.on('networkChanged', () => {
          if (typeof _.get(GLOBAL_SCOPE.location, 'reload') === 'function') {
            GLOBAL_SCOPE.location.reload()
          }
        })
      }
    } else if (GLOBAL_SCOPE.web3 && GLOBAL_SCOPE.web3.currentProvider) {
      network.web3 = new Web3(GLOBAL_SCOPE.web3.currentProvider)
    } else {
      // try local node
      try {
        network.web3 = await getWeb3Instance('http://localhost:8545')
      } catch (err) {
        console.warn(err)
      }
    }

    // if web3 not set then something failed
    if (!network.web3) {
      throw new Error('Error setting up web3')
    }

    await _finalizeNetwork(network)

    return network
  } catch (err) {
    console.error('Error fetching network info', err)

    throw err
  }
}

export const getNetworkInfo = async web3 => {
  const network = { ...DEFAULT_NETWORK, web3 }

  await _finalizeNetwork(network)

  return network
}

export const getWeb3Account = async web3 => {
  if (web3.requestPermission) {
    await web3.requestPermission()
  }

  const [ account ] = await web3.eth.getAccounts()

  if (!account) {
    throw new Error('Unable to get Ethereum address. Ensure your Ethereum wallet is properly initialized.')
  }

  return account
}

export const getBytecode = async (web3, address) => {
  const code = await web3.eth.getCode(address)
  return ('0x' === code) ? null : code
}

export const assertEthAddressIsValidOnChain = async (
  value,
  web3,
  { allowContract = true, allowEoa = true } = {}
) => {
  if (!isAddress(value)) {
    throw new Error(`must be a valid address`)
  } else {
    // do the on-chain check...
    if (!web3) {
      return
    }

    let isContract

    try {
      isContract = !!(await getBytecode(web3, value))
    } catch (err) {
      throw new Error(`unable to check for code at address: ${err.message}`)
    }


    if (isContract && !allowContract) {
      throw new Error('must not be a contract address')
    }

    if (!isContract && !allowEoa) {
      throw new Error('must be a contract address')
    }
  }
}