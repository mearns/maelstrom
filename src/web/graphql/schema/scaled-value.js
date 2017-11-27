import {loadSchema} from '../schema-tools'
import Promise from 'bluebird'

const MULTIPLIERS = {
  U: {long: '', scale: 1, description: 'A single unit'},
  K: {long: 'kilo', scale: 1e3, description: 'A kilo-unit = 1,000 (thousand) units'},
  M: {long: 'mega', scale: 1e6, description: 'A mega-unit = 1,000,000 (million) units'},
  G: {long: 'giga', scale: 1e9, description: 'A giga-unit = 1e9 (billion) units'},
  T: {long: 'tera', scale: 1e12, description: 'A tera-unit = 1e12 (trillion) units'},
  P: {long: 'peta', scale: 1e15, description: 'A peta-unit = 1e15 (quadrillion) units'},
  E: {long: 'exa', scale: 1e18, description: 'An exa-unit = 1e18 units'},
  Z: {long: 'zetta', scale: 1e21, description: 'A zetta-unit = 1e21 units'},
  Y: {long: 'yotta', scale: 1e24, description: 'A yotta-unit = 1e24 units'},
  Ki: {long: 'kibi', scale: 1024, description: 'A kibi-unit = 2^10 units (1024)'},
  Mi: {long: 'mebi', scale: 1024 * 1024, description: 'A mebi-unit = 2^20 units (1024*1024)'},
  Gi: {long: 'gibi', scale: 1024 * 1024 * 1024, description: 'A gibi-unit = 2^30 units (1024^3)'},
  Ti: {long: 'tebi', scale: 1024 * 1024 * 1024 * 1024, description: 'A tebi-unit= 2^40 units'},
  Pi: {long: 'pebi', scale: 1024 * 1024 * 1024 * 1024 * 1024, description: 'A pebi-unit = 2^50 units'},
  Ei: {long: 'exbi', scale: 1024 * 1024 * 1024 * 1024 * 1024 * 1024, description: 'An exbi-unit = 2^60 units'},
  Zi: {long: 'zebi', scale: 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024, description: 'A zebi-unit = 2^70 units'},
  Yi: {long: 'yobi', scale: 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024, description: 'A yobi-unit = 2^80 units'}
}

export class ScaledValue {
  constructor ({value, scaler}) {
    this.value = parseFloat(value)
    this.scaler = scaler === '' ? 'U' : scaler
    this._prefix = this.scaler === 'U' ? '' : this.scaler

    const multiplier = MULTIPLIERS[this.scaler]
    if (!multiplier) {
      throw new RangeError(`No such scaler multiplier known: ${scaler}`)
    }

    this.scale = multiplier.scale
    this.unitMeasure = this.value * this.scale
  }

  str ({unit, abbreviate = true, hyphenate = true, separation = ''} = {}) {
    const hasUnit = (typeof unit !== 'undefined') && unit !== ''
    const suffix = hasUnit ? unit : ''
    if (abbreviate) {
      return `${this.value}${separation}${this._prefix}${suffix}`
    }
    return `${this.value}${separation}${MULTIPLIERS[this.scaler].long}${(hyphenate && hasUnit) ? '-' : ''}${suffix}`
  }
}

export function getResolverMap () {
  return {}
}

export function getTypeDefs () {
  return Promise.all([
    loadSchema('scaled-value'),
    getScalerPrefixTypedef()
  ])
    .then((schemas) => schemas.join('\n\n'))
}

function getScalerPrefixTypedef () {
  return `
    enum ScalerPrefix {
      ${Object.keys(MULTIPLIERS).map((prefix) => {
        const {description} = MULTIPLIERS[prefix]
        return `  # ${description}\n  ${prefix}\n`
      }).join('\n')}
    }`
}
