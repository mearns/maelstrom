import {loadSchema} from '../schema-tools'
import Promise from 'bluebird'

const MULTIPLIERS = {
  U: {scale: 1, description: 'A single unit'},
  K: {scale: 1e3, description: 'A kilo-unit = 1,000 (thousand) units'},
  M: {scale: 1e6, description: 'A mega-unit = 1,000,000 (million) units'},
  G: {scale: 1e9, description: 'A giga-unit = 1e9 (billion) units'},
  T: {scale: 1e12, description: 'A tera-unit = 1e12 (trillion) units'},
  P: {scale: 1e15, description: 'A peta-unit = 1e15 (quadrillion) units'},
  E: {scale: 1e18, description: 'An exa-unit = 1e18 units'},
  Z: {scale: 1e21, description: 'A zetta-unit = 1e21 units'},
  Y: {scale: 1e24, description: 'A yotta-unit = 1e24 units'},
  Ki: {scale: 1024, description: 'A kibi-unit = 2^10 units (1024)'},
  Mi: {scale: 1024 * 1024, description: 'A mebi-unit = 2^20 units (1024*1024)'},
  Gi: {scale: 1024 * 1024 * 1024, description: 'A gibi-unit = 2^30 units (1024^3)'},
  Ti: {scale: 1024 * 1024 * 1024 * 1024, description: 'A tebi-unit= 2^40 units'},
  Pi: {scale: 1024 * 1024 * 1024 * 1024 * 1024, description: 'A pebi-unit = 2^50 units'},
  Ei: {scale: 1024 * 1024 * 1024 * 1024 * 1024 * 1024, description: 'An exbi-unit = 2^60 units'},
  Zi: {scale: 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024, description: 'A zebi-unit = 2^70 units'},
  Yi: {scale: 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024, description: 'A yobi-unit = 2^80 units'}
}

export class StorageSize {
  constructor ({value, unit}) {
    this.value = value

    const strippedUnit = unit.endsWith('B')
      ? unit.substring(0, unit.length - 1)
      : unit
    this.unit = strippedUnit.length === 0 ? 'U' : strippedUnit
    this.scale = MULTIPLIERS[this.unit].scale
    this.str = `${this.value}${this.unit === 'U' ? '' : this.unit}B`
    this.bytes = this.scale * this.value
  }
}

export function getResolverMap () {
  return {}
}

export function getTypeDefs () {
  return Promise.join(
    loadSchema('storage-size'),
    getMultiplierPrefixTypeDef(),
    (schema1, schema2) => `${schema1}\n${schema2}`
  )
}

function getMultiplierPrefixTypeDef () {
  return `
    enum MultiplierPrefix {
      ${Object.keys(MULTIPLIERS).map((prefix) => {
        const {description} = MULTIPLIERS[prefix]
        return `  # ${description}\n  ${prefix}\n`
      }).join('\n')}
    }`
}
