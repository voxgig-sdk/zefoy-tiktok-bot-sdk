
import { inspect } from 'node:util'

import { ProjectNameEntityBase } from '../ProjectNameEntityBase'

import type {
  ProjectNameSDK,
} from '../ProjectNameSDK'


import type {
  Operation,
  Context,
  Control,
} from '../types'

// #TypeImports


// TODO: needs Entity superclass
class EntityNameEntity extends ProjectNameEntityBase<EntityName> {

  constructor(client: ProjectNameSDK, entopts: any) {
    super(client, entopts)
    this.name = 'entityname'
    this.name_ = 'entityname'
    this.Name = 'EntityName'
  }


  make(this: EntityNameEntity) {
    return new EntityNameEntity(this._client, this.entopts())
  }


  // #LoadOp

  // #ListOp

  // #CreateOp

  // #UpdateOp

  // #RemoveOp

}


export {
  EntityNameEntity
}
