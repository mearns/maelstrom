/* eslint-env mocha */
/* eslint no-unused-expressions:0 */  // for expect magic.

// Module under test
import {newResourcePool} from '../../src/resource-pool'

// Support
import chai, {expect} from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinonChai from 'sinon-chai'
import R from 'ramda'
import LFSR from 'lfsr'
import Promise from 'bluebird'
import {newTransientRepo} from '../../src/repo'
import 'babel-polyfill'
import {FailedToCreateReservationError} from '../../src/errors'
import {Queue} from 'queue-as-promised'

chai.use(chaiAsPromised)
chai.use(sinonChai)

function range (end) {
  return R.range(0, end)
}

function newResourcePoolRepo () {
  const repo = newTransientRepo()
  repo.createPoolRepo({poolId: 'test-pool'})
  return repo.getPoolRepo('test-pool')
}

function expectQueueIsNotBlocked (queue, timeout = 10) {
  return queue.enqueue(() => {})
    .timeout(timeout, 'Expected queue to not be blocked')
}

describe('resource-pool.js', () => {
  it('should satisfy requests against a pool with a single resource that no one is waiting for @slow', () => {
    // given
    const queueFactory = new MockQueueFactory()
    const poolUnderTest = newResourcePool({
      repo: newResourcePoolRepo(),
      queueFactory: queueFactory.getFactory()
    })
    return poolUnderTest.addResource()
      .then((onlyResourceId) => {
        // when
        const p = poolUnderTest.requestResourceReservation()

        // then
        return p.then(requestId => {
          return poolUnderTest.whenAcquired(requestId)
            .then(({resourceId}) => {
              expect(resourceId, 'Unexpected resource granted').to.equal(onlyResourceId)
            })
            .finally(() => poolUnderTest.release(requestId))
            .then(() => expectQueueIsNotBlocked(queueFactory.queues[0]))
        })
      })
  })

  it('should free both resource queues when a single request completes in a pool with two resources', () => {
    // given
    const queueFactory = new MockQueueFactory()
    const poolUnderTest = newResourcePool({
      repo: newResourcePoolRepo(),
      queueFactory: queueFactory.getFactory()
    })
    Promise.all([
      poolUnderTest.addResource(),
      poolUnderTest.addResource()
    ])
      .then(resourceIds => {
        // when
        const p = poolUnderTest.requestResourceReservation()

        // then
        return p.then(requestId => {
          return poolUnderTest.whenAcquired(requestId)
            .then(({resourceId}) => {
              expect(resourceId).to.be.oneOf(resourceIds)
            })
            .finally(() => poolUnderTest.release(requestId))
            .then(() => Promise.map(queueFactory.queues, expectQueueIsNotBlocked))
        })
      })
  })

  it('should handle a bunch of requests for a bunch of resources @slow', () => {
    // given
    const queueFactory = new MockQueueFactory()
    const poolUnderTest = newResourcePool({
      repo: newResourcePoolRepo(),
      queueFactory: queueFactory.getFactory()
    })
    const prng = new LFSR(10, 137)
    const resourcesUsed = new Set()
    let promiseCount = 0
    let tasksCompleted = 0
    const task = ({requestId, resourceId}) => {
      resourcesUsed.add(resourceId)
      return Promise.delay(prng.seq(3))
        .then(() => {
          tasksCompleted++
        })
    }
    function buildPromiseTree (maxDepth) {
      if (maxDepth <= 0) {
        return
      }
      const breadth = 1 + prng.seq(3)
      promiseCount += 1
      return poolUnderTest.requestResourceReservation({})
        .then(requestId => {
          return poolUnderTest.whenAcquired(requestId)
            .then(args => Promise.join(
                task(args).finally(() => poolUnderTest.release(requestId)),
                Promise.all(range(breadth).map(() => buildPromiseTree(maxDepth - 1)))
            ))
        })
    }

    // when
    return Promise.map(range(10), () => poolUnderTest.addResource())
      .then((resourceIds) => new Set(resourceIds))
      .then(resourceIds => {
        const promiseTree = buildPromiseTree(5)

        // then
        return promiseTree
          .then(() => {
            expect(tasksCompleted, 'Wrong number to completed tasks').to.equal(promiseCount)
            resourcesUsed.forEach((usedId) => {
              expect(resourceIds, 'Used an unexpected resource ID').to.include(usedId)
            })
            return Promise.map(queueFactory.queues, expectQueueIsNotBlocked)
          })
      })
  })

  it('should transition request state from through acquired and completed correctly', () => {
    // given`
    const repo = newResourcePoolRepo()
    const poolUnderTest = newResourcePool({repo})
    return poolUnderTest.addResource()
      .then(() => {
        // when
        return poolUnderTest.requestResourceReservation({})
          .then(requestId => {
            return Promise.resolve()
              .then(() => {
                return expect(repo.getState(requestId)).to.eventually.equal('resource-acquired')
              })
              .finally(() => poolUnderTest.release(requestId))
              .then(() => {
                return expect(repo.getState(requestId)).to.eventually.equal('complete')
              })
          })
      })
  })

  it('should keep request state in waiting until resource is available', () => {
    // given`
    const repo = newResourcePoolRepo()
    const poolUnderTest = newResourcePool({repo})
    return poolUnderTest.addResource()
      .then(() => {
        return poolUnderTest.requestResourceReservation({})
          .then((blockerRequestId) => {
            return poolUnderTest.requestResourceReservation({})
              .then((waitingRequestId) => {
                return expect(repo.getState(waitingRequestId)).to.eventually.equal('waiting')
                  .then(() => poolUnderTest.whenAcquired(blockerRequestId))
                  .then(() => expect(repo.getState(blockerRequestId)).to.eventually.equal('resource-acquired'))
                  .then(() => expect(repo.getState(waitingRequestId)).to.eventually.equal('waiting'))
                  .then(() => Promise.delay(1))
                  .then(() => poolUnderTest.release(blockerRequestId))
                  .then(() => expect(repo.getState(blockerRequestId)).to.eventually.equal('complete'))
                  .then(() => poolUnderTest.whenAcquired(waitingRequestId))
                  .then(() => expect(repo.getState(waitingRequestId)).to.eventually.equal('resource-acquired'))
                  .finally(() => poolUnderTest.release(waitingRequestId))
                  .then(() => expect(repo.getState(waitingRequestId)).to.eventually.equal('complete'))
              })
              .finally(() => poolUnderTest.release(blockerRequestId))
          })
      })
  })

  it('should reject if request fails to create', () => {
    // given
    const repo = newResourcePoolRepo()
    const poolUnderTest = newResourcePool({repo})
    repo.createReservation = () => {
      throw new Error('test-error')
    }

    return poolUnderTest.addResource()
      .then(() => {
        // expect
        return expect(poolUnderTest.requestResourceReservation({})).to.be.rejectedWith(FailedToCreateReservationError)
      })
  })
})

class MockQueueFactory {
  constructor () {
    this.queues = []
  }

  getFactory () {
    return this.create.bind(this)
  }

  create () {
    const q = new Queue()
    this.queues.push(q)
    return q
  }
}
