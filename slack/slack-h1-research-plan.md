TARGET VERIFIED: SLACK / HACKERONE
LIVE IN-SCOPE ASSET: [`api.slack.com`, `slack.com`]
SOURCE: official HackerOne Slack policy

# Slack HackerOne research gate and H1 test plan

> Snapshot: **2026-09-24 (UTC)**. This is a pre-test research plan, not a
> vulnerability report. The live policy remains authoritative and must be
> re-checked immediately before executing the test.

This memo is target-locked. The repository's Clarity/Stacks material and any
material concerning CoW Protocol, GPv2, Veda, Robinhood, Immunefi, OnRe, XOXNO,
LaunchDarkly, or another previous target is unrelated and was not analyzed,
reused, or treated as Slack evidence. Only the live Slack scope and official
Slack documentation inform this plan.

## Target-specific hypothesis gate

No generic harness or broad “does authorization work?” loop is authorized by
this plan. Before any PoC work, a hypothesis must name all four elements:

1. a specific Slack feature;
2. a specific Slack trust boundary;
3. a specific suspected enforcement gap; and
4. a specific attacker benefit.

It must also include a concrete `WHY THIS IS SLACK-SPECIFIC` explanation. If any
element is missing, record **`REJECTED — NOT SLACK-SPECIFIC`** and do not build
or execute the test. H1 below passes this planning gate; it has not passed any
vulnerability gate.

## 1. Live policy gate

