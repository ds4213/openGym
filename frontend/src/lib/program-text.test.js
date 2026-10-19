import { beforeEach, describe, expect, it } from 'vitest'
import { _setLangState } from './i18n-core.js'
import { programText } from './program-text.js'

describe('programText', () => {
  beforeEach(() => _setLangState('en', {}, null, null, true, false))

  it('uses English as the fallback and fills values', () => {
    expect(programText('{0} KeyLifts programs', 498)).toBe('498 KeyLifts programs')
  })

  it('follows the openGym language for Chinese', () => {
    _setLangState('zh', {}, null, null, true, false)
    expect(programText('{0} KeyLifts programs', 498)).toBe('498 个 KeyLifts 训练计划')
    _setLangState('zh-TW', {}, null, null, true, false)
    expect(programText('Community')).toBe('社群')
  })
})
