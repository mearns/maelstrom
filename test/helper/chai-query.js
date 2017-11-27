export function chaiQuery (chai, utils) {
  const Assertion = chai.Assertion
  Assertion.addMethod('successfulQuery', function () {
    const response = this._obj
    if (utils.flag(this, 'negate')) {
      new Assertion(response, 'Expected response to include errors').to.have.property('errors')
      new Assertion(response.errors.length, 'Expected response to have at least one error').to.not.equal(0)
      utils.flag(this, 'object', response.errors)
    } else {
      if (response.errors && response.errors.length) {
        this.assert(false, 'Expected response to not have any errors', '', [], response.errors)
      }
      new Assertion(response, 'Expected response to have a data property').to.have.property('data')
      utils.flag(this, 'object', response.data)
    }
  })
}
