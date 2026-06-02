---
description: "Generate an actionable, dependency-ordered testcase.md covering Unit, Integration, and Contract tests — organized by User Story — based on available design artifacts."
handoffs:
  - label: Analyze For Consistency
    agent: speckit.analyze
    prompt: Run a project analysis for consistency
    send: true
  - label: Generate Tasks
    agent: speckit.tasks
    prompt: Generate the implementation tasks list
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before testcase generation)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_testcase` key
- If the YAML cannot be parsed or is invalid, skip hook checking silently and continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

1. **Setup**: Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g `'I'\''m Groot'` (or double-quote if possible: `"I'm Groot"`).

2. **Detect test framework**:
   - Read `plan.md` → look for test framework mentions (pytest, Jest, Vitest, xUnit, JUnit, RSpec, etc.)
   - If not found in plan.md, read `research.md` → look for testing decisions/ADRs
   - If not found, read `spec.md` → look for testing requirements or tooling mentions
   - If a `constitution.md` or `checklist.md` exists in FEATURE_DIR or project root, read it for framework/quality constraints
   - **If still not detected**: default to the language's most common framework (Python → pytest, JS/TS → Jest, .NET → xUnit, Java → JUnit 5) and note the assumption in the report
   - Record: `TEST_FRAMEWORK`, `TEST_DIR` (e.g. `tests/`, `__tests__/`, `spec/`), `MOCK_LIBRARY`, `ASSERTION_STYLE`

3. **Load design documents**: Read from FEATURE_DIR:
   - **Required**: `plan.md` (tech stack, project structure), `spec.md` (user stories with priorities)
   - **Optional**: `data-model.md` (entities and relationships), `contracts/` (interface contracts → primary source for Contract Tests), `research.md` (testing decisions), `quickstart.md` (acceptance scenarios → source for Integration Tests)
   - If `tasks.md` exists in FEATURE_DIR: read it to map test IDs against existing task IDs for traceability
   - Note: Not all projects have all documents. Generate test cases based on what's available.

4. **Execute testcase generation workflow**:
   - Extract user stories with priorities (P1, P2, P3…) from `spec.md`
   - For each user story, determine the **three test layers** needed:
     - **Contract Tests** [CT]: one per interface contract in `contracts/` that serves this story
     - **Unit Tests** [UT]: one per service/function/class implementing this story's logic
     - **Integration Tests** [IT]: one per end-to-end flow / acceptance scenario from `quickstart.md` or spec acceptance criteria
   - Map entities from `data-model.md` to the story that owns them → unit tests for model validation
   - If `tasks.md` exists: annotate each test with the task ID it validates (e.g. "validates T014")
   - Apply correct file path conventions based on detected framework and `plan.md` structure
   - Generate dependency graph: CT → UT → IT (within each story), stories independent of each other
   - Generate parallel execution examples per story

5. **Generate testcase.md**: Use `.specify/templates/testcase-template.md` as structure, fill with:
   - Correct feature name from `plan.md`
   - Detected framework and tooling in the header
   - Phase 1: Setup (test infrastructure initialization)
   - Phase 2: Foundational test helpers/fixtures (shared across stories)
   - Phase 3+: One phase per user story (priority order from spec.md)
     - Each story phase has three sections: Contract Tests → Unit Tests → Integration Tests
     - Each test must have: test ID, test type label [CT/UT/IT], story label [US?], file path, and a one-line description of **what scenario is being verified**
   - Final Phase: Cross-cutting test concerns (security, performance, edge cases)
   - All test tasks must follow the strict checklist format (see Test Generation Rules below)
   - Dependencies section showing test execution order
   - Parallel execution examples per story

6. **Report**: Output path to generated `testcase.md` and summary:
   - Total test count
   - Test count per user story, broken down by type (CT / UT / IT)
   - Detected framework and assumption notes (if any)
   - Parallel opportunities identified
   - Task traceability map (test → task ID) if `tasks.md` was found
   - Format validation: Confirm ALL entries follow the checklist format (checkbox, ID, type label, story label, file path)

