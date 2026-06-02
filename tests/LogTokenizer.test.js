import { describe, it, expect, beforeEach } from 'vitest'
import { LogTokenizer } from '../src/raw-log/LogTokenizer.js'

describe('LogTokenizer.tokenize', () => {
  let tokenizer

  beforeEach(() => {
    tokenizer = new LogTokenizer()
  })

  it('returns a single text token for plain text', () => {
    const tokens = tokenizer.tokenize('hello world')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toEqual({ type: 'text', value: 'hello world' })
  })

  it('detects IPv4 addresses', () => {
    const tokens = tokenizer.tokenize('SRC=192.168.1.100 DST=10.0.0.1')
    const ipTokens = tokens.filter(t => t.type === 'ip')
    expect(ipTokens.map(t => t.value)).toContain('192.168.1.100')
    expect(ipTokens.map(t => t.value)).toContain('10.0.0.1')
  })

  it('detects URLs', () => {
    const tokens = tokenizer.tokenize('see https://example.com/path for details')
    const urlTokens = tokens.filter(t => t.type === 'url')
    expect(urlTokens.length).toBeGreaterThan(0)
    expect(urlTokens[0].value).toBe('https://example.com/path')
  })

  it('detects MD5-like hashes (32 hex chars)', () => {
    const hash = 'a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6'
    const tokens = tokenizer.tokenize(`MD5=${hash}`)
    const hashTokens = tokens.filter(t => t.type === 'hash')
    expect(hashTokens.map(t => t.value)).toContain(hash)
  })

  it('detects SHA256-like hashes (64 hex chars)', () => {
    const hash = 'a'.repeat(64)
    const tokens = tokenizer.tokenize(`SHA256=${hash}`)
    const hashTokens = tokens.filter(t => t.type === 'hash')
    expect(hashTokens.map(t => t.value)).toContain(hash)
  })

  it('handles mixed content', () => {
    const log = '2026-01-01T10:00:00Z host kernel: SRC=192.168.1.1 DST=10.0.0.1 URL=https://evil.com MD5=deadbeef12345678deadbeef12345678'
    const tokens = tokenizer.tokenize(log)
    const types = tokens.map(t => t.type)
    expect(types).toContain('ip')
    expect(types).toContain('url')
    expect(types).toContain('hash')
    expect(types).toContain('text')
  })

  it('returns text token for empty input', () => {
    const tokens = tokenizer.tokenize('')
    expect(tokens).toEqual([{ type: 'text', value: '' }])
  })
})
