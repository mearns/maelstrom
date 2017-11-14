
class IncrementingIdSupplier {
  constructor () {
    this.nextId = 0
  }

  get () {
    const id = this.nextId
    this.nextId++
    return id
  }
}

export function getIdSupplier () {
  const supplier = new IncrementingIdSupplier()
  return {
    get: supplier.get.bind(supplier)
  }
}
