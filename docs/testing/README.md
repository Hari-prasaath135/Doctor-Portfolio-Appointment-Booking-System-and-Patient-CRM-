# Backend test scripts

The historical phase-specific smoke/integration scripts are currently kept under `src/` and are not part of a standard test-runner suite. They may call Firebase or provider services and should only be executed in a configured test environment.

Before adding them to automated CI, isolate external dependencies behind mocks and make each script safe to run without real patient records or live payment credentials. The CI workflow currently runs a TypeScript compile check; it does not claim that provider-backed end-to-end scenarios have passed.