The public [Slack HackerOne program](https://hackerone.com/slack) was rendered
in a clean, logged-out browser session. The program is open, offers bounties,
and lists 19 in-scope assets (25 rows including exclusions). The policy was last
updated **2026-08-07**; the structured scope was last updated **2026-05-27**.

### Structured scope

All in-scope rows are bounty eligible and permit findings up to Critical, but
the Quip and Nebula descriptions impose a **Critical-only acceptance** rule.
“Maximum severity: Critical” does not mean that every asset is Critical-only.

| Asset | In scope? | Bounty? | Max severity | Restrictions | Interesting? |
|---|---:|---:|---:|---|---|
| `www.quip.com` | Yes | Yes | Critical | Critical reports only (since 2023-12-01) | No: poor payout odds below Critical |
| `spaces.pm` | Yes | Yes | Critical | General policy | Low |
| `slackb.com` | Yes | Yes | Critical | General policy | Low |
| `slackatwork.com` | Yes | Yes | Critical | General policy | Low |
| `slack.com` | Yes | Yes | Critical | Slack site/application | **High** |
| `slack-status.com` | Yes | Yes | Critical | General policy | Low |
| `slack-redir.net` | Yes | Yes | Critical | General policy | Low absent a substantive chain |
| `slack-imgs.com` | Yes | Yes | Critical | General policy | Medium for shared-object access only |
| Slack Desktop Application | Yes | Yes | Critical | Supported client only | Medium |
| Quip desktop executable | Yes | Yes | Critical | Critical reports only | No |
| `github.com/slackhq/nebula` | Yes | Yes | Critical | Critical only; additional Nebula exclusions | No for this campaign |
| Quip iOS (`id647922896`) | Yes | Yes | Critical | Critical reports only | No |
| `edgeapi.slack.com` | Yes | Yes | Critical | General policy | **High** |
| Slack iOS (`com.tinyspeck.chatlyio`) | Yes | Yes | Critical | Main app only; not EMM/Intune | Medium |
| Slack iOS EMM (`com.slack.slackmdm`) | Yes | Yes | Critical | Requires a valid supported MDM configuration and EMM-enabled test team | Low |
| Slack Android (`com.Slack`) | Yes | Yes | Critical | Main Play Store client | Medium |
| `app.slack.com` | Yes | Yes | Critical | General policy | **High** |
| `api.slack.com` | Yes | Yes | Critical | Slack API | **High** |
| `*.quip.com` | Yes | Yes | Critical | Critical reports only | No |
| `status.slack.com` | **No** | No | None | Explicit exclusion | No |
| `slackhq.com` and subdomains | **No** | No | None | Explicit exclusion (2025-10-13) | No |
| Slack iOS Intune (`com.slack.slackintune`) | **No** | No | None | Explicit exclusion | No |
| Slack Android Intune (`com.Slack.intune`) | **No** | No | None | Explicit exclusion | No |
| Third-party Quip apps | **No** | No | None | Third-party apps are ineligible | No |
| `*.glitchthegame.com` | **No** | No | None | Prior-company property | No |

### Eligibility, conduct, and exclusions that affect this plan

* The researcher must be first, must personally discover the issue, must follow
  policy, must be legally eligible for payment, and must not be a current or
  recent (12 months) Slack/Salesforce employee.
* Production testing must be **non-automated**, preferably on dedicated test
  teams. Cross-team testing must use dedicated researcher-owned teams.
* Test accounts are mandatory. No access to private third-party information or
  credentials, no exfiltration beyond the minimum proof, spam, phishing,
  brute-force, DDoS, social engineering, physical attacks, or performance harm.
* Relevant exclusions include scanner-only submissions, automation/brute force
  of intended functionality, theoretical non-Critical reports without a working
  PoC, third-party content/services, unsupported clients, already-fixed issues,
  self-XSS, clickjacking-only findings, HTML/link injection, low-impact CSRF,
  missing headers/cookie flags, enumeration, weak captcha, logout CSRF, generic
  TLS/email configuration, descriptive errors, and known-library versions
  without demonstrated exploitability.
* The policy expressly calls Salesforce-platform permission-change TOCTOU that
  resolves only after re-login “working as designed.” H1 therefore avoids a
  generic stale-session-after-role-change test.
* Quip and Nebula accept only Critical reports. Nebula additionally excludes
  attacks requiring victim-side code/config/SSH changes, authenticated or
  firewall-misconfiguration-dependent DoS, and a MITM position.
* Public disclosure through HackerOne has been paused since 2025-08-15, and any
  external disclosure requires explicit Slack approval. This materially limits
  the completeness of public duplicate research for recent findings.
* No special research header, user-agent, or numeric rate limit is stated in the
  rendered public policy. This is **not** permission to automate: the explicit
  non-automated-testing rule controls.

The current reward table explicitly values cross-org authorization, IDOR, and
permission-model failures above their same-org equivalents (up to $10,000 in
the listed categories). The overall published range is $500–$17,000.

## 2. Scope and product deltas

### Scope change signals

| Signal | Finding | Consequence |
|---|---|---|
| `NEW_ASSET` | Nebula entered/changed scope on 2026-05-27 | Do not prioritize: Critical-only and heavily constrained |
| `RECENTLY_CHANGED` | Program policy changed 2026-08-07 | Re-check before every test; reward/severity language may move |
| `RECENTLY_REMOVED` | No removal newer than the displayed scope delta was established | Do not infer authorization from stale lists |
| `NEW_CLIENT` | No newly added Slack client in the displayed structured-scope history | Client testing is lower novelty than platform deltas |
| `NEW_FEATURE_SURFACE` | OAuth optional scopes, agent context, MCP/RTS, streaming APIs, and new Block Kit objects landed during 2026 | Prefer permission-boundary tests around these surfaces |

### Security-relevant recent product changes

The official [Slack developer changelog](https://docs.slack.dev/changelog/)
records several unusually fresh authorization surfaces:

1. [Optional OAuth scopes](https://docs.slack.dev/changelog/2026/03/16/optional-scopes/)
   allow an installer to withhold individual requested privileges while still
   installing an app. This creates a crisp, testable grant/deny differential.
2. [PKCE support](https://docs.slack.dev/changelog/2026/03/30/pkce/) adds a new
   public-client OAuth flow. It is novel, but a meaningful test requires a
   purpose-built desktop/mobile client and careful redirect ownership.
3. [Slack MCP server and Real-time Search API](https://docs.slack.dev/changelog/2026/02/17/slack-mcp/)
   add new app-to-user/workspace data paths. They are promising but require
   confirming entitlement and AI-feature scope before testing.
4. [Agent context](https://docs.slack.dev/changelog/2026/07/02/app-context/)
   can convey the channel, DM, thread, canvas, or list currently viewed. It is a
   high-value context boundary but may require paid/limited agent access.
5. [Streaming API and new Block Kit blocks](https://docs.slack.dev/changelog/2026/04/16/block-kit-new-blocks/)
   expand cross-client parsing and authorship behavior. Authorization impact is
   less direct than optional-scope enforcement.

## 3. Public prior-art map (root-cause oriented)

Sources checked were the program's Hacktivity/disclosed-report surface,
HackerOne-indexed Slack report searches, general web searches, GitHub code and
advisory searches, CVE/NVD searches, Slack security/engineering material,
researcher write-ups, conference/PortSwigger-style research, API documentation,
the developer changelog, and client release-note surfaces.

The useful conclusion is a **root-cause map**, not a claim that private reports
do not exist:

| Root-cause family | Public saturation | Decision |
|---|---:|---|
| Generic message/file/channel IDOR | High | Avoid unless a new object resolver or lifecycle transition is proven distinct |
| Legacy token/scope confusion | High | Avoid generic “wrong scope” probing |
| Slack Connect authority confusion | Medium–High | Valuable impact, but mature and duplicate-prone |
| Unfurl/preview SSRF or redirect chains | High | Avoid without authenticated cross-boundary impact |
| Client parser/rendering differences | High for XSS, lower for authorization | Only pursue if server authorization or identity changes |
| Revoked/deactivated-session persistence | High and partly policy-excluded | Avoid generic TOCTOU/session tests |
| **Installer-denied optional OAuth scope still effective** | **Low–Medium** | New grant-state model; best current test |
| Agent context crossing object visibility | Low but entitlement-heavy | Reserve as H2 |
| MCP/RTS scope-to-result mismatch | Low but setup-heavy and potentially restricted | Reserve as H3 |

Known public examples establish that Slack has historically rewarded
authorization and cross-workspace failures, but no public result located in this
pass established the same root cause as “a scope explicitly declined during the
new optional-scope installation flow remains usable.” Because disclosure is
paused and HackerOne reports may be private, identical prior art remains
**UNKNOWN**, never “impossible.” A second duplicate pass is mandatory before
submission.

## 4. Trust-boundary model

### Principals and security contexts

Unauthenticated users; authenticated users; members; single- and multi-channel
guests; workspace admins/owners; org admins/owners; invited but incomplete,
removed, and deactivated users; bot tokens; user tokens; OAuth apps; workspace
and org installations; external organizations; and Slack Connect participants.

### High-value transitions

| Source principal | Action | Object | Destination context | Required invariant |
|---|---|---|---|---|
| OAuth app with a denied optional scope | Read/mutate via Web API | User/channel object | Installing workspace | Effective token scopes must equal the installer-approved grant |
| Slack Connect member in A | Read/mutate | Shared then disconnected object | Workspace B | Remote authority must end at disconnect/revocation |
| Guest | Mutate | Canvas/list/file | Member/private channel | Object resolver must enforce current role and visibility |
| Workspace-installed bot | Admin-like operation | Enterprise object | Org | Workspace grant must not become an org grant |
| Agent app | Receive view context | DM/canvas/list | User/private context | Context delivery must honor app scopes and object membership |
| REST-authorized principal | Subscribe/receive event | Event payload | Revoked/private object | Event delivery must follow current object authorization |
| Mobile/desktop client | Interpret action target | Message/block object | Different workspace/client | Parsing must not change authenticated destination or identity |

## 5. Five best surfaces

Qualitative score: 1 (worst) to 5 (best). Ratio is
`novelty × impact × testability ÷ duplicate-risk-weight`, where Low=1,
Medium=2, High=4.

| Rank | Surface | Novelty | Impact | Testability | Duplicate risk | Ratio |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Optional OAuth scope grant enforcement | 5 | 4 | 5 | Medium (2) | **50.0** |
| 2 | Agent view-context object authorization | 5 | 5 | 2 | Low (1) | **50.0**, but entitlement blocks immediate work |
| 3 | MCP/Real-time Search scope/result enforcement | 5 | 5 | 2 | Low (1) | **50.0**, but setup/scope uncertainty |
| 4 | Slack Connect shared canvas/list lifecycle | 4 | 5 | 3 | High (4) | 15.0 |
| 5 | Cross-client Block Kit action-target parsing | 4 | 4 | 3 | Medium (2) | 24.0 |

H1 wins despite the tied arithmetic because it has a documented grant decision,
a one-variable differential, no Enterprise dependency, and can be exercised
entirely with researcher-owned identities. Surfaces 2 and 3 stay queued until
their entitlements and precise live scope are confirmed.

## 6. H1-A — pristine optional-scope enforcement canary

**TARGET**  
`api.slack.com` and `https://slack.com/api/dnd.info`.

**FEATURE**  
Slack `bot_optional` OAuth grants and the Slack-specific Do Not Disturb status
API. The official [`dnd.info` documentation](https://docs.slack.dev/reference/methods/dnd.info/)
lists `dnd:read` for both bot and user tokens and documents `missing_scope` when
the token lacks the required permission.

**WHY THIS IS SLACK-SPECIFIC**

Slack introduced the `bot_optional` manifest state and a consent UI where an
installer can withhold individual Slack scopes without blocking installation.
`dnd.info` reads Slack's per-user snooze/DND state; it has no channel parameter,
so channel membership, public-channel visibility, bookmark ownership, or default
bot visibility cannot explain success. The suspected Slack enforcement gap is
that the DND backend might consult requested optional scopes or accumulated
installation state rather than the effective scopes on the issued token. The
attacker benefit would be reading a controlled victim's DND schedule after the
installer explicitly refused that capability.

**WHY NOW**  
Optional scopes became generally available on 2026-03-16, creating a new state:
requested but declined. Older endpoint authorization commonly had only to
reason about requested/granted scope sets.

**ATTACKER**  
`ATTACKER_APP`, a brand-new Slack app controlled by the researcher.

**VICTIM**  
`TEST_USER_B` in a brand-new researcher-owned `WORKSPACE_B`. `TEST_USER_B` sets
a distinctive synthetic DND interval and explicitly declines `dnd:read`.

**SECURITY INVARIANT**  
`IF dnd:read ∉ effective_token_scopes THEN every backend operation protected
exclusively by dnd:read MUST fail.`

**SPECIFIC SUSPECTED ENFORCEMENT GAP**

`dnd.info` could authorize against `oauth_config.scopes.bot_optional` or an
additively accumulated installation grant rather than the scopes actually
attached to the current bot token.

**SPECIFIC ATTACKER BENEFIT**

The app learns the victim's enabled/snooze state and DND timestamps despite the
victim withholding the only documented permission for that data.

This is deliberately a **canary**, not automatically the final finding. A
`dnd.info` bypass proves a clean authorization failure but exposes relatively
limited data. Its primary value is deciding whether to stop or perform exactly
one independent root-cause amplification test.

**DUPLICATE RISK — MEDIUM**  
Scope enforcement is mature, but installer-declined optional scopes are new. No
identical public root cause was located; private reports remain unknowable.

### Fixed method and authorization facts

```text
OPTIONAL_SCOPE = dnd:read
API_METHOD = dnd.info
REQUIRED_SCOPE_DOCUMENTED = dnd:read (bot token and user token)
OTHER_SCOPE_THAT_COULD_AUTHORIZE_IT = NONE DOCUMENTED
EXPECTED_ERROR_WITHOUT_SCOPE = missing_scope
TOKEN_TYPE = bot token (xoxb), for both control and attack
```

Do not proceed if Slack's live documentation lists an additional authorizing
scope, token type, or scope alias on test day. That is `INVALID TEST STATE` until
H1 is redesigned.

### Additive-scope false-positive barrier

The control and attack installations must not share an app, workspace,
installation, or token:

| Role | App | Workspace | Token history |
|---|---|---|---|
| Control | fresh `CONTROL_APP` | fresh `WORKSPACE_A` | first installation; `dnd:read` accepted |
| Attack | fresh `ATTACKER_APP` | fresh `WORKSPACE_B` | first installation; `dnd:read` declined |
| Negative control | fresh `NEGATIVE_APP` | `WORKSPACE_B` | first installation; `dnd:read` never requested |

“Fresh” means newly created for this test and never previously authorized. Do
not use uninstall/reinstall as a substitute: Slack OAuth grants are additive and
a later flow is not evidence of downgrade. If freshness cannot be demonstrated,
stop with `INVALID TEST STATE` and create new resources.

### Mandatory pre-attack evidence

Do **not** send `dnd.info` with the attack token until all fields below are
captured and sanitized:

```text
REQUESTED_REQUIRED_SCOPES = chat:write
REQUESTED_OPTIONAL_SCOPES = dnd:read
USER_ACCEPTED_OPTIONAL_SCOPES = <must be empty>
USER_DECLINED_OPTIONAL_SCOPES = dnd:read
TOKEN_ACTUAL_SCOPES = <from oauth.v2.access scope and x-oauth-scopes>
TOKEN_TYPE = bot
TEAM_ID = <anonymized WORKSPACE_B ID>
AUTH_TEST_TEAM_ID = <anonymized result>
```

Capture the `scope` returned by `oauth.v2.access`, then make one harmless
`auth.test` request and one harmless request that yields response header
`x-oauth-scopes`. The obligatory condition is:

```text
dnd:read ∉ TOKEN_ACTUAL_SCOPES
```

If `dnd:read` appears anywhere in the effective token scopes, **STOP** and record
`INVALID TEST STATE — declined scope is present; possible prior/additive grant`.
Do not interpret any subsequent success as a vulnerability.

### Exact safe test

1. Re-open the live HackerOne policy. Confirm `api.slack.com` and `slack.com`
   remain bounty-eligible and no new rule prohibits this manual test.
2. Create `CONTROL_APP`, `ATTACKER_APP`, and `NEGATIVE_APP` from scratch. Use
   required bot scope `chat:write`. Configure `dnd:read` in `bot_optional` only
   for the first two apps; do not request it for `NEGATIVE_APP`.
3. Create fresh researcher-owned `WORKSPACE_A` and `WORKSPACE_B`. Use only
   `TEST_USER_A` and `TEST_USER_B`; do not add real users or real data.
4. In `WORKSPACE_A`, set a synthetic DND interval for `TEST_USER_A`. Install
   `CONTROL_APP` and explicitly accept `dnd:read`. Capture `oauth.v2.access`,
   `x-oauth-scopes`, token type, and anonymized team ID. Confirm `dnd:read` is
   present.
5. **CONTROL:** call `dnd.info` once using `CONTROL_TOKEN` and the controlled
   `TEST_USER_A` ID. Record HTTP status, Slack `ok`/`error`, response headers,
   and only the DND fields necessary to prove the synthetic interval. It must
   succeed.
6. In pristine `WORKSPACE_B`, set a different synthetic DND interval for
   `TEST_USER_B`. Install `ATTACKER_APP` for the first time and explicitly
   decline `dnd:read`.
7. Complete the mandatory pre-attack evidence block. If the declined scope is
   present, stop as `INVALID TEST STATE` and recreate both app and workspace.
8. Install fresh `NEGATIVE_APP` in `WORKSPACE_B`. Confirm its bot token never
   requested and does not contain `dnd:read`.
9. **NEGATIVE CONTROL:** call the identical `dnd.info` request for
   `TEST_USER_B` with `NEGATIVE_TOKEN`. Expected: `missing_scope`. Also call
   `auth.test` to prove the token is valid and belongs to `WORKSPACE_B`.
10. **ATTACK:** change only the bearer token to `ATTACK_TOKEN` and call the same
    `dnd.info` request for the same `TEST_USER_B`. Expected: `missing_scope`.
11. If the attack is rejected, record `H1-A CANARY = DEAD` and stop. Do not
    repeat or start Phase B; proceed separately to H2.
12. If it returns the protected DND fields, verify they match the synthetic DND
    interval in the Slack UI. Repeat the full test twice with new synthetic
    intervals; at least one repetition must use a fresh app installation and
    fresh token. Stop after three successful reproductions.
13. Revoke/uninstall all three apps, delete both workspaces if practicable, and
    sanitize tokens, cookies, user IDs, team IDs, emails, and timestamps.

Requests (substitute only controlled IDs and sanitized tokens):

```bash
curl --request POST 'https://slack.com/api/dnd.info' \
  --header 'Authorization: Bearer <TOKEN>' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'user=<CONTROLLED_TEST_USER_ID>' \
  --include
```

## 6.1 Phase B — root-cause amplification (conditional)

Run this phase **only** if H1-A meets every canary `CANDIDATE` condition. Do not
run it after `missing_scope`, an invalid test state, or an inconclusive result.
H1-A success is a stop-and-reassess signal, not permission to enumerate scopes.

### Secondary permission selection

The preferred independent confirmation is Slack's documented optional
`chat:write` scope with `chat.postMessage` against one synthetic message in one
private, researcher-controlled channel. Slack's live
[Installing with OAuth documentation](https://docs.slack.dev/authentication/installing-with-oauth/)
currently shows `chat:write` under `bot_optional`, explains that grants are
additive and cannot be downgraded, and requires graceful handling of
`missing_scope` when an optional scope is withheld.

This selection is provisional until the execution-day live gate is completed:

```text
SECONDARY_SCOPE = chat:write
SECONDARY_API_METHOD = chat.postMessage
SCOPE_CAN_BE_OPTIONAL = MUST BE VERIFIED LIVE
REQUIRED_SCOPE_DOCUMENTED = MUST BE VERIFIED LIVE
TOKEN_TYPE = MUST BE VERIFIED LIVE
ALTERNATIVE_ACCEPTED_SCOPES = MUST BE ENUMERATED LIVE
EXPECTED_ERROR_WITHOUT_SCOPE = MUST BE VERIFIED LIVE
```

If the live manifest and method documentation do not establish every field, do
not substitute another scope casually: record `PHASE B NOT RUN — LIVE GATE
FAILED`. Never use admin, audit, discovery, export, search, broad history, or
file scopes merely to inflate impact.

### Independent confirmation design

1. Create a **fourth**, fresh `SECONDARY_APP` and a fresh installation. It must
   never have received `chat:write`. Do not modify or reinstall any Phase A app.
2. Put `chat:write` in `bot_optional` and explicitly decline it. Grant only the
   harmless minimum required scope established by the live manifest flow.
3. In researcher-owned `WORKSPACE_B`, create private `SECONDARY_CHANNEL`, add
   only `TEST_USER_B` and `SECONDARY_APP`, and record that it contains no real
   data. Membership is setup, not proof of authorization.
4. Capture the OAuth response, `x-oauth-scopes`, `auth.test`, bot token type,
   anonymized team ID, and token fingerprint. Mandatory gate:
   `chat:write ∉ SECONDARY_TOKEN_ACTUAL_SCOPES`.
5. Create a separate fresh control app/installation where `chat:write` is
   accepted. With identical channel membership, confirm one synthetic
   `CONTROL-SECONDARY` message can be posted.
6. **SECONDARY NEGATIVE CONTROL:** a fresh bot token that never requested
   `chat:write`, but has identical membership, must receive `missing_scope` from
   the identical `chat.postMessage` request. This distinguishes scope
   enforcement from channel membership.
7. **SECONDARY ATTACK:** change only the bearer token to the declined-scope token
   and attempt one message containing `ATTACK-SECONDARY`. Confirm both the JSON
   response and actual channel history. A success response without the message
   appearing is not a protected side effect.
8. If rejected, stop. If the synthetic message appears, repeat twice; at least
   one reproduction must use another fresh app installation/token. Remove every
   synthetic message and uninstall all Phase B apps.

Do not test a third permission. Phase B is limited to one canary, one independent
confirmation, their controls, and their negative controls.

### Root-cause interpretation

| H1-A `dnd:read` | Secondary `chat:write` | Interpretation |
|---|---|---|
| Rejected | Not run | `H1 = DEAD`; proceed to H2 |
| Bypassed | Rejected | Likely endpoint-specific to `dnd.info`; assess DND-only impact without inflation |
| Bypassed | Bypassed | Candidate generic optional-scope enforcement failure |
| Bypassed | Inconclusive | Root cause `UNKNOWN`; do not submit |

The generic classification is allowed only if both effective tokens
demonstrably lack their declined scopes and both protected operations genuinely
succeed. Severity follows demonstrated capabilities: distinguish **DND-only
information disclosure** from a framework-level failure that also permits a
rejected write capability. Do not extrapolate to untested scopes.

### False-positive matrix required before `CANDIDATE`

| Alternative explanation | Required ruling-out evidence | Status before execution |
|---|---|---|
| A. Scope previously granted | Fresh app + fresh workspace + first installation records | NOT RULED OUT |
| B. Another scope authorizes method | Live method docs show only `dnd:read`; token inventory | NOT RULED OUT |
| C. Bot membership grants action | `dnd.info` has no channel/object-membership parameter | RULED OUT by method design; re-check live docs |
| D. Installing-user privilege causes behavior | Same non-admin controlled role in both workspaces | NOT RULED OUT |
| E. Public-resource semantics allow action | DND state is user-scoped; method docs still require `dnd:read` | NOT RULED OUT |
| F. Old authorization retained | Fresh app/workspace/token, never reauthorized | NOT RULED OUT |
| G. Wrong token used | `auth.test`, anonymized team ID, token fingerprint | NOT RULED OUT |
| H. Docs permit scope-less use | Archived live method page and response headers | NOT RULED OUT |
| I. Scope applies only to another subtype | Same bot token type and same `dnd.info` shape in control/attack | NOT RULED OUT |
| J. Success without protected result | Returned timestamps match synthetic UI state | NOT RULED OUT |

Every row must become `RULED OUT` with captured evidence before classification as
`CANDIDATE`. A reported `ok: true` without the protected DND values matching the
controlled state is insufficient.

### Classification

**DEAD:** pristine declined-scope token lacks `dnd:read` and `dnd.info` returns
`missing_scope` or equivalent authorization failure. Record `H1-A CANARY =
DEAD`; do not run Phase B or try to rescue H1. Move to H2 only after independently
applying the same target-specific gate.

**CANDIDATE:** the scope is absent, no other granted scope authorizes the method,
the protected DND state is returned and verified, the result reproduces three
times (including a fresh installation/token), and all false-positive rows are
`RULED OUT`. Even then: **NON SUBMIT** until the final method/root-cause duplicate
pass is complete.

## 7. Execution record

```text
TARGET VERIFIED: SLACK / HACKERONE
LIVE ASSET: api.slack.com; slack.com/api/dnd.info
TEST DATE: NOT EXECUTED

OPTIONAL_SCOPE: dnd:read
TOKEN TYPE: bot (planned)
CONTROL TOKEN SCOPES: NOT CAPTURED
ATTACK TOKEN SCOPES: NOT CAPTURED

CONTROL:
NOT EXECUTED — no Slack test credentials/workspaces were supplied to this environment.

ATTACK:
NOT EXECUTED.

NEGATIVE CONTROL:
NOT EXECUTED.

PROTECTED SIDE EFFECT:
did not occur (no request sent)

FALSE POSITIVE MATRIX:
See planning matrix; execution-dependent rows remain NOT RULED OUT.

FINAL STATE:
NOT CLASSIFIABLE — H1 has not been executed. It is neither DEAD nor CANDIDATE.

H1-A CANARY: NOT EXECUTED
SECONDARY SCOPE: chat:write (provisional; live verification required)
SECONDARY RESULT: NOT RUN — gated on H1-A CANDIDATE
ROOT CAUSE: UNKNOWN
REAL IMPACT: NONE DEMONSTRATED

CONFIDENCE:
0% that a vulnerability exists; 95% that this protocol excludes additive-grant false positives.

DUPLICATE RISK:
MEDIUM

SUBMIT: NO
```

**NON SUBMIT.** No Slack credentials were available in this environment, and no
live OAuth installation or API request was attempted. Inventing DEAD/CANDIDATE
results would violate the evidence gate. The next action must be execution by
the researcher in the three pristine, researcher-controlled installations above,
followed by insertion of sanitized evidence into this record.
