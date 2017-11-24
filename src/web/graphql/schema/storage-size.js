import {loadSchema} from '../schema-tools'

const STORAGE_UNIT_SCALE_VALUES = {
  U: 1,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
  Z: 1e21,
  Y: 1e24,
  Ki: 1024,
  Mi: 1024 * 1024,
  Gi: 1024 * 1024 * 1024,
  Ti: 1024 * 1024 * 1024 * 1024,
  Pi: 1024 * 1024 * 1024 * 1024 * 1024,
  Ei: 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
  Zi: 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
  Yi: 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024
}

export class StorageSize {
  constructor ({value, unit}) {
    this.value = value

    const strippedUnit = unit.endsWith('B')
      ? unit.substring(0, unit.length - 1)
      : unit
    this.unit = strippedUnit.length === 0 ? 'U' : strippedUnit
    this.scale = STORAGE_UNIT_SCALE_VALUES[this.unit]
    this.str = `${this.value}${this.unit === 'U' ? '' : this.unit}B`
    this.bytes = this.scale * this.value
  }
}

export function getResolverMap () {
  return {}
}

export function getTypeDefs () {
  return loadSchema('storage-size') // TODO: XXX: Auto-generate the MultiplierPrefix type from the map above.
}
