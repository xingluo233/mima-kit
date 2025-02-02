import type { Hash, KeyHash, KeyHashDescription } from '../core/hash'
import { createKeyHash } from '../core/hash'
import { joinBuffer } from '../core/utils'

function _hmac(hash: Hash, K: Uint8Array, M: Uint8Array) {
  const { BLOCK_SIZE } = hash

  const K0 = new Uint8Array(BLOCK_SIZE)
  K0.set(K.length > BLOCK_SIZE ? hash(K) : K)
  const iPad = K0.map(byte => (byte ^ 0x36))
  const oPad = K0.map(byte => (byte ^ 0x5C))

  const innerBuffer = hash(joinBuffer(iPad, M))
  const outerBuffer = hash(joinBuffer(oPad, innerBuffer))

  return outerBuffer
}

/**
 * FIPS.198-1: 散列消息认证码 (HMAC).
 * 如果 `d_size` 大于散列算法的摘要大小, 则回退到散列算法的摘要大小.
 *
 * FIPS.198-1: The Keyed-Hash Message Authentication Code (HMAC).
 * If `d_size` is larger than the hash algorithm's digest size, fallback to the hash algorithm's digest size.
 *
 * @param {Hash} hash - 散列算法 / hash algorithm
 * @param {number} [d_size] - 摘要大小 (bit) / digest size (bit)
 * @param {number} [k_size] - 推荐密钥大小 (bit) / recommended key size (bit)
 */
export function hmac(hash: Hash, d_size?: number, k_size?: number): KeyHash {
  const { ALGORITHM, BLOCK_SIZE, DIGEST_SIZE } = hash
  d_size = d_size ? Math.min(d_size >> 3, DIGEST_SIZE) : DIGEST_SIZE
  k_size = k_size ? k_size >> 3 : DIGEST_SIZE
  const description: KeyHashDescription = {
    ALGORITHM: `HMAC-${ALGORITHM}-${d_size << 3}`,
    BLOCK_SIZE,
    DIGEST_SIZE: d_size,
    KEY_SIZE: k_size,
  }
  return createKeyHash(
    (K: Uint8Array, M: Uint8Array) => _hmac(hash, K, M).slice(0, d_size),
    description,
  )
}
