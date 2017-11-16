import {newResourcePool} from './resource-pool'
import {PoolAlreadyExistsError, NoSuchPoolError} from './errors'

class PoolCollection {
  constructor ({repo}) {
    this.pools = {}
    this.repo = repo
  }

  hasPool (poolId) {
    return Boolean(this.pools[poolId])
  }

  getPoolIds () {
    return Object.keys(this.pools)
  }

  createPool ({poolId}) {
    if (this.pools[poolId]) {
      return Promise.reject(new PoolAlreadyExistsError(poolId))
    }
    return this.repo.createPoolRepo({poolId})
      .then((poolRepo) => {
        const resourcePool = newResourcePool({repo: poolRepo})
        this.pools[poolId] = resourcePool
        return resourcePool
      })
  }

  getPool (poolId) {
    const pool = this.pools[poolId]
    if (!pool) {
      throw new NoSuchPoolError(poolId)
    }
    return pool
  }
}

export function newPoolCollection ({repo}) {
  const obj = new PoolCollection({repo})
  return {
    createPool: obj.createPool.bind(obj),
    getPool: obj.getPool.bind(obj),
    getPoolIds: obj.getPoolIds.bind(obj),
    hasPool: obj.hasPool.bind(obj)
  }
}
