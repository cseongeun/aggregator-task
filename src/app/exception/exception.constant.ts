export enum EXCEPTION_LEVEL {
  NORMAL = 'NORMAL',
  PANIC = 'PANIC',
}

export enum EXCEPTION_CODE {
  ERR1000 = 'Not found scheduler',
  ERR1001 = 'Unknown exception',
  ERR1002 = 'missing response',
  ERR1003 = 'ETIMEDOUT',
  ERR1004 = 'could not detect network',
  ERR1005 = 'Expected rpc error',
  ERR1006 = 'Validation error',
  ERR1007 = 'missing revert data in call exception',
  ERR1008 = 'Too many connections',
  ERR1009 = 'Too Many Requests', // url: 'https://rpc-mainnet.maticvigil.com/', RPC request rate limit
  ERR1010 = 'processing response error',
  ERR1011 = 'underlying network changed', // avalanche node<https://api.avax.network/ext/bc/C/rpc>

  // Custom Error
  ERR2000 = 'chain link oracle type requires "feed" in oracle data', // token-price chain Link oracle
  ERR2001 = 'nft task requires "path" in task config', // nft image or animation path
}