7. **Check for extension hooks**: After `testcase.md` is generated, check if `.specify/extensions.yml` exists in the project root.
   - If it exists, read it and look for entries under the `hooks.after_testcase` key
   - If the YAML cannot be parsed or is invalid, skip hook checking silently and continue normally
   - Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
   - For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
     - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
     - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
   - For each executable hook, output the following based on its `optional` flag:
     - **Optional hook** (`optional: true`):
       ```
       ## Extension Hooks

       **Optional Hook**: {extension}
       Command: `/{command}`
       Description: {description}

       Prompt: {prompt}
       To execute: `/{command}`
       ```
     - **Mandatory hook** (`optional: false`):
       ```
       ## Extension Hooks

       **Automatic Hook**: {extension}
       Executing: `/{command}`
       EXECUTE_COMMAND: {command}
       ```
   - If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

Context for testcase generation: $ARGUMENTS

The `testcase.md` should be immediately executable — each test entry must be specific enough that an LLM or developer can implement it without additional context.

---

## Test Generation Rules

**CRITICAL**: Tests MUST be organized by user story to enable independent validation of each story.

### Checklist Format (REQUIRED)

Every test entry MUST strictly follow this format:

```text
- [ ] [TestID] [P?] [Type] [Story?] Description with file path
```

**Format Components**:

1. **Checkbox**: ALWAYS start with `- [ ]` (markdown checkbox)
2. **Test ID**: Sequential number (TC001, TC002, TC003…) in execution order
3. **[P] marker**: Include ONLY if test can run in parallel (no shared state, different files)
4. **[Type] label**: REQUIRED for every test
   - `[CT]` — Contract Test (validates interface/API contract)
   - `[UT]` — Unit Test (validates isolated logic/function/class)
   - `[IT]` — Integration Test (validates end-to-end flow / acceptance scenario)
5. **[Story] label**: REQUIRED for user story phase tests only
   - Format: `[US1]`, `[US2]`, `[US3]`, etc. (maps to user stories from spec.md)
   - Setup phase: NO story label
   - Foundational phase: NO story label
   - User Story phases: MUST have story label
   - Polish phase: NO story label
6. **Description**: Clear scenario being validated + exact file path

**Examples**:

- ✅ CORRECT: `- [ ] TC001 [P] [CT] [US1] Verify POST /users returns 201 with valid payload in tests/contract/test_users_api.py`
- ✅ CORRECT: `- [ ] TC005 [P] [UT] [US1] Test UserService.create() raises error on duplicate email in tests/unit/test_user_service.py`
- ✅ CORRECT: `- [ ] TC009 [IT] [US1] Test full user registration flow end-to-end in tests/integration/test_registration_flow.py`
- ✅ CORRECT: `- [ ] TC002 [P] [UT] Setup shared fixtures in tests/conftest.py`
- ❌ WRONG: `- [ ] TC001 [US1] Test UserService` (missing Type label and file path)
- ❌ WRONG: `TC005 [CT] [US1] Verify endpoint` (missing checkbox)
- ❌ WRONG: `- [ ] [CT] [US1] Verify endpoint` (missing Test ID)
- ❌ WRONG: `- [ ] TC009 [IT] [US2] Test flow` (missing file path)

### Test Layer Rules

**Contract Tests [CT]** (write first — define the contract):
- One test file per interface contract in `contracts/`
- Test: correct HTTP status codes, response schema, error formats
- Must FAIL before implementation is written (TDD gate)
- Mark `[P]` — all contract tests for a story can run in parallel
- File path: `tests/contract/test_[contract_name].[ext]`

**Unit Tests [UT]** (write after CT — test the logic):
- One `describe`/`class` block per service, model, or utility
- Test: happy path, edge cases, error cases, validation rules
- Use mocks/stubs for all external dependencies
- Mark `[P]` — unit tests in the same story can run in parallel (different files)
- File path: `tests/unit/test_[module_name].[ext]`

**Integration Tests [IT]** (write last — test the flow):
- One test per acceptance scenario from `quickstart.md` or spec story acceptance criteria
- Test: full end-to-end flow through real layers (no mocks unless external 3rd party)
- Do NOT mark `[P]` unless tests are fully isolated with separate DB state
- File path: `tests/integration/test_[flow_name].[ext]`

### Test Organization per Phase

Within each User Story phase:

```
Contract Tests [CT]   → run first, define expected behavior
Unit Tests [UT]       → run second, validate implementation logic  
Integration Tests [IT] → run last, validate full story works end-to-end
```

### Traceability

If `tasks.md` exists, annotate each test with the task it validates:

```text
- [ ] TC005 [P] [UT] [US1] Test UserService.create() in tests/unit/test_user_service.py  ← validates T014
```

Use `← validates TXXX` at end of line (does not break the checklist format).
