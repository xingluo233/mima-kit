import type { Keccak, KeccakPermutation } from '../core/keccakUtils'
import { RCGen, Sponge } from '../core/keccakUtils'
import { rotateL8 } from '../core/utils'

// * Constants

const PERMUTATION: KeccakPermutation = {
  b: 200,
  bByte: 25,
  w: 8,
  wByte: 1,
  l: 3,
  nr: 18,
}

/**
 * FIPS.202 3.2.2
 * Algorithm 2: ρ(A) 位移表
 * 由 src/core/keccakUtils.ts 中的 RGen 函数生成
 */
const R = [
  [0, 4, 3, 1, 2],
  [1, 4, 2, 5, 2],
  [6, 6, 3, 7, 5],
  [4, 7, 1, 5, 0],
  [3, 4, 7, 0, 6],
]

/**
 * FIPS.202 3.2.5
 * RC 由 Algorithm 5: rc(t) 生成
 * 由 src/core/keccakUtils.ts 中的 RCGen 函数生成
 */
const RC = [0x80, 0x41, 0x51, 0x00, 0xD1, 0x80, 0x81, 0x90, 0x51, 0x11, 0x90, 0x50, 0xD1, 0xD1, 0x91, 0xC0, 0x40, 0x01]

// * Permutation Function

type StateArray200 = Uint8Array[]

/**
 * @description
 * create a 5x5 State Array
 * 创建一个 5x5 State Array
 */
function createStateArray(): StateArray200 {
  return Array.from({ length: 5 }).map(() => new Uint8Array(5))
}

/**
 * @description
 * Converting State to State Arrays
 * 将状态转换为状态数组
 */
function toStateArray(S: Uint8Array) {
  const A = createStateArray()
  const view = new DataView(S.buffer)

  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      A[x][y] = view.getUint8((y * 5 + x) * PERMUTATION.wByte)
    }
  }

  return A
}

/**
 * @description
 * Converting State Arrays to State
 * 将状态数组转换为状态
 */
function toState(A: StateArray200) {
  const S = new Uint8Array(PERMUTATION.bByte)
  const view = new DataView(S.buffer)

  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      view.setUint8((y * 5 + x) * PERMUTATION.wByte, A[x][y])
    }
  }

  return S
}

// * Mapping Function

/** Algorithm 1: θ(A) */
function theta(A: StateArray200) {
  const C = new Uint8Array(5)
  const D = new Uint8Array(5)

  for (let x = 0; x < 5; x++) {
    C[x] = A[x][0] ^ A[x][1] ^ A[x][2] ^ A[x][3] ^ A[x][4]
  }

  for (let x = 0; x < 5; x++) {
    D[x] = C[(x + 4) % 5] ^ rotateL8(C[(x + 1) % 5], 1)

    for (let y = 0; y < 5; y++) {
      A[x][y] = A[x][y] ^ D[x]
    }
  }

  return A
}

/** Algorithm 2: ρ(A) */
// eslint-disable-next-line unused-imports/no-unused-vars
function rho(A: StateArray200) {
  const _A = createStateArray()
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      _A[x][y] = rotateL8(A[x][y], R[x][y])
    }
  }
  return _A
}

/** Algorithm 3: π(A) */
// eslint-disable-next-line unused-imports/no-unused-vars
function pi(A: StateArray200) {
  const _A = createStateArray()
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      _A[y][(2 * x + 3 * y) % 5] = A[x][y]
    }
  }
  return _A
}

/** 合并执行 π(ρ(A)) */
function rhoPi(A: StateArray200) {
  const _A = createStateArray()
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      _A[y][(2 * x + 3 * y) % 5] = rotateL8(A[x][y], R[x][y])
    }
  }
  return _A
}

/** Algorithm 4: χ(A) */
function chi(A: StateArray200) {
  const _A = createStateArray()
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      _A[x][y] = A[x][y] ^ ((~A[(x + 1) % 5][y]) & A[(x + 2) % 5][y])
    }
  }
  return _A
}

/** Algorithm 6: ι(A, ir) */
function iota(A: StateArray200, RC: number) {
  A[0][0] = A[0][0] ^ RC
  return A
}

// * Keccak-p[200]

/**
 * @description
 * Keccak-p[200] Permutation Function
 * Keccak-p[200] 置换函数
 *
 * @param {number} nr 轮数
 */
export function Keccak_p_200(nr?: number) {
  nr = nr || PERMUTATION.nr

  // 当轮数非默认的情况下，重新生成 RC
  const _RC = nr === PERMUTATION.nr ? RC : RCGen(PERMUTATION, nr)

  /**
   * @description
   * Absorbing Function
   * 吸收函数
   *
   * @param {Uint8Array} S - 状态
   */
  return (S: Uint8Array) => {
    if (S.byteLength !== PERMUTATION.bByte) {
      throw new Error('Invalid state size')
    }

    let A = toStateArray(S)
    for (let i = 0; i < nr; i++) {
      A = iota(chi(rhoPi(theta(A))), _RC[i])
    }
    return toState(A)
  }
}

/**
 * @description
 * Keccak-p[200] Sponge Construction
 * Keccak-p[200] 海绵构造
 *
 * @param {number} rByte - 吸收量的字节长度
 * @param {Keccak} f - Keccak 置换函数
 */
export function Sponge_200(rByte: number, f: Keccak = Keccak_p_200()) {
  return Sponge(f, PERMUTATION.bByte, rByte)
}