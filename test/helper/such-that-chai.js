
export function suchThatChai (chai, utils) {
  const Assertion = chai.Assertion
  Assertion.addMethod('suchThat', function (suchThat) {
    const it = {should: chai.expect(this._obj)}
    suchThat(it)
  })
}
