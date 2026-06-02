---
description: "Test case template for feature validation — Unit, Integration, and Contract tests organized by User Story"
---

# Test Cases: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), contracts/ (for Contract Tests), quickstart.md (for Integration Test scenarios)

**Framework**: Auto-detected from plan.md / research.md (e.g. pytest, Jest, xUnit)

**Organization**: Test cases are grouped by user story so each story can be validated independently.

## Format: `[ID] [P?] [Type] [Story] Description`

- **[P]**: Can run in parallel (no shared state, different files)
- **[CT]**: Contract Test — validates interface/API contract (schema, status codes, error format)
- **[UT]**: Unit Test — validates isolated logic/class/function with mocks
- **[IT]**: Integration Test — validates end-to-end flow through real layers
- **[Story]**: Which user story this test covers (e.g., US1, US2, US3)
- Include exact file paths in descriptions
- Append `← validates TXXX` to link each test to its implementation task (if tasks.md exists)

## Path Conventions

- **Single project**: `tests/contract/`, `tests/unit/`, `tests/integration/` at repository root
- **Web app**: `backend/tests/contract/`, `backend/tests/unit/`, `frontend/__tests__/`
- **Mobile**: `api/tests/`, `ios/Tests/`, `android/app/src/test/`
- Paths shown below assume single project - adjust based on plan.md structure

<!--
  ============================================================================
  IMPORTANT: The test entries below are SAMPLE ENTRIES for illustration only.

  The /speckit.testcase command MUST replace these with actual test cases based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Interface contracts from contracts/ (→ Contract Tests)
  - Services and entities from plan.md and data-model.md (→ Unit Tests)
  - Acceptance scenarios from quickstart.md or spec acceptance criteria (→ Integration Tests)

  Within each story phase, the order MUST always be:
    Contract Tests [CT] → Unit Tests [UT] → Integration Tests [IT]

  DO NOT keep these sample entries in the generated testcase.md file.
  ============================================================================
-->

## Phase 1: Setup (Test Infrastructure)

**Purpose**: Initialize test framework, shared fixtures, and base configuration

- [ ] TC001 Configure test framework and runner in [test_dir]/[config_file]
- [ ] TC002 [P] [UT] Create shared fixtures and test database setup in tests/conftest.[ext]
- [ ] TC003 [P] [UT] Create mock factory helpers for external services in tests/mocks/[mock_file].[ext]

---

## Phase 2: Foundational (Shared Test Helpers)

**Purpose**: Reusable test utilities that ALL story tests depend on

**⚠️ CRITICAL**: No story-level tests can be written until this phase is complete

- [ ] TC004 [P] [UT] Create base HTTP test client helper in tests/helpers/client.[ext]
- [ ] TC005 [P] [UT] Create authentication test helper (generate test tokens/sessions) in tests/helpers/auth.[ext]
- [ ] TC006 [P] [UT] Create test data seeder/factory in tests/helpers/seeder.[ext]
- [ ] TC007 Setup test environment configuration in tests/[env_config_file]

**Checkpoint**: Test foundation ready - story-level test cases can now be written

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story validates]

**Story Passes When**: [Acceptance criteria — given/when/then]

### Contract Tests for User Story 1

> **NOTE: Write these FIRST, ensure they FAIL before implementation begins**

- [ ] TC008 [P] [CT] [US1] Verify [METHOD] /[endpoint] returns [status] with valid payload in tests/contract/test_[name].[ext]  ← validates T0XX
- [ ] TC009 [P] [CT] [US1] Verify [METHOD] /[endpoint] returns 400 on invalid input in tests/contract/test_[name].[ext]  ← validates T0XX
- [ ] TC010 [P] [CT] [US1] Verify [METHOD] /[endpoint] returns 401 when unauthenticated in tests/contract/test_[name].[ext]  ← validates T0XX

### Unit Tests for User Story 1

- [ ] TC011 [P] [UT] [US1] Test [Entity] model validation — happy path in tests/unit/test_[entity].[ext]  ← validates T0XX
- [ ] TC012 [P] [UT] [US1] Test [Entity] model validation — invalid fields raise error in tests/unit/test_[entity].[ext]  ← validates T0XX
- [ ] TC013 [P] [UT] [US1] Test [Service].create() — happy path in tests/unit/test_[service].[ext]  ← validates T0XX
- [ ] TC014 [P] [UT] [US1] Test [Service].create() — raises error on duplicate/conflict in tests/unit/test_[service].[ext]  ← validates T0XX
- [ ] TC015 [P] [UT] [US1] Test [Service].[method]() — handles external dependency failure gracefully in tests/unit/test_[service].[ext]  ← validates T0XX

### Integration Tests for User Story 1

- [ ] TC016 [IT] [US1] Test complete [user journey / flow name] end-to-end in tests/integration/test_[flow_name].[ext]  ← validates T0XX
- [ ] TC017 [IT] [US1] Test [user journey] with edge case input in tests/integration/test_[flow_name].[ext]  ← validates T0XX

**Checkpoint**: At this point, User Story 1 should be fully validated — CT + UT + IT all passing

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story validates]

**Story Passes When**: [Acceptance criteria — given/when/then]

### Contract Tests for User Story 2

- [ ] TC018 [P] [CT] [US2] Verify [METHOD] /[endpoint] returns [status] with valid payload in tests/contract/test_[name].[ext]  ← validates T0XX
- [ ] TC019 [P] [CT] [US2] Verify [METHOD] /[endpoint] returns appropriate error codes in tests/contract/test_[name].[ext]  ← validates T0XX

### Unit Tests for User Story 2

