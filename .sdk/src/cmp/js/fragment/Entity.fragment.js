
const { inspect } = require('node:util')

const { ProjectNameEntityBase } = require('../ProjectNameEntityBase')


// TODO: needs Entity superclass
class EntityNameEntity extends ProjectNameEntityBase {

  constructor(client, entopts) {
    super(client, entopts)
    this.name = 'entityname'
    this.name_ = 'entityname'
    this.Name = 'EntityName'
  }


  make() {
    return new EntityNameEntity(this._client, this.entopts())
  }


  // #LoadOp

  // #ListOp

  // #CreateOp

  // #UpdateOp

  // #RemoveOp

}


module.exports = {
  EntityNameEntity
}
