
class IncrementingIdSupplier {
  constructor () {
    this.nextId = 0
  }

  get () {
    const id = this.nextId
    this.nextId++
    return String(id)
  }
}

export function newIdSupplier () {
  const supplier = new IncrementingIdSupplier()
  return {
    get: supplier.get.bind(supplier)
  }
}
