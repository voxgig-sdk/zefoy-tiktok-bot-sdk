

// Station self-registration (voxgig/station design §6.2, path 1): linking
// this package is the whole bootstrap. When the station library is
// installed beside this SDK, the {construct, config} factory pair is
// registered under the api slug (config.main.slug, the descriptor slug) at
// module init, so `station.sdk('<name>')` needs no imports in application
// code. Registration is SOFT — the station library is a peer dependency of
// the station feature, and a project without it skips registration and
// gets exactly the SDK it always had. Only a genuine module-not-found is
// swallowed: a station that RESOLVES but throws while loading must
// propagate (a silently empty factory table has no visible cause), and so
// must station_factory_conflict — two different builds of one SDK in one
// process is not a thing to pick between quietly.
let stationInstalled = true
try { require.resolve('STATIONPKG') }
catch (err: any) {
  // MODULE_NOT_FOUND is the absent case. Anything else - an invalid
  // package config, a root entry the package does not export - is a
  // real failure to load a station that IS installed, and swallowing
  // it would leave an empty factory table with no visible cause.
  if ('MODULE_NOT_FOUND' !== err?.code) { throw err }
  stationInstalled = false
}

if (stationInstalled) {
  const { provide } = require('STATIONPKG')
  // A station library predating the factory table has no provide() —
  // there is nothing to register with, which is not this SDK's error.
  if ('function' === typeof provide) {
    provide(config.main.slug, {
      construct: (options?: any) => new ProjectNameSDK(options),
      config,
    })
  }
}
