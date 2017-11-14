/* eslint-env mocha */
/* eslint no-unused-expressions:0 */  // for expect magic.

// Module under test
import {newResoucePool} from '../../src/resource-pool'

// Support
import chai, {expect} from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinonChai from 'sinon-chai'
import sinon from 'sinon'
import R from 'ramda'
import LFSR from 'lfsr'
import Promise from 'bluebird'

chai.use(chaiAsPromised)
chai.use(sinonChai)

function range(end) {
  return R.range(0, end)
}

const noop = () => {}

describe('resource-pool.js', () => {
  it('should satisfy requests against a pool with a single resource that no one is waiting for', () => {
    // given
    const poolUnderTest = newResoucePool()
    const onlyResourceId = poolUnderTest.addResource()
    const taskSpy = sinon.spy()

    // when
    const p = poolUnderTest.requestResource(null, taskSpy)

    // then
    return p.then(() => {
      expect(taskSpy).to.have.been.calledWith(onlyResourceId)
    })
  })

  it('should handle a bunch of requests for a bunch of resources @slow', () => {
    // given
    const poolUnderTest = newResoucePool()
    const resourcesIds = new Set(range(10).map((i) => poolUnderTest.addResource()))
    const prng = new LFSR(10, 137)
    const resourcesUsed = new Set()
    let promiseCount = 0
    let tasksCompleted = 0
    const task = (resourceId) => {
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
      const currentLevel = poolUnderTest.requestResource(null, task)
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
})
