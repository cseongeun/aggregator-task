/**
 * TASK ID 선언 방식
 *
 *   [Protocol]_[NETWORK]_[TASK_TYPE]
 *
 *   1)하나의 단어는 - 로 연결
 *
 *  */

export enum TASK_ID {
  // aave
  AAVE_AVALANCHE_LENDING = 'AAVE_AVALANCHE_LENDING',
  AAVE_POLYGON_LENDING = 'AAVE_POLYGON_LENDING',

  // air nft
  AIR_NFT_BINANCE_SMART_CHAIN_NFT = 'AIR-NFT_BINANCE-SMART-CHAIN_NFT',

  // ape swap
  APE_SWAP_BINANCE_SMART_CHAIN_DEX = 'APE-SWAP_BINANCE-SMART-CHAIN_DEX',
  APE_SWAP_BINANCE_SMART_CHAIN_FARM = 'APE-SWAP_BINANCE-SMART-CHAIN_FARM',
  APE_SWAP_BINANCE_SMART_CHAIN_NFT = 'APE-SWAP_BINANCE-SMART-CHAIN_NFT',

  APE_SWAP_POLYGON_DEX = 'APE-SWAP_POLYGON_DEX',
  APE_SWAP_POLYGON_FARM = 'APE-SWAP_POLYGON_FARM',

  // auto farm
  AUTO_FARM_BINANCE_SMART_CHAIN_FARM = 'AUTO-FARM_BINANCE-SMART-CHAIN_FARM',

  // bakery swap
  BAKERY_SWAP_BINANCE_SMART_CHAIN_DEX = 'BAKERY-SWAP_BINANCE-SMART-CHAIN_DEX',
  BAKERY_SWAP_BINANCE_SMART_CHAIN_FARM = 'BAKERY-SWAP_BINANCE-SMART-CHAIN_FARM',

  // bi swap
  BI_SWAP_BINANCE_SMART_CHAIN_DEX = 'BI-SWAP_BINANCE-SMART-CHAIN_DEX',
  BI_SWAP_BINANCE_SMART_CHAIN_FARM = 'BI-SWAP_BINANCE-SMART-CHAIN_FARM',

  // klay swap
  KLAY_SWAP_KLAYTN_DEX = 'KLAY-SWAP_KLAYTN_DEX',

  // mdex
  MDEX_BINANCE_SMART_CHAIN_DEX = 'MDEX_BINANCE-SMART-CHAIN_DEX',
  MDEX_BINANCE_SMART_CHAIN_FARM = 'MDEX_BINANCE-SMART-CHAIN_FARM',

  MDEX_HECO_DEX = 'MDEX_HECO_DEX',
  MDEX_HECO_FARM = 'MDEX_HECO_FARM',

  // pancake swap
  PANCAKE_SWAP_BINANCE_SMART_CHAIN_DEX = 'PANCAKE-SWAP_BINANCE-SMART-CHAIN_DEX',
  PANCAKE_SWAP_BINANCE_SMART_CHAIN_FARM = 'PANCAKE-SWAP_BINANCE-SMART-CHAIN_FARM',
  PANCAKE_SWAP_BINANCE_SMART_CHAIN_FARM_2 = 'PANCAKE-SWAP_BINANCE-SMART-CHAIN_FARM-2',
  PANCAKE_SWAP_BINANCE_SMART_CHAIN_NFT = 'PANCAKE-SWAP_BINANCE-SMART-CHAIN_NFT',
  PANCAKE_SWAP_BINANCE_SMART_CHAIN_NFT_2 = 'PANCAKE-SWAP_BINANCE-SMART-CHAIN_NFT-2',
  PANCAKE_SWAP_BINANCE_SMART_CHAIN_NFT_3 = 'PANCAKE-SWAP_BINANCE-SMART-CHAIN_NFT-3',
  PANCAKE_SWAP_BINANCE_SMART_CHAIN_NFT_4 = 'PANCAKE-SWAP_BINANCE-SMART-CHAIN_NFT-4',
  PANCAKE_SWAP_BINANCE_SMART_CHAIN_NFT_5 = 'PANCAKE-SWAP_BINANCE-SMART-CHAIN_NFT-5',

  // quick swap
  QUICK_SWAP_POLYGON_DEX = 'QUICK-SWAP_POLYGON_DEX',
  QUICK_SWAP_POLYGON_FARM = 'QUICK-SWAP_POLYGON_FARM',
  QUICK_SWAP_POLYGON_FARM_2 = 'QUICK-SWAP_POLYGON_FARM-2',

  // sushi swap
  SUSHI_SWAP_AVALANCHE_DEX = 'SUSHI-SWAP_AVALANCHE_DEX',
  SUSHI_SWAP_BINANCE_SMART_CHAIN_DEX = 'SUSHI-SWAP_BINANCE-SMART-CHAIN_DEX',
  SUSHI_SWAP_FANTOM_DEX = 'SUSHI-SWAP_FANTOM_DEX',
  SUSHI_SWAP_POLYGON_DEX = 'SUSHI-SWAP_POLYGON_DEX',
  SUSHI_SWAP_POLYGON_FARM = 'SUSHI-SWAP_POLYGON_FARM',
  SUSHI_SWAP_HECO_DEX = 'SUSHI-SWAP_HECO_DEX',

  // terra swap
  TERRA_SWAP_TERRA_DEX = 'TERRA-SWAP_TERRA_DEX',

  // venus
  VENUS_BINANCE_SMART_CHAIN_LENDING = 'VENUS_BINANCE-SMART-CHAIN_LENDING',

  // wault swap
  WAULT_SWAP_BINANCE_SMART_CHAIN_DEX = 'WAULT-SWAP_BINANCE-SMART-CHAIN_DEX',
  WAULT_SWAP_BINANCE_SMART_CHAIN_FARM = 'WAULT-SWAP_BINANCE-SMART-CHAIN_FARM',
}