- [ ] TC020 [P] [UT] [US2] Test [Entity/Service] — happy path in tests/unit/test_[module].[ext]  ← validates T0XX
- [ ] TC021 [P] [UT] [US2] Test [Entity/Service] — error cases in tests/unit/test_[module].[ext]  ← validates T0XX
- [ ] TC022 [P] [UT] [US2] Test integration point with User Story 1 components (mocked) in tests/unit/test_[module].[ext]  ← validates T0XX

### Integration Tests for User Story 2

- [ ] TC023 [IT] [US2] Test complete [user journey] end-to-end in tests/integration/test_[flow_name].[ext]  ← validates T0XX
- [ ] TC024 [IT] [US2] Test [user journey] combined with User Story 1 flow in tests/integration/test_[combined_flow].[ext]  ← validates T0XX

**Checkpoint**: At this point, User Stories 1 AND 2 should both be fully validated

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story validates]

**Story Passes When**: [Acceptance criteria — given/when/then]

### Contract Tests for User Story 3

- [ ] TC025 [P] [CT] [US3] Verify [METHOD] /[endpoint] returns [status] in tests/contract/test_[name].[ext]  ← validates T0XX

### Unit Tests for User Story 3

- [ ] TC026 [P] [UT] [US3] Test [Service/Module] — happy path in tests/unit/test_[module].[ext]  ← validates T0XX
- [ ] TC027 [P] [UT] [US3] Test [Service/Module] — error handling in tests/unit/test_[module].[ext]  ← validates T0XX

### Integration Tests for User Story 3

- [ ] TC028 [IT] [US3] Test complete [user journey] end-to-end in tests/integration/test_[flow_name].[ext]  ← validates T0XX

**Checkpoint**: All user stories should now be fully validated

---

[Add more user story phases as needed, following the same CT → UT → IT pattern]

---

## Phase N: Cross-Cutting Test Concerns

**Purpose**: Security, performance, and edge case validation across all stories

- [ ] TCXXX [P] [UT] Test rate limiting and throttling behavior in tests/unit/test_rate_limit.[ext]
- [ ] TCXXX [P] [UT] Test authorization — roles cannot access resources they don't own in tests/unit/test_authorization.[ext]
- [ ] TCXXX [P] [UT] Test input sanitization and injection prevention in tests/unit/test_security.[ext]
- [ ] TCXXX [IT] Test system behavior under concurrent requests in tests/integration/test_concurrency.[ext]
- [ ] TCXXX [IT] Run quickstart.md acceptance scenarios end-to-end in tests/integration/test_quickstart.[ext]

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all story tests
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then be tested in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Cross-Cutting (Final Phase)**: Depends on all desired user stories passing

### User Story Test Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integration tests may reference US1 flows but unit tests are independent
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Same as above

### Within Each User Story

- Contract Tests [CT] MUST be written first and FAIL before any implementation
- Unit Tests [UT] come after CT — test logic in isolation with mocks
- Integration Tests [IT] come last — test full flow through real layers
- Story fully validated before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user story test phases can start in parallel (if team capacity allows)
- All [CT] tests within a story marked [P] can run in parallel
- All [UT] tests within a story marked [P] can run in parallel (different files)
- Different user stories can be validated in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Step 1 — Run all Contract Tests in parallel (must fail first):
Task: "Verify POST /[endpoint] returns 201 in tests/contract/test_[name].[ext]"
Task: "Verify POST /[endpoint] returns 400 on invalid input in tests/contract/test_[name].[ext]"
Task: "Verify POST /[endpoint] returns 401 when unauthenticated in tests/contract/test_[name].[ext]"

# Step 2 — Run all Unit Tests in parallel:
Task: "Test [Entity] model validation in tests/unit/test_[entity].[ext]"
Task: "Test [Service].create() in tests/unit/test_[service].[ext]"

# Step 3 — Run Integration Tests after unit tests pass:
Task: "Test complete [flow name] end-to-end in tests/integration/test_[flow_name].[ext]"
```

---

## Validation Strategy

### TDD Gate (MVP — User Story 1 First)

1. Complete Phase 1: Test Setup
2. Complete Phase 2: Foundational Helpers (CRITICAL - blocks all story tests)
3. Write Phase 3 Contract Tests → confirm they FAIL
4. Write Phase 3 Unit Tests → confirm they FAIL
5. Implement User Story 1 (via tasks.md)
6. **STOP and VALIDATE**: Run all Phase 3 tests → all must PASS
7. Deploy/demo if ready

### Incremental Validation

1. Complete Setup + Foundational → test foundation ready
2. Add User Story 1 tests → implement → validate independently → Deploy/Demo (MVP!)
3. Add User Story 2 tests → implement → validate independently → Deploy/Demo
4. Add User Story 3 tests → implement → validate independently → Deploy/Demo
5. Each story validated before moving to the next

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 tests + implementation
   - Developer B: User Story 2 tests + implementation
   - Developer C: User Story 3 tests + implementation
3. Stories tested and validated independently

---

## Notes

- [P] tests = no shared mutable state, different files, safe to run concurrently
- [CT] = schema/contract assertions only, no business logic
- [UT] = must mock ALL external dependencies (DB, HTTP, queues)
- [IT] = use real layers; only mock external third-party services
- `← validates TXXX` links each test to its implementation task in tasks.md
- Each story phase is runnable independently with test filter (e.g. `pytest -k "us1"`)
- Write tests before implementation — a test that passes immediately without code is not a useful test
- Commit test files before implementation files for clean history
- Avoid: vague test descriptions, shared database state between [IT] tests, cross-story hard dependencies
