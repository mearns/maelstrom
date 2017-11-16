/* eslint-env mocha */
/* eslint no-unused-expressions:0 */  // for expect magic.

// Module under test
import {newResourcePool} from '../../src/resource-pool'

// Support
import chai, {expect} from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinonChai from 'sinon-chai'
import sinon from 'sinon'
import R from 'ramda'
import LFSR from 'lfsr'
import Promise from 'bluebird'
import {newTransientRepo} from '../../src/repo'
import 'babel-polyfill'
import {FailedToCreateRequestError} from '../../src/errors'

chai.use(chaiAsPromised)
chai.use(sinonChai)

function range (end) {
  return R.range(0, end)
}

function newResourcePoolRepo () {
  const repo = newTransientRepo()
  repo.addPool({id: 'test-pool'})
  return repo.getPoolRepo('test-pool')
}

describe('resource-pool.js', () => {
  it('should satisfy requests against a pool with a single resource that no one is waiting for', () => {
    // given
    const poolUnderTest = newResourcePool({repo: newResourcePoolRepo()})
    const onlyResourceId = poolUnderTest.addResource()
    const taskSpy = sinon.spy()

    // when
    const p = poolUnderTest.requestResource({}, taskSpy)

    // then
    return p.then(() => {
      expect(taskSpy).to.have.been.calledWith(sinon.match({resourceId: onlyResourceId}))
    })
  })

  it('should handle a bunch of requests for a bunch of resources @slow', () => {
    // given
    const poolUnderTest = newResourcePool({repo: newResourcePoolRepo()})
    const resourcesIds = new Set(range(10).map((i) => poolUnderTest.addResource()))
    const prng = new LFSR(10, 137)
    const resourcesUsed = new Set()
    let promiseCount = 0
    let tasksCompleted = 0
    const task = ({resourceId}) => {
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
      const currentLevel = poolUnderTest.requestResource({}, task)
      promiseCount += 1
      return currentLevel.then(() => {
        return Promise.all(range(breadth).map(() => buildPromiseTree(maxDepth - 1)))
      })
    }

    // when
    const promiseTree = buildPromiseTree(5)

    // then
    return promiseTree
      .then(() => {
        expect(tasksCompleted).to.equal(promiseCount)
        resourcesUsed.forEach((usedId) => {
          expect(resourcesIds).to.include(usedId)
        })
      })
  })

  it('should transition request state from through acquired and completed correctly', () => {
    // given`
    const repo = newResourcePoolRepo()
    const poolUnderTest = newResourcePool({repo})
    poolUnderTest.addResource()

    // when
    const p = poolUnderTest.requestResource({}, () => {
      expect(repo.getRequestState(p.requestId)).to.equal('resource-acquired')
    })

    // then
    return p
      .then(() => {
        expect(repo.getRequestState(p.requestId)).to.equal('complete')
      })
  })

  it('should keep request state in waiting until resource is available', () => {
    // given`
    const repo = newResourcePoolRepo()
    const poolUnderTest = newResourcePool({repo})
    poolUnderTest.addResource()
    let p

    const blocker = poolUnderTest.requestResource({}, () => new Promise((resolve, reject) => {
      expect(repo.getRequestState(p.requestId)).to.equal('waiting')
      setImmediate(resolve)
    }))

    // when
    p = poolUnderTest.requestResource({}, () => {
      expect(repo.getRequestState(blocker.requestId)).to.equal('complete')
      expect(repo.getRequestState(p.requestId)).to.equal('resource-acquired')
    })

    // then
    expect(repo.getRequestState(p.requestId)).to.equal('waiting')
    return Promise.join(blocker, p)
  })

  it('should reject and set request state to failed if all reservations fail to be created', () => {
    // given
    const repo = newResourcePoolRepo()
    const taskSpy = sinon.spy()
    const poolUnderTest = newResourcePool({repo})
    poolUnderTest.addResource()
    poolUnderTest.addResource()
    poolUnderTest.addResource()
    repo.addReservation = () => {
      throw new Error('test-error')
    }

    // when
    const p = poolUnderTest.requestResource({}, taskSpy)

    // then
    return expect(p).to.be.rejected
      .then(() => {
        expect(taskSpy).to.not.have.been.called
        expect(repo.getRequestState(p.requestId)).to.equal('failed')
      })
  })

  it('should reject if request fails to create', () => {
    // given
    const repo = newResourcePoolRepo()
    const taskSpy = sinon.spy()
    const poolUnderTest = newResourcePool({repo})
    poolUnderTest.addResource()
    repo.createRequest = () => {
      throw new Error('test-error')
    }

    // when
    const p = poolUnderTest.requestResource({}, taskSpy)

    // then
    return expect(p).to.be.rejectedWith(FailedToCreateRequestError)
      .then(() => {
        expect(taskSpy).to.not.have.been.called
      })
  })
})
