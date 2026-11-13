# Architecture Decision Records

Each file records one decision: the context, what we chose, what it costs, and what we rejected.
The first set (0001–0012) comes from a questionnaire answered on 2026-10-10, before any code was written.
The question ids in each record (A1, B2 …) refer to that questionnaire, which isn't published. "Track A" is
this bare template and "Track B" a later Expo version sharing its `src/` ([0001](0001-scope-and-two-tracks.md)).

| ADR | Title | Status |
| --- | --- | --- |
| [0000](0000-record-decisions.md) | Record architecture decisions | Accepted |
| [0001](0001-scope-and-two-tracks.md) | Scope, audience and the two-track plan | Accepted |
| [0002](0002-native-baseline.md) | Native baseline: RN 0.87, pure bare | Accepted |
| [0003](0003-package-manager-and-supply-chain.md) | pnpm and supply-chain policy | Accepted |
| [0004](0004-environments-and-config.md) | Environments and configuration | Accepted |
| [0005](0005-architecture-and-boundaries.md) | Folder architecture and import boundaries | Accepted |
| [0006](0006-state-data-and-offline.md) | State, data layer and offline | Accepted |
| [0007](0007-navigation.md) | Navigation | Accepted |
| [0008](0008-ui-system.md) | UI system | Accepted |
| [0009](0009-forms-and-i18n.md) | Forms and i18n | Accepted |
| [0010](0010-production-modules-and-firebase.md) | Production modules and the Firebase suite | Accepted |
| [0011](0011-developer-tooling.md) | Developer tooling, docs and agents | Accepted |
| [0012](0012-testing-and-delivery.md) | Testing, CI and delivery | Accepted |
| [0013](0013-agent-device-tools.md) | Agent device tools: agent-device by default, Argent for profiling | Accepted |
| [0014](0014-opt-in-native-ci.md) | Native CI builds are opt-in | Accepted |
| [0015](0015-name-bareship.md) | The template is named Bareship | Accepted |
| [0016](0016-website-on-a-subdomain.md) | The website lives on a subdomain for now | Accepted |
| [0017](0017-languages-hindi-and-opt-in-rtl.md) | Ship English and Hindi; right-to-left is a switch per language | Accepted |
| [0018](0018-create-bareship.md) | A one-command installer: `create-bareship` | Accepted |
| [0019](0019-logo-sail-b.md) | The logo is a boat whose mainsail is a B | Accepted |
| [0020](0020-sign-in-with-apple-and-google.md) | Sign in with Apple and Google behind a port | Accepted |

New ADRs copy [template.md](template.md). Never edit an accepted ADR's decision; supersede it with a new one.
